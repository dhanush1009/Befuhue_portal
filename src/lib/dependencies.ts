import type { Task } from '@/types';

// A task counts as "unblocking" its dependents once it reaches a terminal,
// accepted state. VERIFIED is kept for any un-migrated legacy bug data.
const DONE_LIKE = new Set(['DONE', 'CLOSED', 'VERIFIED']);

/**
 * Blocked is a computed flag, not a stored status: a task is blocked when at
 * least one of its dependsOn tasks is not yet done. `scope` should be the
 * fullest task list available to the caller — dependency tasks outside the
 * current filter/board view still count.
 */
export function isTaskBlocked(task: Pick<Task, 'dependsOn'>, scope: Pick<Task, 'id' | 'status'>[]): boolean {
  if (!task.dependsOn || task.dependsOn.length === 0) return false;
  return task.dependsOn.some((depId) => {
    const dep = scope.find((t) => t.id === depId);
    return !dep || !DONE_LIKE.has(dep.status);
  });
}

export function getBlockingTasks<T extends Pick<Task, 'id' | 'status'>>(
  task: Pick<Task, 'dependsOn'>,
  scope: T[],
): T[] {
  if (!task.dependsOn || task.dependsOn.length === 0) return [];
  return task.dependsOn
    .map((depId) => scope.find((t) => t.id === depId))
    .filter((t): t is T => !!t && !DONE_LIKE.has(t.status));
}

/** Detects whether adding `newDepId` as a dependency of `taskId` would create a cycle. */
export function wouldCreateCycle(
  taskId: string,
  newDepId: string,
  allTasks: Pick<Task, 'id' | 'dependsOn'>[],
): boolean {
  if (taskId === newDepId) return true;
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const stack = [newDepId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const deps = byId.get(current)?.dependsOn ?? [];
    stack.push(...deps);
  }
  return false;
}
