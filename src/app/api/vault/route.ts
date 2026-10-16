import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit';
import { encryptSecret, vaultKeyIsDedicated } from '@/lib/vault/crypto';
import { createCredentialSchema } from '@/lib/vault/rules';
import { accessFor, toMeta } from '@/lib/vault/service';

// The password vault. Everyone signed in can see WHAT is stored (brand, service, domain) and can add a
// login for a brand; nobody sees a username or password from this route.

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;
  const isAdmin = user.role === 'ADMIN';

  const rows = await prisma.credential.findMany({ include: { client: { select: { name: true, logoUrl: true } } }, orderBy: [{ createdAt: 'desc' }] });
  const mineIds = new Set(rows.filter((r) => r.createdById === user.id).map((r) => r.id));
  const items = rows.map(toMeta).map((m) => ({ ...m, mine: mineIds.has(m.id) })).sort((a, b) => a.brand.localeCompare(b.brand) || a.service.localeCompare(b.service));
  const access = isAdmin ? {} : await accessFor(user.id, items.map((i) => i.id));
  const pending = isAdmin ? await prisma.credentialAccess.count({ where: { status: 'PENDING' } }) : 0;
  const brands = await prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });

  return NextResponse.json({ data: { items, access, brands, isAdmin, pendingRequests: pending, dedicatedKey: isAdmin ? vaultKeyIsDedicated() : undefined } });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const parsed = createCredentialSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid entry' }, { status: 400 });
  const v = parsed.data;

  const brand = await prisma.client.findUnique({ where: { id: v.clientId }, select: { id: true, name: true } });
  if (!brand) return NextResponse.json({ error: 'That brand does not exist' }, { status: 400 });

  try {
    const created = await prisma.credential.create({
      data: {
        clientId: v.clientId, service: v.service, domain: v.domain ?? null, label: v.label ?? null, loginUrl: v.loginUrl ?? null,
        usernameEnc: encryptSecret(v.username), passwordEnc: encryptSecret(v.password), notesEnc: v.notes ? encryptSecret(v.notes) : null,
        createdById: user.id,
      },
      include: { client: { select: { name: true, logoUrl: true } } },
    });
    await createAuditLog(user.id, 'CREDENTIAL_CREATED', created.id, 'Credential', { Entry: { before: null, after: `${brand.name} · ${v.service}` } });

    // Let the admins know when a team member adds one (name of the service only, never the login).
    if (user.role !== 'ADMIN') {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      await Promise.all(admins.map((a) => createNotification(a.id, 'SYSTEM', `${user.name} added a login: ${brand.name} · ${v.service}`, v.domain ?? 'No domain', '/vault')));
    }
    return NextResponse.json({ data: { ...toMeta(created), mine: true } }, { status: 201 });
  } catch (e) {
    console.error('[vault] create failed', (e as Error).message);
    return NextResponse.json({ error: 'Could not save this entry. Please try again.' }, { status: 500 });
  }
}
