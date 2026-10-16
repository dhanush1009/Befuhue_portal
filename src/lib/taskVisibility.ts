import type { Role } from '@prisma/client';
import type { Prisma } from '@prisma/client';

/**
 * A private task is only visible to its assignee, its reporter, and Admins.
 * Admins bypass the check entirely (returns undefined — no extra filter).
 * Combine into a `where` object alongside other filters (Prisma ANDs top-level keys).
 */
export function taskVisibilityFilter(userId: string, role: Role): Pick<Prisma.TaskWhereInput, 'OR'> | Record<string, never> {
  if (role === 'ADMIN') return {};
  return {
    OR: [
      { isPrivate: false },
      { isPrivate: true, assigneeId: userId },
      { isPrivate: true, reporterId: userId },
      // people sharing the task (together parts / offered to) can see it too
      { isPrivate: true, participants: { some: { userId } } },
    ],
  };
}

/** Whether a specific task (already fetched) may be seen by this user. */
export function canViewTask(
  task: { isPrivate: boolean; assigneeId: string | null; reporterId: string; participants?: { userId: string }[] },
  userId: string,
  role: Role,
): boolean {
  if (!task.isPrivate) return true;
  if (role === 'ADMIN') return true;
  return task.assigneeId === userId || task.reporterId === userId || !!task.participants?.some((p) => p.userId === userId);
}
