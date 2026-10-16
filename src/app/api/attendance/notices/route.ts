import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { format } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { getISTDateString } from '@/lib/attendance';
import { dateKeyOf, formatNoticeTime, NOTICE_LABEL } from '@/lib/timeline';

const MAX_DAYS_AHEAD = 90;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  date:         z.string().regex(DAY_KEY, 'Date must be yyyy-MM-dd'),
  type:         z.enum(['LEAVING_EARLY', 'LATE_ARRIVAL']),
  expectedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm'),
  reason:       z.string().trim().min(3, 'Please add a short reason').max(300),
});

/** Stored form of a notice date: noon UTC of the IST day, same as Attendance.date. */
function storedDate(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

function isRealDay(key: string): boolean {
  const d = storedDate(key);
  return !Number.isNaN(d.getTime()) && dateKeyOf(d) === key;
}

function addDays(key: string, n: number): string {
  const d = storedDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dateKeyOf(d);
}

// ── GET — list notices in a date range ────────────────────────────────────────
// Admins see everyone's; employees only ever see their own.

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const sp       = req.nextUrl.searchParams;
  const today    = getISTDateString();
  const from     = sp.get('from') ?? today;
  const to       = sp.get('to')   ?? addDays(today, 60);

  if (!DAY_KEY.test(from) || !DAY_KEY.test(to) || !isRealDay(from) || !isRealDay(to)) {
    return NextResponse.json({ error: 'from and to must be valid yyyy-MM-dd dates' }, { status: 400 });
  }

  const onlyMine = user.role !== 'ADMIN' || sp.get('mine') === 'true';

  try {
    const rows = await prisma.attendanceNotice.findMany({
      where: {
        isActive: true,
        date:     { gte: storedDate(from), lte: storedDate(to) },
        ...(onlyMine ? { userId: user.id } : {}),
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true, designation: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    const data = rows.map((n) => ({
      id:           n.id,
      userId:       n.userId,
      user:         n.user,
      date:         dateKeyOf(n.date),
      type:         n.type,
      expectedTime: n.expectedTime,
      reason:       n.reason,
      createdAt:    n.createdAt,
    }));

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST — give a heads-up (for yourself) ─────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { date, type, expectedTime, reason } = parsed.data;
  const today = getISTDateString();

  if (!isRealDay(date))                  return NextResponse.json({ error: 'That is not a valid date.' }, { status: 400 });
  if (date < today)                      return NextResponse.json({ error: 'Heads-ups can only be given for today or a future day.' }, { status: 400 });
  if (date > addDays(today, MAX_DAYS_AHEAD)) {
    return NextResponse.json({ error: `Heads-ups can be given up to ${MAX_DAYS_AHEAD} days ahead.` }, { status: 400 });
  }
  if (storedDate(date).getUTCDay() === 0) {
    return NextResponse.json({ error: 'Sunday is a weekly off — nothing to give notice for.' }, { status: 400 });
  }

  try {
    const day = storedDate(date);
    // One notice per person, day and type — re-submitting edits it (and revives a cancelled one).
    const notice = await prisma.attendanceNotice.upsert({
      where:  { userId_date_type: { userId: user.id, date: day, type } },
      create: { userId: user.id, date: day, type, expectedTime, reason },
      update: { expectedTime, reason, isActive: true },
      include: { user: { select: { id: true, name: true, avatarUrl: true, designation: true } } },
    });

    // Tell the admins (fire-and-forget — a notification failure must not fail the request).
    const when = date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : format(day, 'EEE, d MMM');
    prisma.user.findMany({ where: { role: 'ADMIN', isActive: true, id: { not: user.id } }, select: { id: true } })
      .then((admins) => Promise.all(admins.map((a) =>
        createNotification(
          a.id,
          'ATTENDANCE_NOTICE',
          `${user.name}: ${NOTICE_LABEL[type].toLowerCase()} ${when}`,
          `${NOTICE_LABEL[type]} at ${formatNoticeTime(expectedTime)} — ${reason}`,
          '/attendance/team/timeline',
        ),
      )))
      .catch(() => {});

    return NextResponse.json({
      data: {
        id: notice.id, userId: notice.userId, user: notice.user, date,
        type: notice.type, expectedTime: notice.expectedTime, reason: notice.reason, createdAt: notice.createdAt,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
