import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { getISTDateString } from '@/lib/attendance';
import { dateKeyOf, dayKeysBetween, type NoticeKind } from '@/lib/timeline';

export type HeadsUpItem =
  | { kind: 'LEAVE';  id: string; userId: string; name: string; avatarUrl: string | null; designation: string | null; date: string;
      leaveType: string; status: 'APPROVED' | 'PENDING'; reason: string | null; fromDate: string; toDate: string }
  | { kind: 'NOTICE'; id: string; userId: string; name: string; avatarUrl: string | null; designation: string | null; date: string;
      noticeType: NoticeKind; expectedTime: string; reason: string };

const MAX_DAYS = 60;

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dateKeyOf(d);
}

// ── GET — everything an admin should know is coming up ────────────────────────
// Planned leave (approved + pending) and early-leave / late-arrival notices for today
// onwards. Admins see the whole team; employees see only their own.

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const today = getISTDateString();
  const days  = Math.min(MAX_DAYS, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 14));
  const until = addDays(today, days - 1);
  const from  = new Date(`${today}T00:00:00.000Z`);
  const to    = new Date(`${until}T23:59:59.999Z`);
  const mine  = user.role !== 'ADMIN';
  const userSelect = { id: true, name: true, avatarUrl: true, designation: true } as const;

  try {
    const [leaves, notices] = await Promise.all([
      prisma.leave.findMany({
        where: {
          status:   { in: ['APPROVED', 'PENDING'] },
          fromDate: { lte: to },
          toDate:   { gte: from },
          user:     { isActive: true },
          ...(mine ? { userId: user.id } : {}),
        },
        include: { user: { select: userSelect } },
        orderBy: { fromDate: 'asc' },
      }),
      prisma.attendanceNotice.findMany({
        where: {
          isActive: true,
          date:     { gte: new Date(`${today}T12:00:00.000Z`), lte: new Date(`${until}T12:00:00.000Z`) },
          user:     { isActive: true },
          ...(mine ? { userId: user.id } : {}),
        },
        include: { user: { select: userSelect } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const items: HeadsUpItem[] = [];

    for (const l of leaves) {
      const fromKey = dateKeyOf(l.fromDate);
      const toKey   = dateKeyOf(l.toDate);
      // One item per leave (anchored at its first visible day) — the range is carried along.
      const firstVisible = fromKey > today ? fromKey : today;
      if (dayKeysBetween(firstVisible, toKey, today, until).length === 0) continue;
      items.push({
        kind: 'LEAVE', id: l.id, userId: l.userId, name: l.user.name, avatarUrl: l.user.avatarUrl,
        designation: l.user.designation, date: firstVisible,
        leaveType: l.type, status: l.status as 'APPROVED' | 'PENDING', reason: l.reason ?? null,
        fromDate: fromKey, toDate: toKey,
      });
    }

    for (const n of notices) {
      items.push({
        kind: 'NOTICE', id: n.id, userId: n.userId, name: n.user.name, avatarUrl: n.user.avatarUrl,
        designation: n.user.designation, date: dateKeyOf(n.date),
        noticeType: n.type as NoticeKind, expectedTime: n.expectedTime, reason: n.reason,
      });
    }

    items.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'NOTICE' ? -1 : 1));

    return NextResponse.json({ data: { today, until, items } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
