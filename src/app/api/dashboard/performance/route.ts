import { NextRequest, NextResponse } from 'next/server';
import type { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { calculateTaskScore, rankEmployees, type EmployeeRankItem } from '@/lib/taskScoring';
import {
  format,
  subDays,
  subWeeks,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

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

  // Strict access control: only admins can request full team view
  if (requestedView === 'team' && !isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Only administrators can view team performance leaderboard.' },
      { status: 403 },
    );
  }

  const activeView = isAdmin && requestedView !== 'employee' ? 'team' : 'employee';
  const startDate = getISTStartOf(range);

  try {
    // 1. Fetch active employees and tasks concurrently
    const [employees, allTasks] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, avatarUrl: true, designation: true },
        orderBy: { name: 'asc' },
      }),
      prisma.task.findMany({
        where: { deletedAt: { isSet: false } },
        select: {
          id: true,
          title: true,
          status: true,
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

    // 3. Compute per-employee statistics
    const statsMap = new Map<
      string,
      {
        totalAssigned: number;
        totalCompleted: number;
        totalPoints: number;
        earlyCount: number;
        onTimeCount: number;
        lateCount: number;
        onTimeAndEarlyCount: number;
      }
    >();

    for (const emp of employees) {
      statsMap.set(emp.id, {
        totalAssigned: 0,
        totalCompleted: 0,
        totalPoints: 0,
        earlyCount: 0,
        onTimeCount: 0,
        lateCount: 0,
        onTimeAndEarlyCount: 0,
      });
    }

    // Process tasks: count assigned tasks and score completed tasks
    for (const task of allTasks) {
      const ownerId =
        task.assigneeId ??
        task.doneById ??
        task.closedById ??
        (task.participants.length > 0 ? task.participants[0].userId : null);

      if (!ownerId || !statsMap.has(ownerId)) continue;

      const empStats = statsMap.get(ownerId)!;
      empStats.totalAssigned += 1;

      // Check if task is completed
      if (COMPLETED_STATUSES.includes(task.status)) {
        const completionTimestamp = task.doneAt ?? task.closedAt ?? task.verifiedAt ?? task.updatedAt;

        // Apply date range filter to completed tasks
        if (startDate && completionTimestamp < startDate) {
          continue;
        }

        const score = calculateTaskScore(completionTimestamp, task.dueDate, task.createdAt);
        if (score) {
          empStats.totalCompleted += 1;
          empStats.totalPoints += score.points;

          if (score.outcome === 'EARLY') {
            empStats.earlyCount += 1;
            empStats.onTimeAndEarlyCount += 1;
          } else if (score.outcome === 'ON_TIME') {
            empStats.onTimeCount += 1;
            empStats.onTimeAndEarlyCount += 1;
          } else {
            empStats.lateCount += 1;
          }
        }
      }
    }

    // Generate ranked leaderboard
    const unrankedList: Omit<EmployeeRankItem, 'rank' | 'rankDisplay' | 'isTied' | 'isTopPerformer'>[] =
      employees.map((emp) => {
        const s = statsMap.get(emp.id)!;
        return {
          employeeId: emp.id,
          name: emp.name,
          avatarUrl: emp.avatarUrl,
          designation: emp.designation,
          ...s,
        };
      });

    const leaderboard = rankEmployees(unrankedList);
    const topPerformer = leaderboard.find((item) => item.isTopPerformer) ?? leaderboard[0] ?? null;

    if (activeView === 'team') {
      // ── Admin View: Full leaderboard, top performer, and combined points chart ──
      // Deduplicate names for chart display if needed
      const nameCounts = new Map<string, number>();
      const chartData = leaderboard.map((emp) => {
        const baseName = emp.name || 'Unknown';
        const count = nameCounts.get(baseName) ?? 0;
        nameCounts.set(baseName, count + 1);
        const displayName = count > 0 ? `${baseName} (${count + 1})` : baseName;
        return {
          employeeId: emp.employeeId,
          name: emp.name,
          displayName,
          avatarUrl: emp.avatarUrl,
          designation: emp.designation,
          totalPoints: emp.totalPoints,
          totalCompleted: emp.totalCompleted,
          earlyCount: emp.earlyCount,
          onTimeCount: emp.onTimeCount,
          lateCount: emp.lateCount,
          rankDisplay: emp.rankDisplay,
        };
      });

      return NextResponse.json({
        data: {
          view: 'team',
          range,
          topPerformer,
          leaderboard,
          chartData,
          totalTeamPoints: leaderboard.reduce((acc, cur) => acc + cur.totalPoints, 0),
          totalTeamCompleted: leaderboard.reduce((acc, cur) => acc + cur.totalCompleted, 0),
        },
      });
    }

    // ── Employee View: Strictly scoped to the current user ──────────────────────
    const myRankItem = leaderboard.find((item) => item.employeeId === user.id);
    const myPerformance = myRankItem ?? {
      employeeId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      designation: null,
      totalAssigned: 0,
      totalCompleted: 0,
      totalPoints: 0,
      earlyCount: 0,
      onTimeCount: 0,
      lateCount: 0,
      onTimeAndEarlyCount: 0,
      rank: leaderboard.length,
      rankDisplay: `#${leaderboard.length}`,
      isTied: false,
      isTopPerformer: false,
    };

    // Employee's tasks for points progression over time
    const userCompletedTasks = allTasks.filter((t) => {
      if (!COMPLETED_STATUSES.includes(t.status)) return false;
      const isOwner =
        t.assigneeId === user.id ||
        t.doneById === user.id ||
        t.closedById === user.id ||
        t.participants.some((p) => p.userId === user.id);
      return isOwner;
    });

    const now = new Date();
    let timeBuckets: {
      label: string;
      fullDate: string;
      pointsEarned: number;
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

      timeBuckets = days.map((day) => {
        let pts = 0;
        let comp = 0;
        let early = 0;
        let onTime = 0;
        let late = 0;

        for (const t of userCompletedTasks) {
          const compDate = t.doneAt ?? t.closedAt ?? t.verifiedAt ?? t.updatedAt;
          if (compDate >= day.start && compDate <= day.end) {
            const sc = calculateTaskScore(compDate, t.dueDate, t.createdAt);
            if (sc) {
              pts += sc.points;
              comp += 1;
              if (sc.outcome === 'EARLY') early += 1;
              else if (sc.outcome === 'ON_TIME') onTime += 1;
              else late += 1;
            }
          }
        }

        return {
          label: day.label,
          fullDate: day.dateStr,
          pointsEarned: pts,
          completedCount: comp,
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

      timeBuckets = weeks.map((w) => {
        let pts = 0;
        let comp = 0;
        let early = 0;
        let onTime = 0;
        let late = 0;

        for (const t of userCompletedTasks) {
          const compDate = t.doneAt ?? t.closedAt ?? t.verifiedAt ?? t.updatedAt;
          if (compDate >= w.start && compDate <= w.end) {
            const sc = calculateTaskScore(compDate, t.dueDate, t.createdAt);
            if (sc) {
              pts += sc.points;
              comp += 1;
              if (sc.outcome === 'EARLY') early += 1;
              else if (sc.outcome === 'ON_TIME') onTime += 1;
              else late += 1;
            }
          }
        }

        return {
          label: w.label,
          fullDate: w.dateStr,
          pointsEarned: pts,
          completedCount: comp,
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

      timeBuckets = months.map((m) => {
        let pts = 0;
        let comp = 0;
        let early = 0;
        let onTime = 0;
        let late = 0;

        for (const t of userCompletedTasks) {
          const compDate = t.doneAt ?? t.closedAt ?? t.verifiedAt ?? t.updatedAt;
          if (compDate >= m.start && compDate <= m.end) {
            const sc = calculateTaskScore(compDate, t.dueDate, t.createdAt);
            if (sc) {
              pts += sc.points;
              comp += 1;
              if (sc.outcome === 'EARLY') early += 1;
              else if (sc.outcome === 'ON_TIME') onTime += 1;
              else late += 1;
            }
          }
        }

        return {
          label: m.label,
          fullDate: m.dateStr,
          pointsEarned: pts,
          completedCount: comp,
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
        myPerformance: {
          ...myPerformance,
          totalEmployees: employees.length,
        },
        chartData: timeBuckets,
      },
    });
  } catch (err) {
    console.error('Performance API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
