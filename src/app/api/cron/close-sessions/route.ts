import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getISTMidnight } from '@/lib/attendance';
import { differenceInMinutes } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/close-sessions
 *
 * Auto-closes any attendance sessions that are still open from previous IST days.
 * Schedule at 00:05 IST = 18:35 UTC (previous day).
 *
 * Vercel Cron (vercel.json):
 *   { "path": "/api/cron/close-sessions", "schedule": "35 18 * * *" }
 *
 * Protected by CRON_SECRET env variable.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now      = new Date();
  const todayIST = getISTMidnight(now);

  try {
    // Find all open sessions belonging to attendance records before today (IST)
    const openSessions = await prisma.attendanceSession.findMany({
      where: {
        clockOut: null,
        attendance: { date: { lt: todayIST } },
      },
      include: {
        attendance: { select: { date: true } },
      },
    });

    if (openSessions.length === 0) {
      return NextResponse.json({ closed: 0, message: 'No open sessions to close.' });
    }

    await Promise.all(
      openSessions.map((session) => {
        // Close at IST midnight that ended that attendance day
        const sessionDate    = new Date(session.attendance.date);
        const istMidnightEnd = getISTMidnight(
          new Date(sessionDate.getTime() + 24 * 60 * 60 * 1000),
        );
        // Never set clockOut in the future
        const clockOutTime   = istMidnightEnd < now ? istMidnightEnd : now;
        const durationMins   = Math.max(0, differenceInMinutes(clockOutTime, new Date(session.clockIn)));

        return prisma.attendanceSession.update({
          where: { id: session.id },
          data: {
            clockOut:     clockOutTime,
            durationMins,
            note:         'Auto-closed at IST midnight by system',
          },
        });
      }),
    );

    return NextResponse.json({
      closed:  openSessions.length,
      message: `Auto-closed ${openSessions.length} open session(s).`,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
