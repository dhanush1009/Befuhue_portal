import { describe, it, expect } from 'vitest';
import { calculateTaskScore, rankEmployees } from './taskScoring';

describe('Task Scoring & Performance Calculation', () => {
  const deadline = new Date('2026-10-15T18:00:00.000Z');

  it('Case 1: awards 2 points when task is completed before the deadline (Early)', () => {
    const earlyCompletion = new Date('2026-10-15T17:45:00.000Z');
    const result = calculateTaskScore(earlyCompletion, deadline);

    expect(result).not.toBeNull();
    expect(result?.points).toBe(2);
    expect(result?.outcome).toBe('EARLY');
  });

  it('Case 2: awards 1 point when task is completed exactly at the deadline (On-Time)', () => {
    // Within the exact minute of the deadline
    const exactCompletion = new Date('2026-10-15T18:00:25.000Z');
    const result = calculateTaskScore(exactCompletion, deadline);

    expect(result).not.toBeNull();
    expect(result?.points).toBe(1);
    expect(result?.outcome).toBe('ON_TIME');
  });

  it('Case 3: awards 0 points when task is completed after the deadline (Late)', () => {
    const lateCompletion = new Date('2026-10-15T18:05:00.000Z');
    const result = calculateTaskScore(lateCompletion, deadline);

    expect(result).not.toBeNull();
    expect(result?.points).toBe(0);
    expect(result?.outcome).toBe('LATE');
  });

  it('awards 2 points when no deadline is set', () => {
    const completion = new Date('2026-10-15T12:00:00.000Z');
    const result = calculateTaskScore(completion, null);

    expect(result).not.toBeNull();
    expect(result?.points).toBe(2);
    expect(result?.outcome).toBe('EARLY');
  });

  it('awards 2 points (Early) for date-only midnight deadline completed during the due date', () => {
    // Due date was stored as midnight UTC (2026-10-15T00:00:00.000Z)
    const midnightDeadline = new Date('2026-10-15T00:00:00.000Z');
    const sameDayCompletion = new Date('2026-10-15T07:11:05.914Z');
    const result = calculateTaskScore(sameDayCompletion, midnightDeadline);

    expect(result).not.toBeNull();
    expect(result?.points).toBe(2);
    expect(result?.outcome).toBe('EARLY');
  });

  it('awards 0 points (Late) for date-only midnight deadline completed after the due date', () => {
    const midnightDeadline = new Date('2026-10-15T00:00:00.000Z');
    const nextDayCompletion = new Date('2026-10-16T10:00:00.000Z');
    const result = calculateTaskScore(nextDayCompletion, midnightDeadline);

    expect(result).not.toBeNull();
    expect(result?.points).toBe(0);
    expect(result?.outcome).toBe('LATE');
  });

  it('awards 0 points (Late/Overtime) when task is completed after the deadline time on the same day', () => {
    // Deadline was 13:05, completed at 13:08
    const pastDeadline = new Date('2026-10-16T07:35:00.000Z');
    const completedAt = new Date('2026-10-16T07:38:06.000Z');

    const result = calculateTaskScore(completedAt, pastDeadline);

    expect(result).not.toBeNull();
    expect(result?.points).toBe(0);
    expect(result?.outcome).toBe('LATE');
  });

  it('returns null when completion timestamp is missing or invalid', () => {
    expect(calculateTaskScore(null, deadline)).toBeNull();
    expect(calculateTaskScore(undefined, deadline)).toBeNull();
    expect(calculateTaskScore('invalid-date', deadline)).toBeNull();
  });

  it('ranks employees by total points descending and breaks ties properly', () => {
    const rawList = [
      {
        employeeId: 'emp-1',
        name: 'Charlie',
        avatarUrl: null,
        designation: 'Developer',
        totalAssigned: 5,
        totalCompleted: 3,
        totalPoints: 4,
        earlyCount: 2,
        onTimeCount: 0,
        lateCount: 1,
        onTimeAndEarlyCount: 2,
      },
      {
        employeeId: 'emp-2',
        name: 'Alice',
        avatarUrl: null,
        designation: 'Designer',
        totalAssigned: 5,
        totalCompleted: 4,
        totalPoints: 6,
        earlyCount: 3,
        onTimeCount: 0,
        lateCount: 1,
        onTimeAndEarlyCount: 3,
      },
      {
        employeeId: 'emp-3',
        name: 'Bob',
        avatarUrl: null,
        designation: 'Manager',
        totalAssigned: 5,
        totalCompleted: 3,
        totalPoints: 4,
        earlyCount: 1,
        onTimeCount: 2, // 3 onTimeAndEarlyCount > Charlie's 2
        lateCount: 0,
        onTimeAndEarlyCount: 3,
      },
    ];

    const ranked = rankEmployees(rawList);

    // Alice has highest points (6 pts) -> Rank #1
    expect(ranked[0].name).toBe('Alice');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].rankDisplay).toBe('#1');
    expect(ranked[0].isTopPerformer).toBe(true);

    // Bob and Charlie both have 4 pts, but Bob has 3 onTimeAndEarly vs Charlie's 2 -> Bob is Rank #2
    expect(ranked[1].name).toBe('Bob');
    expect(ranked[1].rank).toBe(2);
    expect(ranked[1].rankDisplay).toBe('#2');

    // Charlie is Rank #3
    expect(ranked[2].name).toBe('Charlie');
    expect(ranked[2].rank).toBe(3);
    expect(ranked[2].rankDisplay).toBe('#3');
  });

  it('handles exact ties without inventing artificial differences', () => {
    const rawList = [
      {
        employeeId: 'emp-1',
        name: 'Alice',
        avatarUrl: null,
        designation: 'Dev',
        totalAssigned: 2,
        totalCompleted: 2,
        totalPoints: 4,
        earlyCount: 2,
        onTimeCount: 0,
        lateCount: 0,
        onTimeAndEarlyCount: 2,
      },
      {
        employeeId: 'emp-2',
        name: 'Bob',
        avatarUrl: null,
        designation: 'Dev',
        totalAssigned: 2,
        totalCompleted: 2,
        totalPoints: 4,
        earlyCount: 2,
        onTimeCount: 0,
        lateCount: 0,
        onTimeAndEarlyCount: 2,
      },
    ];

    const ranked = rankEmployees(rawList);

    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].isTied).toBe(true);
    expect(ranked[0].rankDisplay).toBe('Tied #1');

    expect(ranked[1].rank).toBe(1);
    expect(ranked[1].isTied).toBe(true);
    expect(ranked[1].rankDisplay).toBe('Tied #1');
  });
});
