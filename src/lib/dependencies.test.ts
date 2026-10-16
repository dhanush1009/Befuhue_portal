import { describe, it, expect } from 'vitest';
import { isTaskBlocked, getBlockingTasks, wouldCreateCycle } from './dependencies';
import type { TaskStatus } from '@prisma/client';

interface FixtureTask { id: string; status: TaskStatus }

describe('isTaskBlocked', () => {
  it('is not blocked with no dependencies', () => {
    expect(isTaskBlocked({ dependsOn: [] }, [] as FixtureTask[])).toBe(false);
  });

  it('is blocked when a dependency is not done', () => {
    const scope: FixtureTask[] = [{ id: 'a', status: 'IN_PROGRESS' }];
    expect(isTaskBlocked({ dependsOn: ['a'] }, scope)).toBe(true);
  });

  it('is not blocked once all dependencies are done-like', () => {
    const scope: FixtureTask[] = [
      { id: 'a', status: 'DONE' },
      { id: 'b', status: 'CLOSED' },
    ];
    expect(isTaskBlocked({ dependsOn: ['a', 'b'] }, scope)).toBe(false);
  });

  it('treats a missing dependency (not in scope) as still blocking', () => {
    expect(isTaskBlocked({ dependsOn: ['ghost'] }, [] as FixtureTask[])).toBe(true);
  });

  it('is blocked if only one of several dependencies is unfinished', () => {
    const scope: FixtureTask[] = [
      { id: 'a', status: 'DONE' },
      { id: 'b', status: 'IN_PROGRESS' },
    ];
    expect(isTaskBlocked({ dependsOn: ['a', 'b'] }, scope)).toBe(true);
  });
});

describe('getBlockingTasks', () => {
  it('returns only the unfinished dependencies', () => {
    const scope: FixtureTask[] = [
      { id: 'a', status: 'DONE' },
      { id: 'b', status: 'IN_PROGRESS' },
      { id: 'c', status: 'TO_DO' },
    ];
    const blocking = getBlockingTasks({ dependsOn: ['a', 'b', 'c'] }, scope);
    expect(blocking.map((t) => t.id)).toEqual(['b', 'c']);
  });
});

describe('wouldCreateCycle', () => {
  it('rejects a task depending on itself', () => {
    expect(wouldCreateCycle('a', 'a', [])).toBe(true);
  });

  it('allows a simple, acyclic dependency', () => {
    const all = [{ id: 'a', dependsOn: [] }, { id: 'b', dependsOn: [] }];
    expect(wouldCreateCycle('a', 'b', all)).toBe(false);
  });

  it('rejects a direct 2-cycle (b already depends on a)', () => {
    const all = [
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: [] },
    ];
    // Adding "a depends on b" is fine on its own, but if b already depends on a...
    const allReverse = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
    ];
    expect(wouldCreateCycle('a', 'b', allReverse)).toBe(true);
  });

  it('rejects an indirect cycle through a chain (a -> c -> b -> a)', () => {
    const all = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['b'] },
    ];
    // a depending on c would close the loop a -> c -> b -> a
    expect(wouldCreateCycle('a', 'c', all)).toBe(true);
  });

  it('allows adding a dependency that does not close any loop', () => {
    const all = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: [] },
    ];
    expect(wouldCreateCycle('b', 'c', all)).toBe(false);
  });
});
