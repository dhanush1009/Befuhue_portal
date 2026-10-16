import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { createAuditLog } from '@/lib/audit';

const schema = z.object({
  clientId:     z.string().min(1).nullable().optional(),
  isEnabled:    z.boolean().optional(),
  resultAction: z.string().max(120).nullable().optional(),
});

// ── PATCH - map an account to a client, switch it on/off, pick its headline result (admin) ──
// Mapping is always a person's decision here - nothing is matched by name.

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { clientId, isEnabled, resultAction } = parsed.data;

  try {
    const before = await prisma.metaAdAccount.findUnique({ where: { id: params.id } });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) return NextResponse.json({ error: 'That client does not exist.' }, { status: 400 });
    }

    const updated = await prisma.metaAdAccount.update({
      where: { id: params.id },
      data: {
        ...(clientId !== undefined ? { clientId } : {}),
        ...(isEnabled !== undefined ? { isEnabled } : {}),
        ...(resultAction !== undefined ? { resultAction: resultAction || null } : {}),
      },
      include: { client: { select: { name: true } } },
    });

    await createAuditLog(user.id, 'META_ACCOUNT_UPDATED', params.id, 'MetaAdAccount', {
      ...(clientId !== undefined ? { clientId: { before: before.clientId, after: updated.clientId } } : {}),
      ...(isEnabled !== undefined ? { isEnabled: { before: before.isEnabled, after: updated.isEnabled } } : {}),
      ...(resultAction !== undefined ? { resultAction: { before: before.resultAction, after: updated.resultAction } } : {}),
    });

    return NextResponse.json({ data: { id: updated.id, isEnabled: updated.isEnabled, clientId: updated.clientId, clientName: updated.client?.name ?? null, resultAction: updated.resultAction } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
