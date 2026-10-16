export type ScoringOutcome = 'EARLY' | 'ON_TIME' | 'LATE';

export interface TaskScore {
  points: number;
  outcome: ScoringOutcome;
  completionDate: Date;
  deadlineDate: Date | null;
  timeTakenMinutes?: number | null;
  estimatedMinutes?: number | null;
}

export interface TaskScoreOptions {
  timeTakenMinutes?: number | null;
  estimatedMinutes?: number | null;
  storedPoints?: number | null;
  storedOutcome?: ScoringOutcome | string | null;
}

/**
 * Calculates employee performance points based on task completion time:
 * When an employee moves a task to "In Progress", the timer starts.
 * When they move it to "Internal Review", the timer stops.
 *
 * Scoring rules:
 * - If estimatedMinutes is defined (> 0):
 *   - timeTakenMinutes < estimatedMinutes: 2 points (EARLY)
 *   - timeTakenMinutes === estimatedMinutes: 1 point (ON_TIME)
 *   - timeTakenMinutes > estimatedMinutes: 0 points (LATE / OVERTIME)
 * - Else if deadline is defined:
 *   - completed before deadline: 2 points (EARLY)
 *   - completed at deadline: 1 point (ON_TIME)
 *   - completed after deadline: 0 points (LATE / OVERTIME)
 * - Else (no estimate or deadline):
 *   - 2 points (EARLY)
 */
export function calculatePerformanceFromTimer(
  timeTakenMinutes?: number | null,
  estimatedMinutes?: number | null,
  deadline?: Date | string | null,
  completionTimestamp?: Date | string | null,
): { points: number; outcome: ScoringOutcome } {
  if (estimatedMinutes != null && estimatedMinutes > 0 && timeTakenMinutes != null && timeTakenMinutes >= 0) {
    if (timeTakenMinutes < estimatedMinutes) {
      return { points: 2, outcome: 'EARLY' };
    } else if (timeTakenMinutes === estimatedMinutes) {
      return { points: 1, outcome: 'ON_TIME' };
    } else {
      return { points: 0, outcome: 'LATE' };
    }
  }

  // Fallback to deadline if available
  if (deadline && completionTimestamp) {
    const comp = new Date(completionTimestamp);
    const score = calculateTaskScore(comp, deadline);
    if (score) {
      return { points: score.points, outcome: score.outcome };
    }
  }

  return { points: 2, outcome: 'EARLY' };
}

/**
 * Calculates task completion points based on timer duration or strict deadline comparison:
 * - 2 points: Completed BEFORE the estimated effort / deadline.
 * - 1 point: Completed EXACTLY at the estimated effort / deadline.
 * - 0 points: Completed AFTER the estimated effort / deadline (Overtime).
 */
