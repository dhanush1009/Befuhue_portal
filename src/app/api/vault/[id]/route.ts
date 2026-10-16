import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createAuditLog } from '@/lib/audit';
import { encryptSecret } from '@/lib/vault/crypto';
import { canManageCredential, updateCredentialSchema } from '@/lib/vault/rules';
import { toMeta } from '@/lib/vault/service';

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const existing = await prisma.credential.findUnique({ where: { id: params.id }, include: { client: { select: { name: true } } } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canManageCredential(user.id, user.role === 'ADMIN', existing.createdById)) return NextResponse.json({ error: 'You can only change logins you added yourself.' }, { status: 403 });

  const parsed = updateCredentialSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid entry' }, { status: 400 });
  const v = parsed.data;

  if (v.clientId && !(await prisma.client.findUnique({ where: { id: v.clientId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'That brand does not exist' }, { status: 400 });
  }

  const data: Record<string, unknown> = { updatedById: user.id };
  for (const k of ['clientId', 'service', 'domain', 'label', 'loginUrl'] as const) if (v[k] !== undefined) data[k] = v[k];
  const secretsChanged: string[] = [];
  if (v.username !== undefined) { data.usernameEnc = encryptSecret(v.username); secretsChanged.push('Username'); }
  if (v.password !== undefined) { data.passwordEnc = encryptSecret(v.password); secretsChanged.push('Password'); }
  if (v.notes !== undefined) { data.notesEnc = v.notes ? encryptSecret(v.notes) : null; secretsChanged.push('Notes'); }

  const updated = await prisma.credential.update({ where: { id: params.id }, data, include: { client: { select: { name: true, logoUrl: true } } } });

  // Names of what changed only, never values
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const k of ['service', 'domain', 'label', 'loginUrl', 'clientId'] as const) if (v[k] !== undefined && v[k] !== existing[k]) changes[k] = { before: 'changed', after: 'changed' };
  for (const s of secretsChanged) changes[s] = { before: 'hidden', after: 'changed' };
  await createAuditLog(user.id, 'CREDENTIAL_UPDATED', params.id, 'Credential', changes);
  return NextResponse.json({ data: toMeta(updated) });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const existing = await prisma.credential.findUnique({ where: { id: params.id }, include: { client: { select: { name: true } } } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canManageCredential(user.id, user.role === 'ADMIN', existing.createdById)) return NextResponse.json({ error: 'You can only delete logins you added yourself.' }, { status: 403 });

  await prisma.credential.delete({ where: { id: params.id } });
  // Pending and approved requests for it are no longer meaningful; tasks that referenced it just lose the link.
  await prisma.credentialAccess.deleteMany({ where: { credentialId: params.id } });
  const tasks = await prisma.task.findMany({ where: { credentialIds: { has: params.id } }, select: { id: true, credentialIds: true } });
  await Promise.all(tasks.map((t) => prisma.task.update({ where: { id: t.id }, data: { credentialIds: t.credentialIds.filter((c) => c !== params.id) } })));
  await createAuditLog(user.id, 'CREDENTIAL_DELETED', params.id, 'Credential', { Entry: { before: `${existing.client.name} · ${existing.service}`, after: null } });
  return NextResponse.json({ data: { ok: true } });
}
