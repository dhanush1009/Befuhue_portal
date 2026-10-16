import { describe, it, expect } from 'vitest';
import { checkStatusMove, normalizePeople, partsSummary, peopleLabel, ASSIGN_PRESETS, type ParticipantLite } from './taskAssignment';

const part = (userId: string, partDone: boolean, name = userId, role = 'Designer'): ParticipantLite => ({ userId, kind: 'COLLABORATOR', role, partDone, name });
const offeree = (userId: string): ParticipantLite => ({ userId, kind: 'OFFEREE', partDone: false });

describe('TOGETHER tasks', () => {
  const together = { assignMode: 'TOGETHER' as const, assigneeId: 'a' };

  it('cannot move to review until every part is done', () => {
    const r = checkStatusMove(together, [part('a', true, 'Asha'), part('b', false, 'Ravi')], 'INTERNAL_REVIEW');
    expect(r).toMatchObject({ ok: false, code: 'PARTS_INCOMPLETE' });
    expect((r as { message: string }).message).toContain('Ravi');
    expect((r as { message: string }).message).not.toContain('Asha');
  });

  it('can move to review once everyone is done', () => {
    expect(checkStatusMove(together, [part('a', true), part('b', true)], 'INTERNAL_REVIEW')).toEqual({ ok: true });
  });

  it('blocks every later stage too, not only the first review', () => {
    const half = [part('a', true), part('b', false)];
    for (const s of ['CLIENT_REVIEW', 'DONE', 'CLOSED']) {
      expect(checkStatusMove(together, half, s)).toMatchObject({ ok: false, code: 'PARTS_INCOMPLETE' });
    }
  });

  it('lets people start work and move back freely', () => {
    const half = [part('a', false), part('b', false)];
    expect(checkStatusMove(together, half, 'IN_PROGRESS')).toEqual({ ok: true });
    expect(checkStatusMove(together, half, 'TO_DO')).toEqual({ ok: true });
  });

  it('never counts a task with no parts as complete', () => {
    expect(checkStatusMove(together, [], 'INTERNAL_REVIEW')).toMatchObject({ ok: false });
  });
});

describe('OFFER tasks', () => {
  it('cannot move until somebody accepts', () => {
    expect(checkStatusMove({ assignMode: 'OFFER', assigneeId: null }, [offeree('a'), offeree('b')], 'IN_PROGRESS'))
      .toMatchObject({ ok: false, code: 'OFFER_OPEN' });
  });

  it('moves normally once accepted (it has an assignee)', () => {
    expect(checkStatusMove({ assignMode: 'OFFER', assigneeId: 'a' }, [], 'IN_PROGRESS')).toEqual({ ok: true });
  });
});

describe('ordinary tasks are unaffected', () => {
  it('SINGLE and legacy (no mode) tasks move anywhere', () => {
    expect(checkStatusMove({ assigneeId: 'a' }, [], 'DONE')).toEqual({ ok: true });
    expect(checkStatusMove({ assignMode: 'SINGLE', assigneeId: null }, [], 'IN_PROGRESS')).toEqual({ ok: true });
  });
});

describe('normalizePeople', () => {
  it('needs at least two different people', () => {
    expect(normalizePeople([{ userId: 'a' }])).toMatchObject({ ok: false });
    expect(normalizePeople([{ userId: 'a' }, { userId: 'a' }])).toMatchObject({ ok: false });
  });

  it('drops duplicates and blanks, trims roles', () => {
    const r = normalizePeople([{ userId: 'a', role: '  Designer ' }, { userId: '' }, { userId: 'a' }, { userId: 'b', role: '   ' }]);
    expect(r).toEqual({ ok: true, people: [{ userId: 'a', role: 'Designer' }, { userId: 'b', role: null }] });
  });

  it('caps the group size', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ userId: `u${i}` }));
    expect(normalizePeople(many)).toMatchObject({ ok: false });
  });
});

describe('summaries', () => {
  it('counts parts', () => {
    const s = partsSummary([part('a', true), part('b', false), offeree('c')]);
    expect(s).toMatchObject({ done: 1, total: 2, allDone: false });
    expect(s.waitingOn.map((p) => p.userId)).toEqual(['b']);
  });

  it('labels together and open-offer tasks for the card', () => {
    expect(peopleLabel({ assignMode: 'TOGETHER' }, [part('a', true), part('b', false)])).toBe('1 of 2 parts done');
    expect(peopleLabel({ assignMode: 'OFFER', assigneeId: null }, [offeree('a'), offeree('b')])).toBe('Offered to 2 — first to accept');
    expect(peopleLabel({ assignMode: 'OFFER', assigneeId: 'a' }, [])).toBeNull();
    expect(peopleLabel({}, [])).toBeNull();
  });

  it('ships the two presets with the roles you asked for', () => {
    expect(ASSIGN_PRESETS.find((p) => p.id === 'web-page')?.roles).toEqual(['Designer', 'Developer']);
    expect(ASSIGN_PRESETS.find((p) => p.id === 'live-ad')?.roles).toEqual(['Marketer', 'Designer']);
  });
});
