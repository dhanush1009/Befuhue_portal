import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { taskVisibilityFilter } from '@/lib/taskVisibility';
import { getISTDateString } from '@/lib/attendance';
import { addDaysKey, fillDays } from '@/lib/meta/metrics';

const PIPELINE = ['TO_DO', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'DONE'] as const;

/** The IST calendar day (yyyy-MM-dd) a moment falls on. */
function istDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ── GET - what the redesigned dashboard charts need ───────────────────────────
// Admins see the whole workspace; everyone else only the tasks they are on.

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const isAdmin = user.role === 'ADMIN';
  const today = getISTDateString();
  const from14 = addDaysKey(today, -13);
  const from7 = addDaysKey(today, -6);
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const since14 = new Date(`${from14}T00:00:00+05:30`);

  const scope: Prisma.TaskWhereInput = {
    deletedAt: { isSet: false },
    ...(isAdmin ? {} : { AND: [{ OR: [{ assigneeId: user.id }, { participants: { some: { userId: user.id } } }] }] }),
    ...taskVisibilityFilter(user.id, user.role),
  };

  try {
    const [byStatus, overdue, dueThisWeek, closedRows, createdRows, attendanceRows, myOpen] = await Promise.all([
      prisma.task.groupBy({ by: ['status'], where: { ...scope, status: { in: [...PIPELINE] } }, _count: { _all: true } }),
      prisma.task.count({ where: { ...scope, dueDate: { lt: now }, status: { notIn: ['DONE', 'CLOSED'] } } }),
      prisma.task.count({ where: { ...scope, dueDate: { gte: now, lte: weekAhead }, status: { notIn: ['DONE', 'CLOSED'] } } }),
      prisma.task.findMany({ where: { ...scope, closedAt: { gte: since14 } }, select: { closedAt: true } }),
      prisma.task.findMany({ where: { ...scope, createdAt: { gte: since14 } }, select: { createdAt: true } }),
      prisma.attendance.findMany({
        where: { date: { gte: new Date(`${from7}T00:00:00Z`) }, sessions: { some: {} } },
        select: { date: true },
      }),
      prisma.task.count({
        where: {
          deletedAt: { isSet: false }, status: { notIn: ['DONE', 'CLOSED'] },
          OR: [{ assigneeId: user.id }, { participants: { some: { userId: user.id } } }],
        },
      }),
    ]);

    const statusCounts = Object.fromEntries(PIPELINE.map((s) => [s, 0])) as Record<(typeof PIPELINE)[number], number>;
    for (const r of byStatus) statusCounts[r.status as (typeof PIPELINE)[number]] = r._count._all;

    const bucket = (dates: (Date | null)[], days: string[], key: (d: Date) => string) => {
      const m = new Map(days.map((d) => [d, 0]));
      for (const d of dates) if (d) { const k = key(d); if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1); }
      return days.map((date) => ({ date, count: m.get(date) ?? 0 }));
    };
    const days14 = fillDays(from14, today);
    const days7 = fillDays(from7, today);

    return NextResponse.json({
      data: {
        scope: isAdmin ? 'workspace' : 'mine',
        taskStatus: statusCounts,
        overdue, dueThisWeek, myOpen,
        closedByDay:  bucket(closedRows.map((r) => r.closedAt), days14, istDay),
        createdByDay: bucket(createdRows.map((r) => r.createdAt), days14, istDay),
        presenceByDay: bucket(attendanceRows.map((r) => r.date), days7, (d) => d.toISOString().slice(0, 10)),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
