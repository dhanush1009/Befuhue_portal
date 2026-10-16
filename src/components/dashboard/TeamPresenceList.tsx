'use client';

import { cn, formatTime, getInitials } from '@/lib/utils';
import type { PresenceEntry } from '@/hooks/useDashboard';

const STATUS_DOT: Record<string, string> = {
  present:  'bg-status-present',
  wfh:      'bg-status-wfh',
  half_day: 'bg-status-wfh',
  leave:    'bg-status-leave',
  anywhere: 'bg-brand',
  holiday:  'bg-rose-400',
  absent:   'bg-gray-300 dark:bg-surface-dark-3',
};

const STATUS_TEXT: Record<string, string> = {
  present:  'In office',
  wfh:      'Working remotely',
  half_day: 'Half day',
  leave:    'On leave',
  anywhere: 'Working from anywhere',
  holiday:  'Company holiday',
  absent:   'Not checked in',
};

const AVATAR_COLORS = [
  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
];

function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export function TeamPresenceListSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 p-5 animate-pulse">
      <div className="w-32 h-4 bg-gray-200 dark:bg-surface-dark-3 rounded mb-4" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-surface-dark-3 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="w-28 h-3 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            <div className="w-20 h-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          </div>
          <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-surface-dark-3" />
        </div>
      ))}
    </div>
  );
}

interface TeamPresenceListProps { entries: PresenceEntry[]; }

export function TeamPresenceList({ entries }: TeamPresenceListProps) {
  const ORDER: Record<string, number> = { present: 0, wfh: 1, half_day: 2, anywhere: 3, holiday: 4, leave: 5, absent: 6 };
  const sorted = [...entries].sort((a, b) => (ORDER[a.status] ?? 7) - (ORDER[b.status] ?? 7));
  const inCount = entries.filter((e) => e.status === 'present' || e.status === 'wfh').length;

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500 transition-colors duration-150">
      <div className="px-5 pt-5 pb-3">
        <p className="text-xs font-semibold text-gray-600 dark:text-violet-300/55 uppercase tracking-wider">Team Presence</p>
        <p className="text-xs text-gray-500 dark:text-violet-300/45 mt-0.5">{inCount} of {entries.length} in</p>
      </div>

      <ul className="overflow-y-auto max-h-80 custom-scrollbar divide-y divide-gray-50 dark:divide-violet-900/25 px-5 pb-4">
        {sorted.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 py-2.5">
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden', entry.avatarUrl ? '' : avatarColor(entry.name))}>
              {entry.avatarUrl
                ? <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
                : getInitials(entry.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{entry.name}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                {entry.status === 'present' && entry.clockIn ? `In since ${formatTime(entry.clockIn)}` : STATUS_TEXT[entry.status] ?? 'Unknown'}
              </p>
            </div>
            <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[entry.status] ?? 'bg-gray-300')} title={STATUS_TEXT[entry.status]} />
          </li>
        ))}
      </ul>
    </div>
  );
}
