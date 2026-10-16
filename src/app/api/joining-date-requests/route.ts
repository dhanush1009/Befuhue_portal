import { NextRequest, NextResponse } from 'next/server';
import { format, parseISO } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { checkRequestedDate, createJoiningRequestSchema, toNoonUtc } from '@/lib/joiningDate';

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// Admins see everyone's requests (pending first); everyone else sees only their own.
export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;
  const isAdmin = user.role === 'ADMIN';

  const rows = await prisma.joiningDateRequest.findMany({ where: isAdmin ? {} : { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.flatMap((r) => [r.userId, r.decidedById].filter(Boolean) as string[]))] } }, select: { id: true, name: true, avatarUrl: true } });
  const uMap = new Map(users.map((u) => [u.id, u]));
  const items = rows.map((r) => ({
    id: r.id, status: r.status, reason: r.reason, currentDate: day(r.currentDate), requestedDate: day(r.requestedDate),
    createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null, decisionNote: r.decisionNote,
    requester: uMap.get(r.userId) ?? { id: r.userId, name: 'Unknown', avatarUrl: null }, decidedBy: r.decidedById ? uMap.get(r.decidedById)?.name ?? null : null,
  }));
  return NextResponse.json({ data: { items, isAdmin, pending: rows.filter((r) => r.status === 'PENDING').length } });
}

// An employee asks for their joining date to be changed.
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const parsed = createJoiningRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { joiningDate: true, name: true } });
  const problem = checkRequestedDate(parsed.data.requestedDate, me?.joiningDate ?? null);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (await prisma.joiningDateRequest.findFirst({ where: { userId: user.id, status: 'PENDING' } })) {
    return NextResponse.json({ error: 'You already have a request waiting for approval.' }, { status: 409 });
  }

  const created = await prisma.joiningDateRequest.create({
    data: { userId: user.id, currentDate: me?.joiningDate ?? null, requestedDate: toNoonUtc(parsed.data.requestedDate), reason: parsed.data.reason },
  });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true, id: { not: user.id } }, select: { id: true } });
  await Promise.all(admins.map((a) => createNotification(
    a.id, 'JOINING_DATE_REQUEST', `${me?.name ?? user.name} asked to change their joining date`,
    `To ${format(parseISO(parsed.data.requestedDate), 'd MMMM yyyy')}. Reason: ${parsed.data.reason}`, '/approvals?tab=joining',
  )));
  return NextResponse.json({ data: { id: created.id } }, { status: 201 });
}
