import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getHolidayMap } from '@/lib/holidaysDb';
import { requireAuth } from '@/lib/requireAuth';
import { calculateCompletedMinutes, getFirstClockIn, getLastClockOut, isCurrentlyActive, getISTDateString } from '@/lib/attendance';
import {
  buildMonthDays, computeDayStatus, dateKeyOf, dayKeysBetween, monthKey, parseMonthParam, summarizeMonth,
  type DayStatus, type NoticeKind,
} from '@/lib/timeline';

export interface TimelineCell {
  status:       DayStatus | null; // null = before the person joined
  workedMins:   number;
  sessionCount: number;
  firstIn:      string | null;
  lastOut:      string | null;
  leave:        { type: string; status: 'APPROVED' | 'PENDING'; reason: string | null } | null;
  holiday:      string | null; // name of the company holiday, if any
  notices:      { id: string; type: NoticeKind; expectedTime: string; reason: string }[];
}

// ── GET — month grid for the whole team (admin only) ──────────────────────────

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const todayKey = getISTDateString();
  const parsed   = parseMonthParam(req.nextUrl.searchParams.get('month')) ?? parseMonthParam(todayKey.slice(0, 7))!;
  const { year, month } = parsed;

  const days     = buildMonthDays(year, month);
  const firstKey = days[0].dateKey;
  const lastKey  = days[days.length - 1].dateKey;
  const rangeFrom = new Date(`${firstKey}T00:00:00.000Z`);
  const rangeTo   = new Date(`${lastKey}T23:59:59.999Z`);

  try {
    const holidays = await getHolidayMap(rangeFrom, rangeTo);
    const [employees, attendance, leaves, notices] = await Promise.all([
      prisma.user.findMany({
        where:   { isActive: true },
        select:  { id: true, name: true, designation: true, avatarUrl: true, role: true, attendanceMode: true, joiningDate: true },
        orderBy: { name: 'asc' },
      }),
      prisma.attendance.findMany({
        where:   { date: { gte: rangeFrom, lte: rangeTo } },
        include: { sessions: { orderBy: { clockIn: 'asc' } } },
      }),
      prisma.leave.findMany({
        where: {
          status:   { in: ['APPROVED', 'PENDING'] },
          fromDate: { lte: rangeTo },
          toDate:   { gte: rangeFrom },
        },
        select: { userId: true, type: true, status: true, reason: true, fromDate: true, toDate: true },
      }),
      prisma.attendanceNotice.findMany({
        where:  { isActive: true, date: { gte: rangeFrom, lte: rangeTo } },
        select: { id: true, userId: true, date: true, type: true, expectedTime: true, reason: true },
      }),
    ]);

    // Index everything by "userId|dateKey" for O(1) lookups while building the grid.
    const attByKey = new Map(attendance.map((a) => [`${a.userId}|${dateKeyOf(a.date)}`, a]));

    const leaveByKey = new Map<string, { type: string; status: 'APPROVED' | 'PENDING'; reason: string | null }>();
    for (const l of leaves) {
      const status = l.status as 'APPROVED' | 'PENDING';
      for (const k of dayKeysBetween(dateKeyOf(l.fromDate), dateKeyOf(l.toDate), firstKey, lastKey)) {
        const key = `${l.userId}|${k}`;
        const cur = leaveByKey.get(key);
        // Approved outranks pending when ranges overlap.
        if (!cur || (cur.status === 'PENDING' && status === 'APPROVED')) {
          leaveByKey.set(key, { type: l.type, status, reason: l.reason ?? null });
        }
      }
    }

    const noticesByKey = new Map<string, TimelineCell['notices']>();
    for (const n of notices) {
      const key = `${n.userId}|${dateKeyOf(n.date)}`;
      const list = noticesByKey.get(key) ?? [];
      list.push({ id: n.id, type: n.type as NoticeKind, expectedTime: n.expectedTime, reason: n.reason });
      noticesByKey.set(key, list);
    }

    const members = employees.map((emp) => {
      const joinedKey = emp.joiningDate ? dateKeyOf(emp.joiningDate) : null;
      const anywhere  = emp.attendanceMode === 'ANYWHERE';

      const cells: TimelineCell[] = days.map((d) => {
        const key = `${emp.id}|${d.dateKey}`;
        const att      = attByKey.get(key);
        const sessions = att?.sessions ?? [];
        const leave    = leaveByKey.get(key) ?? null;
        const dayNotices = noticesByKey.get(key) ?? [];

        if (joinedKey && d.dateKey < joinedKey) {
          return { status: null, workedMins: 0, sessionCount: 0, firstIn: null, lastOut: null, leave: null, holiday: null, notices: [] };
        }

        const workedMins = calculateCompletedMinutes(sessions);
        const status = computeDayStatus({
          dateKey:        d.dateKey,
          todayKey,
          isSunday:       d.isSunday,
          workedMins,
          sessionCount:   sessions.length,
          isActive:       isCurrentlyActive(sessions),
          attendanceType: (att?.type ?? null) as 'OFFICE' | 'WFH' | 'HALF_DAY' | null,
          leaveStatus:    leave?.status ?? null,
          anywhere,
          holiday:        holidays.has(d.dateKey),
        });

        return {
          status,
          workedMins,
          sessionCount: sessions.length,
          firstIn:      getFirstClockIn(sessions)?.toISOString() ?? null,
          lastOut:      getLastClockOut(sessions)?.toISOString() ?? null,
          leave,
          holiday:      holidays.get(d.dateKey)?.name ?? null,
          notices:      dayNotices,
        };
      });

      const summary = summarizeMonth(
        cells.flatMap((c, i) => c.status === null ? [] : [{
          dateKey: days[i].dateKey, isSunday: days[i].isSunday, status: c.status,
          workedMins: c.workedMins, notices: c.notices,
        }]),
        todayKey,
      );

      return {
        userId:         emp.id,
        name:           emp.name,
        designation:    emp.designation,
        avatarUrl:      emp.avatarUrl,
        role:           emp.role,
        attendanceMode: emp.attendanceMode ?? 'CLOCK_IN',
        summary,
        cells,
      };
    });

    return NextResponse.json({
      data: {
        month: monthKey(year, month), todayKey, days, members,
        holidays: Object.fromEntries([...holidays].filter(([k]) => k >= firstKey && k <= lastKey).map(([k, v]) => [k, v.name])),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