export function calculateTaskScore(
  completionTimestamp: Date | string | null | undefined,
  deadline: Date | string | null | undefined,
  createdAt?: Date | string | null | undefined,
  options?: TaskScoreOptions,
): TaskScore | null {
  if (!completionTimestamp) return null;
  const comp = new Date(completionTimestamp);
  if (isNaN(comp.getTime())) return null;

  // 1. If points were already explicitly calculated & stored, respect the stored score
  if (options?.storedPoints != null) {
    const rawOutcome = String(options.storedOutcome || '').toUpperCase();
    const outcome: ScoringOutcome =
      rawOutcome === 'ON_TIME'
        ? 'ON_TIME'
        : rawOutcome === 'LATE' || rawOutcome === 'OVERTIME'
        ? 'LATE'
        : 'EARLY';

    return {
      points: options.storedPoints,
      outcome,
      completionDate: comp,
      deadlineDate: deadline ? new Date(deadline) : null,
      timeTakenMinutes: options.timeTakenMinutes ?? null,
      estimatedMinutes: options.estimatedMinutes ?? null,
    };
  }

  // 2. If time taken and estimated effort are provided, evaluate performance from timer
  if (
    options?.estimatedMinutes != null &&
    options.estimatedMinutes > 0 &&
    options?.timeTakenMinutes != null &&
    options.timeTakenMinutes >= 0
  ) {
    const perf = calculatePerformanceFromTimer(
      options.timeTakenMinutes,
      options.estimatedMinutes,
      deadline,
      comp,
    );
    return {
      points: perf.points,
      outcome: perf.outcome,
      completionDate: comp,
      deadlineDate: deadline ? new Date(deadline) : null,
      timeTakenMinutes: options.timeTakenMinutes,
      estimatedMinutes: options.estimatedMinutes,
    };
  }

  // 3. Fallback to deadline date & time comparison
  if (!deadline) {
    // If no deadline was specified, task is awarded full early completion points (2 points)
    return {
      points: 2,
      outcome: 'EARLY',
      completionDate: comp,
      deadlineDate: null,
      timeTakenMinutes: options?.timeTakenMinutes ?? null,
      estimatedMinutes: options?.estimatedMinutes ?? null,
    };
  }

  const dead = new Date(deadline);
  if (isNaN(dead.getTime())) {
    return {
      points: 2,
      outcome: 'EARLY',
      completionDate: comp,
      deadlineDate: null,
      timeTakenMinutes: options?.timeTakenMinutes ?? null,
      estimatedMinutes: options?.estimatedMinutes ?? null,
    };
  }

  let effectiveDead = new Date(dead.getTime());

  // Check 1: Is deadline midnight (date-only)? (hours=0, minutes=0, seconds=0 in UTC or local)
  const isMidnightUTC =
    dead.getUTCHours() === 0 &&
    dead.getUTCMinutes() === 0 &&
    dead.getUTCSeconds() === 0;

  const isMidnightLocal =
    dead.getHours() === 0 &&
    dead.getMinutes() === 0 &&
    dead.getSeconds() === 0;

  if (isMidnightUTC || isMidnightLocal) {
    // A date without time means the deadline is the end of that calendar day
    const endOfUTC = new Date(dead);
    endOfUTC.setUTCHours(23, 59, 59, 999);
    const endOfLocal = new Date(dead);
    endOfLocal.setHours(23, 59, 59, 999);
    effectiveDead = new Date(Math.max(endOfUTC.getTime(), endOfLocal.getTime()));
  }

  // Compare at minute-level resolution
  const compMinute = Math.floor(comp.getTime() / 60000);
  const deadMinute = Math.floor(effectiveDead.getTime() / 60000);

  if (compMinute < deadMinute) {
    return {
      points: 2,
      outcome: 'EARLY',
      completionDate: comp,
      deadlineDate: dead,
      timeTakenMinutes: options?.timeTakenMinutes ?? null,
      estimatedMinutes: options?.estimatedMinutes ?? null,
    };
  } else if (compMinute === deadMinute) {
    return {
      points: 1,
      outcome: 'ON_TIME',
      completionDate: comp,
      deadlineDate: dead,
      timeTakenMinutes: options?.timeTakenMinutes ?? null,
      estimatedMinutes: options?.estimatedMinutes ?? null,
    };
  } else {
    return {
      points: 0,
      outcome: 'LATE',
      completionDate: comp,
      deadlineDate: dead,
      timeTakenMinutes: options?.timeTakenMinutes ?? null,
      estimatedMinutes: options?.estimatedMinutes ?? null,
    };
  }
}

export interface EmployeeRankItem {
  employeeId: string;
  name: string;
  avatarUrl: string | null;
  designation: string | null;
  totalAssigned: number;
  totalCompleted: number;
  totalPoints: number;
  earlyCount: number;
  onTimeCount: number;
  lateCount: number;
  onTimeAndEarlyCount: number;
  rank: number;
  rankDisplay: string;
  isTied: boolean;
  isTopPerformer: boolean;
}

/**
 * Ranks employees by total points descending.
 * Tie-breaker: on-time and early completions count.
 * If still tied, marks them as tied (e.g. "Tied #1", "Tied #2") with identical rank numbers.
 */
export function rankEmployees(
  rawList: Omit<EmployeeRankItem, 'rank' | 'rankDisplay' | 'isTied' | 'isTopPerformer'>[],
): EmployeeRankItem[] {
  const sorted = [...rawList].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    // Tie-breaker: on-time and early completions
    if (b.onTimeAndEarlyCount !== a.onTimeAndEarlyCount) {
      return b.onTimeAndEarlyCount - a.onTimeAndEarlyCount;
    }
    // Second tie-breaker: total completed tasks
    if (b.totalCompleted !== a.totalCompleted) {
      return b.totalCompleted - a.totalCompleted;
    }
    return a.name.localeCompare(b.name);
  });

  // Calculate ranks and tied statuses
  const results: EmployeeRankItem[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    let isTied = false;

    if (i > 0) {
      const prev = sorted[i - 1];
      const isSameScore =
        prev.totalPoints === item.totalPoints &&
        prev.onTimeAndEarlyCount === item.onTimeAndEarlyCount &&
        prev.totalCompleted === item.totalCompleted;

      if (isSameScore) {
        // Tied with previous
        isTied = true;
        results[i - 1].isTied = true;
        results[i - 1].rankDisplay = `Tied #${results[i - 1].rank}`;
      } else {
        currentRank = i + 1;
      }
    }

    const rankNum = isTied ? results[i - 1].rank : currentRank;
    const rankDisplay = isTied ? `Tied #${rankNum}` : `#${rankNum}`;

    results.push({
      ...item,
      rank: rankNum,
      rankDisplay,
      isTied,
      isTopPerformer: rankNum === 1 && item.totalPoints > 0,
    });
  }

  return results;
}
