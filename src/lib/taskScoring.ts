export type ScoringOutcome = 'EARLY' | 'ON_TIME' | 'LATE';

export interface TaskScore {
  points: number;
  outcome: ScoringOutcome;
  completionDate: Date;
  deadlineDate: Date | null;
}

/**
 * Calculates task completion points based on strict deadline comparison:
 * - 2 points: Completed BEFORE the assigned deadline.
 * - 1 point: Completed EXACTLY at the assigned deadline (matched to the minute).
 * - 0 points: Completed AFTER the assigned deadline.
 *
 * Comparisons use standard UTC epoch milliseconds, making the calculation
 * completely timezone-invariant.
 */
export function calculateTaskScore(
  completionTimestamp: Date | string | null | undefined,
  deadline: Date | string | null | undefined,
  createdAt?: Date | string | null | undefined,
): TaskScore | null {
  if (!completionTimestamp) return null;
  const comp = new Date(completionTimestamp);
  if (isNaN(comp.getTime())) return null;

  if (!deadline) {
    // If no deadline was specified, task is awarded full early completion points (2 points)
    return {
      points: 2,
      outcome: 'EARLY',
      completionDate: comp,
      deadlineDate: null,
    };
  }

  const dead = new Date(deadline);
  if (isNaN(dead.getTime())) {
    return {
      points: 2,
      outcome: 'EARLY',
      completionDate: comp,
      deadlineDate: null,
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
    };
  } else if (compMinute === deadMinute) {
    return {
      points: 1,
      outcome: 'ON_TIME',
      completionDate: comp,
      deadlineDate: dead,
    };
  } else {
    return {
      points: 0,
      outcome: 'LATE',
      completionDate: comp,
      deadlineDate: dead,
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
