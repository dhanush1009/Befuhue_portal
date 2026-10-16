'use client';

import { useState } from 'react';
import { Check, Loader2, Users, Hand, Settings2, Circle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { modeOf, partsSummary, type ParticipantLite } from '@/lib/taskAssignment';
import { useAcceptTask, useMarkPart, useSetPeople, useEmployeeList } from '@/hooks/useTasks';
import { AssignPeople, chosenPeople, peopleValid, type PersonRow } from './AssignPeople';
import type { AssignMode } from '@/lib/taskAssignment';
import type { Task } from '@/types';

// ── The panel section ─────────────────────────────────────────────────────────

interface Props {
  task:      Task;
  viewerId:  string | undefined;
  canManage: boolean; // admin, or whoever created the task
}

export function TaskPeopleSection({ task, viewerId, canManage }: Props) {
  const [managing, setManaging] = useState(false);
  const accept   = useAcceptTask();
  const markPart = useMarkPart();

  const mode = modeOf(task);
  const participants = task.participants ?? [];
  const lite: ParticipantLite[] = participants.map((p) => ({ userId: p.userId, kind: p.kind, role: p.role, partDone: p.partDone, name: p.user.name }));
  const { done, total } = partsSummary(lite);
  const closed = task.status === 'CLOSED';

  if (mode === 'SINGLE') return null;

  const me = participants.find((p) => p.userId === viewerId);

  return (
    <div className="col-span-2 rounded-xl border border-brand/20 bg-brand/5 dark:bg-brand/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {mode === 'TOGETHER' ? <Users className="w-4 h-4 text-brand" /> : <Hand className="w-4 h-4 text-brand" />}
          <div>
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              {mode === 'TOGETHER' ? 'Working together' : 'Offered — first to accept takes it'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-violet-300/55">
              {mode === 'TOGETHER'
                ? `${done} of ${total} parts done · moves to Internal Review when everyone is done`
                : `Offered to ${participants.length} people · everyone else is released once someone accepts`}
            </p>
          </div>
        </div>
        {canManage && !closed && (
          <button onClick={() => setManaging(true)} className="flex items-center gap-1 text-[11px] font-medium text-brand hover:underline underline-offset-2 shrink-0">
            <Settings2 className="w-3.5 h-3.5" /> Manage
          </button>
        )}
      </div>

      {mode === 'TOGETHER' && total > 0 && (
        <div className="h-1.5 rounded-full bg-white dark:bg-surface-dark-3 overflow-hidden">
          <div className="h-full bg-brand transition-all duration-300" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}

      <ul className="space-y-1.5">
        {participants.map((p) => (
          <li key={p.userId} className="flex items-center gap-2.5 rounded-lg bg-white dark:bg-surface-dark-3 px-3 py-2">
            <UserAvatar name={p.user.name} avatarUrl={p.user.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {p.user.name}{p.userId === viewerId && <span className="text-gray-400 font-normal"> (you)</span>}
              </p>
              {p.role && <p className="text-[11px] text-gray-400 dark:text-violet-300/45">{p.role}</p>}
            </div>
            {mode === 'TOGETHER' && (
              p.partDone
                ? <span className="flex items-center gap-1 text-[11px] font-medium text-status-present"><Check className="w-3.5 h-3.5" /> Done</span>
                : <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-violet-300/45"><Circle className="w-3 h-3" /> Working</span>
            )}
          </li>
        ))}
      </ul>

      {/* My action */}
      {!closed && me && mode === 'TOGETHER' && (
        <button
          onClick={() => markPart.mutate({ id: task.id, done: !me.partDone })}
          disabled={markPart.isPending}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 active:scale-[0.99] disabled:opacity-60',
            me.partDone
              ? 'border border-gray-200 dark:border-violet-900/40 text-gray-600 dark:text-violet-200/70 hover:bg-white dark:hover:bg-surface-dark-3'
              : 'bg-brand text-white hover:bg-brand-hover',
          )}
        >
          {markPart.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : me.partDone ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
          {me.partDone ? 'Reopen my part' : `Mark my part done${me.role ? ` (${me.role})` : ''}`}
        </button>
      )}
      {!closed && me && mode === 'OFFER' && me.kind === 'OFFEREE' && (
        <button
          onClick={() => accept.mutate(task.id)}
          disabled={accept.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-status-present hover:bg-green-700 text-white text-xs font-semibold transition-colors duration-150 active:scale-[0.99] disabled:opacity-60"
        >
          {accept.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hand className="w-3.5 h-3.5" />}
          Accept this task
        </button>
      )}

      {managing && <ManagePeopleModal task={task} onClose={() => setManaging(false)} />}
    </div>
  );
}

// ── Change who is on the task ─────────────────────────────────────────────────

export function ManagePeopleModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data: employees = [] } = useEmployeeList();
  const setPeople = useSetPeople();

  const startMode = modeOf(task);
  const [mode, setMode] = useState<AssignMode>(startMode);
  const [rows, setRows] = useState<PersonRow[]>(
    (task.participants ?? []).map((p) => ({ userId: p.userId, role: p.role ?? '' })),
  );
  const [single, setSingle] = useState(task.assigneeId ?? '');

  const invalid = mode !== 'SINGLE' && !peopleValid(rows);

  function save() {
    if (invalid) return;
    setPeople.mutate(
      {
        id: task.id, mode,
        people:     mode === 'SINGLE' ? [] : chosenPeople(rows, mode),
        assigneeId: mode === 'SINGLE' ? (single || null) : undefined,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/30">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Who is on this task?</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          <AssignPeople
            mode={mode} onModeChange={setMode}
            people={rows} onPeopleChange={setRows}
            singleAssigneeId={single} onSingleChange={setSingle}
            employees={employees}
            hideModes={task.status === 'TO_DO' ? [] : ['OFFER']}
          />
          {startMode === 'TOGETHER' && mode !== 'TOGETHER' && (
            <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">Switching away from Together removes the separate parts; progress on them is lost.</p>
          )}
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-violet-900/30">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3">Cancel</button>
          <button onClick={save} disabled={invalid || setPeople.isPending} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50">
            {setPeople.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** A "Work together / offer to a group" shortcut shown under the normal assignee dropdown. */
export function ShareTaskButton({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  if (task.status === 'CLOSED') return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-brand hover:underline underline-offset-2">
        <Users className="w-3 h-3" /> Work together or offer to a group…
      </button>
      {open && <ManagePeopleModal task={task} onClose={() => setOpen(false)} />}
    </>
  );
}
