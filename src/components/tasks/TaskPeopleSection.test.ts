import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskPeopleSection } from './TaskPeopleSection';
import type { Task } from '@/types';

// Renders the real panel section with realistic data, so a broken render (a bad prop, an undefined
// access) shows up here rather than in front of someone using the board.

const person = (id: string, name: string, role: string | null, kind: 'COLLABORATOR' | 'OFFEREE', partDone = false) => ({
  userId: id, kind, role, partDone, partDoneAt: null, user: { id, name, avatarUrl: null },
});

function render(task: Partial<Task>, viewerId: string, canManage = false): string {
  const client = new QueryClient();
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client },
      createElement(TaskPeopleSection, { task: { id: 't1', status: 'IN_PROGRESS', assigneeId: null, ...task } as Task, viewerId, canManage })),
  );
}

describe('TaskPeopleSection', () => {
  const together: Partial<Task> = {
    assignMode: 'TOGETHER', assigneeId: 'a',
    participants: [person('a', 'Asha S', 'Designer', 'COLLABORATOR', true), person('b', 'Ravi M', 'Developer', 'COLLABORATOR', false)],
  };

  it('shows progress and each person\'s part for a together task', () => {
    const html = render(together, 'zz');
    expect(html).toContain('Working together');
    expect(html).toContain('1 of 2 parts done');
    expect(html).toContain('Designer');
    expect(html).toContain('Developer');
    expect(html).toContain('Done');
    expect(html).toContain('Working');
  });

  it('gives a collaborator their own button, naming their role', () => {
    expect(render(together, 'b')).toContain('Mark my part done (Developer)');
    expect(render(together, 'a')).toContain('Reopen my part'); // already done
  });

  it('does not offer a part button to someone who has no part', () => {
    expect(render(together, 'zz')).not.toContain('my part');
  });

  it('shows an open offer with an Accept button only for people it was offered to', () => {
    const offer: Partial<Task> = {
      assignMode: 'OFFER', assigneeId: null,
      participants: [person('a', 'Asha S', null, 'OFFEREE'), person('b', 'Ravi M', null, 'OFFEREE')],
    };
    const mine = render(offer, 'a');
    expect(mine).toContain('first to accept');
    expect(mine).toContain('Accept this task');
    expect(render(offer, 'zz')).not.toContain('Accept this task');
  });

  it('shows Manage only to people who can change the group, and nothing for ordinary tasks', () => {
    expect(render(together, 'zz', true)).toContain('Manage');
    expect(render(together, 'zz', false)).not.toContain('Manage');
    expect(render({ assigneeId: 'a' }, 'a')).toBe('');
  });

  it('hides the action buttons once the task is closed', () => {
    const html = render({ ...together, status: 'CLOSED' }, 'b', true);
    expect(html).not.toContain('Mark my part');
    expect(html).not.toContain('Manage');
  });
});
