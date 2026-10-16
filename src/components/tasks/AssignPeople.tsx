'use client';

import { Plus, X, Users, Hand, User as UserIcon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ASSIGN_PRESETS, MAX_PEOPLE, MIN_PEOPLE, type AssignMode } from '@/lib/taskAssignment';
import type { EmployeeListItem } from '@/hooks/useTasks';

export interface PersonRow { userId: string; role: string }

const MODES: { id: AssignMode; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'SINGLE',   label: 'One person', hint: 'One owner, like always.',                                              icon: UserIcon },
  { id: 'TOGETHER', label: 'Together',   hint: 'Everyone has a part. Moves to review only when all parts are done.',   icon: Users },
  { id: 'OFFER',    label: 'Anyone',     hint: 'Offered to a group — the first to accept takes it, others are released.', icon: Hand },
];

// Suggest people whose designation matches the role they are being added for.
const ROLE_KEYWORD: Record<string, string> = { designer: 'design', developer: 'dev', marketer: 'market' };

function sortedFor(role: string, employees: EmployeeListItem[]): EmployeeListItem[] {
  const kw = ROLE_KEYWORD[role.trim().toLowerCase()];
  if (!kw) return employees;
  const match = (e: EmployeeListItem) => (e.designation ?? '').toLowerCase().includes(kw);
  return [...employees.filter(match), ...employees.filter((e) => !match(e))];
}

const SELECT = 'flex-1 min-w-0 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none';

interface Props {
  mode:             AssignMode;
  onModeChange:     (m: AssignMode) => void;
  people:           PersonRow[];
  onPeopleChange:   (p: PersonRow[]) => void;
  singleAssigneeId: string;
  onSingleChange:   (id: string) => void;
  employees:        EmployeeListItem[];
  /** Hide the "One person" option (when it would make no sense, e.g. already started). */
  hideModes?:       AssignMode[];
}

export function AssignPeople({ mode, onModeChange, people, onPeopleChange, singleAssigneeId, onSingleChange, employees, hideModes = [] }: Props) {
  const modes = MODES.filter((m) => !hideModes.includes(m.id));
  const chosen = new Set(people.map((p) => p.userId).filter(Boolean));
  const enough = people.filter((p) => p.userId).length >= MIN_PEOPLE;

  function switchMode(next: AssignMode) {
    onModeChange(next);
    // A group mode needs at least two rows to start from.
    if (next !== 'SINGLE' && people.length < MIN_PEOPLE) {
      onPeopleChange([...people, ...Array.from({ length: MIN_PEOPLE - people.length }, () => ({ userId: '', role: '' }))]);
    }
  }

  function setRow(i: number, patch: Partial<PersonRow>) {
    onPeopleChange(people.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function applyPreset(roles: string[]) {
    // Keep anyone already picked, give each part its role.
    onPeopleChange(roles.map((role, i) => ({ userId: people[i]?.userId ?? '', role })));
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">Who does this?</label>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-gray-100 dark:bg-surface-dark-2">
          {modes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => switchMode(id)}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors duration-150',
                mode === id ? 'bg-white dark:bg-surface-dark-3 text-brand shadow-sm' : 'text-gray-500 dark:text-violet-300/55 hover:text-gray-700 dark:hover:text-violet-100/80',
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-violet-300/45 mt-1.5">{MODES.find((m) => m.id === mode)?.hint}</p>
      </div>

      {mode === 'SINGLE' ? (
        <select value={singleAssigneeId} onChange={(e) => onSingleChange(e.target.value)} className={cn(SELECT, 'w-full')}>
          <option value="">Unassigned</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      ) : (
        <div className="space-y-2">
          {mode === 'TOGETHER' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-violet-300/45"><Sparkles className="w-3 h-3" /> Quick start:</span>
              {ASSIGN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.roles)}
                  title={p.description}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-brand/30 text-brand hover:bg-brand/5 transition-colors duration-150"
                >
                  {p.label} · {p.roles.join(' + ')}
                </button>
              ))}
            </div>
          )}

          {people.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={row.userId}
                onChange={(e) => setRow(i, { userId: e.target.value })}
                className={SELECT}
                aria-label={`Person ${i + 1}`}
              >
                <option value="">Choose a person…</option>
                {sortedFor(row.role, employees).map((e) => (
                  <option key={e.id} value={e.id} disabled={chosen.has(e.id) && row.userId !== e.id}>
                    {e.name}{e.designation ? ` — ${e.designation}` : ''}
                  </option>
                ))}
              </select>
              {mode === 'TOGETHER' && (
                <input
                  value={row.role}
                  onChange={(e) => setRow(i, { role: e.target.value })}
                  maxLength={40}
                  list="task-part-roles"
                  placeholder="Role (e.g. Designer)"
                  className="w-40 shrink-0 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none"
                />
              )}
              {people.length > MIN_PEOPLE && (
                <button type="button" onClick={() => onPeopleChange(people.filter((_, idx) => idx !== i))} aria-label="Remove person" className="p-1.5 rounded-md text-gray-400 hover:text-status-absent hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-150">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <datalist id="task-part-roles">
            {['Designer', 'Developer', 'Marketer', 'Copywriter', 'Reviewer'].map((r) => <option key={r} value={r} />)}
          </datalist>

          <div className="flex items-center justify-between">
            {people.length < MAX_PEOPLE ? (
              <button type="button" onClick={() => onPeopleChange([...people, { userId: '', role: '' }])} className="flex items-center gap-1 text-xs font-medium text-brand hover:underline underline-offset-2">
                <Plus className="w-3.5 h-3.5" /> Add another person
              </button>
            ) : <span />}
            {!enough && <span className="text-[11px] text-amber-600 dark:text-amber-400">Pick at least {MIN_PEOPLE} different people</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/** The people actually chosen (blank rows dropped) — what gets sent to the API. */
export function chosenPeople(rows: PersonRow[], mode: AssignMode): { userId: string; role?: string }[] {
  return rows
    .filter((r) => r.userId)
    .map((r) => ({ userId: r.userId, ...(mode === 'TOGETHER' && r.role.trim() ? { role: r.role.trim() } : {}) }));
}

export function peopleValid(rows: PersonRow[]): boolean {
  const ids = rows.map((r) => r.userId).filter(Boolean);
  return ids.length >= MIN_PEOPLE && new Set(ids).size === ids.length;
}
