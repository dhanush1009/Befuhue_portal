import { NextRequest, NextResponse } from 'next/server';
import { format, parseISO } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { requireAdmin } from '@/lib/requireAdmin';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { decideJoiningSchema } from '@/lib/joiningDate';
import { canDecide } from '@/lib/vault/rules';

type Ctx = { params: { rid: string } };
const nice = (d: Date | null) => (d ? format(parseISO(d.toISOString().slice(0, 10)), 'd MMMM yyyy') : 'not set');

/** Any other admin approves or rejects. Approving changes the joining date everywhere (profile, timeline, anniversaries). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const parsed = decideJoiningSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });

  const r = await prisma.joiningDateRequest.findUnique({ where: { id: params.rid } });
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canDecide(user.id, r.userId)) return NextResponse.json({ error: 'You cannot approve your own request. Another admin has to.' }, { status: 403 });

  const approve = parsed.data.decision === 'APPROVE';
  const now = new Date();
  // Only a request that is still PENDING can be decided, even if two admins click at once.
  const done = await prisma.joiningDateRequest.updateMany({
    where: { id: r.id, status: 'PENDING' },
    data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: user.id, decidedAt: now, decisionNote: parsed.data.note ?? null },
  });
  if (done.count !== 1) return NextResponse.json({ error: 'This request was already decided.' }, { status: 409 });

  if (approve) await prisma.user.update({ where: { id: r.userId }, data: { joiningDate: r.requestedDate } });
  await createAuditLog(user.id, approve ? 'JOINING_DATE_APPROVED' : 'JOINING_DATE_REJECTED', r.userId, 'User', {
    'Joining date': { before: r.currentDate?.toISOString().slice(0, 10) ?? null, after: approve ? r.requestedDate.toISOString().slice(0, 10) : 'unchanged' },
  });
  await createNotification(
    r.userId, 'JOINING_DATE_DECIDED',
    approve ? 'Your joining date was updated' : 'Your joining date change was not approved',
    approve ? `It is now ${nice(r.requestedDate)}.${parsed.data.note ? ` ${parsed.data.note}` : ''}` : (parsed.data.note ?? 'An admin declined the change.'),
    '/profile',
  );
  return NextResponse.json({ data: { ok: true } });
}

/** The requester withdraws their own pending request. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const done = await prisma.joiningDateRequest.updateMany({ where: { id: params.rid, userId: user.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  if (done.count !== 1) return NextResponse.json({ error: 'Nothing to cancel.' }, { status: 404 });
  return NextResponse.json({ data: { ok: true } });
}
