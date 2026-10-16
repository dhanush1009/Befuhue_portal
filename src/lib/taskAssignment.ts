// Rules for tasks that involve more than one person. Pure (no Prisma/React) so the
// API, the UI and the tests all share exactly the same logic.
//
//  SINGLE    one assignee (the default, unchanged)
//  TOGETHER  several people each own a part; the task only moves to review when every part is done
//  OFFER     offered to several people; the first to accept becomes the single assignee

export type AssignMode = 'SINGLE' | 'TOGETHER' | 'OFFER';

export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 8;

export interface ParticipantLite {
  userId:   string;
  kind:     'COLLABORATOR' | 'OFFEREE';
  role?:    string | null;
  partDone: boolean;
  name?:    string | null;
}

/** Statuses a TOGETHER task may not enter until every part is done. */
const NEEDS_ALL_PARTS: ReadonlySet<string> = new Set(['INTERNAL_REVIEW', 'CLIENT_REVIEW', 'DONE', 'CLOSED']);

export function modeOf(task: { assignMode?: AssignMode | null }): AssignMode {
  return task.assignMode ?? 'SINGLE';
}

export function collaboratorsOf(participants: ParticipantLite[]): ParticipantLite[] {
  return participants.filter((p) => p.kind === 'COLLABORATOR');
}

export function partsSummary(participants: ParticipantLite[]): { done: number; total: number; allDone: boolean; waitingOn: ParticipantLite[] } {
  const parts = collaboratorsOf(participants);
  const waitingOn = parts.filter((p) => !p.partDone);
  return { done: parts.length - waitingOn.length, total: parts.length, allDone: parts.length > 0 && waitingOn.length === 0, waitingOn };
}

export interface MoveCheck { ok: true }
export interface MoveBlocked { ok: false; code: 'PARTS_INCOMPLETE' | 'OFFER_OPEN'; message: string }

/**
 * May a task with these people move to `newStatus`?
 *  - TOGETHER: not into review (or later) until every part is done
 *  - OFFER, still unclaimed: it can't be started or moved on until somebody accepts it
 */
export function checkStatusMove(
  task: { assignMode?: AssignMode | null; assigneeId?: string | null },
  participants: ParticipantLite[],
  newStatus: string,
): MoveCheck | MoveBlocked {
  const mode = modeOf(task);

  if (mode === 'TOGETHER' && NEEDS_ALL_PARTS.has(newStatus)) {
    const { waitingOn, allDone } = partsSummary(participants);
    if (!allDone) {
      const who = waitingOn.map((p) => p.name ?? p.role ?? 'someone').join(', ');
      return { ok: false, code: 'PARTS_INCOMPLETE', message: `Every part must be done before this can move to review${who ? ` — still waiting on ${who}` : ''}.` };
    }
  }

  if (mode === 'OFFER' && !task.assigneeId && newStatus !== 'TO_DO') {
    return { ok: false, code: 'OFFER_OPEN', message: 'Nobody has accepted this task yet. Someone needs to accept it before it can move.' };
  }

  return { ok: true };
}

export interface PersonInput { userId: string; role?: string | null }

/** Validates + tidies the people list for a TOGETHER / OFFER task. */
export function normalizePeople(people: PersonInput[]): { ok: true; people: PersonInput[] } | { ok: false; message: string } {
  const seen = new Set<string>();
  const cleaned: PersonInput[] = [];
  for (const p of people) {
    if (!p.userId || seen.has(p.userId)) continue; // drop blanks and duplicates quietly
    seen.add(p.userId);
    const role = p.role?.trim();
    cleaned.push({ userId: p.userId, role: role ? role.slice(0, 40) : null });
  }
  if (cleaned.length < MIN_PEOPLE) return { ok: false, message: `Pick at least ${MIN_PEOPLE} different people.` };
  if (cleaned.length > MAX_PEOPLE) return { ok: false, message: `At most ${MAX_PEOPLE} people can share a task.` };
  return { ok: true, people: cleaned };
}

/** One-click starting points: a role per part, so the admin only has to pick the people. */
export const ASSIGN_PRESETS: { id: string; label: string; description: string; roles: string[] }[] = [
  { id: 'web-page',    label: 'Web page',           description: 'A designer and a developer build it together', roles: ['Designer', 'Developer'] },
  { id: 'live-ad',     label: 'Live ad deployment', description: 'A marketer and a designer take an ad live',     roles: ['Marketer', 'Designer'] },
];

/** What the card should say about who's on the task. */
export function peopleLabel(
  task: { assignMode?: AssignMode | null; assigneeId?: string | null },
  participants: ParticipantLite[],
): string | null {
  const mode = modeOf(task);
  if (mode === 'TOGETHER') {
    const { done, total } = partsSummary(participants);
    return `${done} of ${total} parts done`;
  }
  if (mode === 'OFFER' && !task.assigneeId) {
    const n = participants.filter((p) => p.kind === 'OFFEREE').length;
    return `Offered to ${n} — first to accept`;
  }
  return null;
}
