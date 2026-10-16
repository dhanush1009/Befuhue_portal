import { NextRequest, NextResponse } from 'next/server';
import type { Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { calculateTaskScore } from '@/lib/taskScoring';
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const COMPLETED_STATUSES: TaskStatus[] = ['DONE', 'CLOSED', 'VERIFIED'];

/** Returns the IST calendar date string (yyyy-MM-dd) for a given moment. */
function istDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Get start Date in IST for a given date range filter */
function getISTStartOf(range: string): Date | null {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const dayOfWeek = ist.getUTCDay(); // 0 = Sun, 1 = Mon

  switch (range) {
    case 'today':
      return new Date(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+05:30`);
    case 'this_week': {
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const monday = new Date(ist);
      monday.setUTCDate(d + diffToMonday);
      const my = monday.getUTCFullYear();
      const mm = monday.getUTCMonth();
      const md = monday.getUTCDate();
      return new Date(`${my}-${String(mm + 1).padStart(2, '0')}-${String(md).padStart(2, '0')}T00:00:00+05:30`);
    }
    case 'this_month':
      return new Date(`${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00+05:30`);
    case 'this_year':
      return new Date(`${y}-01-01T00:00:00+05:30`);
    case 'all_time':
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const isAdmin = user.role === 'ADMIN';
  const url = new URL(req.url);
  const requestedView = url.searchParams.get('view'); // 'team' | 'employee'
  const range = url.searchParams.get('range') || (isAdmin ? 'this_month' : 'all_time');
  const timeframe = (url.searchParams.get('timeframe') || 'daily') as 'daily' | 'weekly' | 'monthly';

  // Strict access control: only admins can request team view
  if (requestedView === 'team' && !isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Only administrators can view team task completion statistics.' },
      { status: 403 },
    );
  }

  const activeView = isAdmin && requestedView !== 'employee' ? 'team' : 'employee';
  const startDate = getISTStartOf(range);

  try {
    if (activeView === 'team') {
      // ── Admin Dashboard: Combined column chart for all employees ─────────────
      // 1. Fetch active employees and completed tasks concurrently
      const [employees, tasks] = await Promise.all([
        prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, avatarUrl: true, designation: true },
          orderBy: { name: 'asc' },
        }),
        prisma.task.findMany({
          where: {
            deletedAt: { isSet: false },
            status: { in: COMPLETED_STATUSES },
          },
          select: {
            id: true,
            assigneeId: true,
            doneById: true,
            closedById: true,
            doneAt: true,
            closedAt: true,
            verifiedAt: true,
            updatedAt: true,
            dueDate: true,
            createdAt: true,
            participants: { select: { userId: true } },
          },
        }),
      ]);

      // 3. Filter by completion date and aggregate counts per employee
      const statsMap = new Map<
        string,
        {
          completedCount: number;
          earlyCount: number;
          onTimeCount: number;
          lateCount: number;
          totalPoints: number;
        }
      >();

      for (const emp of employees) {
        statsMap.set(emp.id, {
          completedCount: 0,
          earlyCount: 0,
          onTimeCount: 0,
          lateCount: 0,
          totalPoints: 0,
        });
      }

      let totalCompleted = 0;
      let totalEarly = 0;
      let totalOnTime = 0;
      let totalLate = 0;

      for (const t of tasks) {
        const completedAt = t.doneAt ?? t.closedAt ?? t.verifiedAt ?? t.updatedAt;
        if (startDate && completedAt < startDate) continue;

        // Count each task exactly once. Attribute to primary owner
        const ownerId = t.assigneeId ?? t.doneById ?? t.closedById ?? t.participants[0]?.userId;
        if (!ownerId || !statsMap.has(ownerId)) continue;

        totalCompleted += 1;
        const empStats = statsMap.get(ownerId)!;
        empStats.completedCount += 1;

        const score = calculateTaskScore(completedAt, t.dueDate, t.createdAt);
        if (score) {
          empStats.totalPoints += score.points;
          if (score.outcome === 'EARLY') {
            empStats.earlyCount += 1;
            totalEarly += 1;
          } else if (score.outcome === 'ON_TIME') {
            empStats.onTimeCount += 1;
            totalOnTime += 1;
          } else {
            empStats.lateCount += 1;
            totalLate += 1;
          }
        }
      }

      const chartData = employees.map((emp) => {
        const st = statsMap.get(emp.id)!;
        return {
          employeeId: emp.id,
          name: emp.name,
          avatarUrl: emp.avatarUrl,
          designation: emp.designation,
          completedCount: st.completedCount,
          earlyCount: st.earlyCount,
          onTimeCount: st.onTimeCount,
          lateCount: st.lateCount,
          totalPoints: st.totalPoints,
        };
      });

      return NextResponse.json({
        data: {
          view: 'team',
          range,
          totalCompleted,
          totalEarly,
          totalOnTime,
          totalLate,
          chartData,
        },
      });
    }

    // ── Employee Dashboard: Column chart showing completed tasks over time ─────
    // Fetch only the logged-in employee's completed tasks
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: { isSet: false },
        status: { in: COMPLETED_STATUSES },
        OR: [
          { assigneeId: user.id },
          { doneById: user.id },
          { participants: { some: { userId: user.id } } },
        ],
      },
      select: {
        id: true,
        doneAt: true,
        closedAt: true,
        verifiedAt: true,
        updatedAt: true,
        dueDate: true,
        createdAt: true,
      },
    });

    // Map tasks to their actual completion date and scored item
    const scoredTasks = tasks.map((t) => {
      const compDate = t.doneAt ?? t.closedAt ?? t.verifiedAt ?? t.updatedAt;
      const score = calculateTaskScore(compDate, t.dueDate, t.createdAt);
      return { compDate, score };
    });

    // Optional range filter applied to totalCompleted
    const filteredByRange = startDate
      ? scoredTasks.filter((d) => d.compDate >= startDate)
      : scoredTasks;
    const totalCompleted = filteredByRange.length;

    // Timeframe buckets (daily, weekly, monthly)
    const now = new Date();
    let buckets: {
      label: string;
      fullDate: string;
      completedCount: number;
      earlyCount: number;
      onTimeCount: number;
      lateCount: number;
    }[] = [];

    if (timeframe === 'daily') {
      // Last 14 days
      const days: { label: string; dateStr: string; start: Date; end: Date }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = subDays(now, i);
        const dateStr = istDay(d);
        const label = format(d, 'EEE d');
        const start = new Date(`${dateStr}T00:00:00+05:30`);
        const end = new Date(`${dateStr}T23:59:59.999+05:30`);
        days.push({ label, dateStr, start, end });
      }

      buckets = days.map((day) => {
        let count = 0;
        let early = 0;
        let onTime = 0;
        let late = 0;
        for (const t of scoredTasks) {
          if (t.compDate >= day.start && t.compDate <= day.end) {
            count++;
            if (t.score?.outcome === 'EARLY') early++;
            else if (t.score?.outcome === 'ON_TIME') onTime++;
            else late++;
          }
        }
        return {
          label: day.label,
          fullDate: day.dateStr,
          completedCount: count,
          earlyCount: early,
          onTimeCount: onTime,
          lateCount: late,
        };
      });
    } else if (timeframe === 'weekly') {
      // Last 8 weeks
      const weeks: { label: string; dateStr: string; start: Date; end: Date }[] = [];
      for (let i = 7; i >= 0; i--) {
        const d = subWeeks(now, i);
        const wStart = startOfWeek(d, { weekStartsOn: 1 });
        const wEnd = endOfWeek(d, { weekStartsOn: 1 });
        const label = `${format(wStart, 'MMM d')} - ${format(wEnd, 'd')}`;
        weeks.push({ label, dateStr: format(wStart, 'yyyy-MM-dd'), start: wStart, end: wEnd });
      }

      buckets = weeks.map((w) => {
        let count = 0;
        let early = 0;
        let onTime = 0;
        let late = 0;
        for (const t of scoredTasks) {
          if (t.compDate >= w.start && t.compDate <= w.end) {
            count++;
            if (t.score?.outcome === 'EARLY') early++;
            else if (t.score?.outcome === 'ON_TIME') onTime++;
            else late++;
          }
        }
        return {
          label: w.label,
          fullDate: w.dateStr,
          completedCount: count,
          earlyCount: early,
          onTimeCount: onTime,
          lateCount: late,
        };
      });
    } else {
      // Last 6 months
      const months: { label: string; dateStr: string; start: Date; end: Date }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i);
        const mStart = startOfMonth(d);
        const mEnd = endOfMonth(d);
        const label = format(d, 'MMM yyyy');
        months.push({ label, dateStr: format(mStart, 'yyyy-MM-dd'), start: mStart, end: mEnd });
      }

      buckets = months.map((m) => {
        let count = 0;
        let early = 0;
        let onTime = 0;
        let late = 0;
        for (const t of scoredTasks) {
          if (t.compDate >= m.start && t.compDate <= m.end) {
            count++;
            if (t.score?.outcome === 'EARLY') early++;
            else if (t.score?.outcome === 'ON_TIME') onTime++;
            else late++;
          }
        }
        return {
          label: m.label,
          fullDate: m.dateStr,
          completedCount: count,
          earlyCount: early,
          onTimeCount: onTime,
          lateCount: late,
        };
      });
    }

    return NextResponse.json({
      data: {
        view: 'employee',
        timeframe,
        range,
        totalCompleted,
        employeeName: user.name,
        chartData: buckets,
      },
    });
  } catch (err) {
    console.error('Task completion stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
