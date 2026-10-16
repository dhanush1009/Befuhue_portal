import { describe, it, expect } from 'vitest';
import { canViewTask, taskVisibilityFilter } from './taskVisibility';

const PRIVATE_TASK = { isPrivate: true, assigneeId: 'assignee-1', reporterId: 'reporter-1' };
const PUBLIC_TASK  = { isPrivate: false, assigneeId: 'assignee-1', reporterId: 'reporter-1' };

describe('canViewTask', () => {
  it('lets anyone view a public task', () => {
    expect(canViewTask(PUBLIC_TASK, 'stranger', 'EMPLOYEE')).toBe(true);
  });

  it('lets the assignee view a private task', () => {
    expect(canViewTask(PRIVATE_TASK, 'assignee-1', 'EMPLOYEE')).toBe(true);
  });

  it('lets the reporter view a private task', () => {
    expect(canViewTask(PRIVATE_TASK, 'reporter-1', 'EMPLOYEE')).toBe(true);
  });

  it('lets an Admin view a private task regardless of involvement', () => {
    expect(canViewTask(PRIVATE_TASK, 'stranger', 'ADMIN')).toBe(true);
  });

  it('lets someone sharing the task (a collaborator or offered person) view a private task', () => {
    expect(canViewTask({ ...PRIVATE_TASK, participants: [{ userId: 'collab-1' }] }, 'collab-1', 'EMPLOYEE')).toBe(true);
    expect(canViewTask({ ...PRIVATE_TASK, participants: [{ userId: 'collab-1' }] }, 'stranger', 'EMPLOYEE')).toBe(false);
  });

  it('blocks an uninvolved employee from a private task', () => {
    expect(canViewTask(PRIVATE_TASK, 'stranger', 'EMPLOYEE')).toBe(false);
  });
});

describe('taskVisibilityFilter', () => {
  it('applies no extra filter for Admins', () => {
    expect(taskVisibilityFilter('any-user', 'ADMIN')).toEqual({});
  });

  it('scopes non-admins to public tasks plus their own private ones', () => {
    const filter = taskVisibilityFilter('me', 'EMPLOYEE');
    expect(filter).toEqual({
      OR: [
        { isPrivate: false },
        { isPrivate: true, assigneeId: 'me' },
        { isPrivate: true, reporterId: 'me' },
        { isPrivate: true, participants: { some: { userId: 'me' } } },
      ],
    });
  });
});
