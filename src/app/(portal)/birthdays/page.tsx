'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Cake, Award, EyeOff, CalendarClock, CalendarDays, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useBirthdays } from '@/hooks/useEmployeeDetails';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';

const when = (d: number) => (d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`);

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt="" className="size-9 rounded-full object-cover shrink-0" />
    : <span className="size-9 rounded-full bg-gray-100 dark:bg-white/10 grid place-items-center text-sm font-semibold text-gray-600 dark:text-white shrink-0">{name.charAt(0)}</span>;
}

/** Admin only: who is celebrating when, across the whole year ahead. */
export default function BirthdaysPage() {
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<'birthdays' | 'anniversaries'>('birthdays');
  const { data, isLoading } = useBirthdays(isAdmin);

  useEffect(() => { if (!authLoading && !isAdmin) router.replace('/dashboard'); }, [authLoading, isAdmin, router]);

  type Row = { userId: string; name: string; avatarUrl: string | null; designation: string | null; department?: string | null; date: string; daysAway: number; turns?: number; years?: number; hidden?: boolean };
  const rows = useMemo<Row[]>(() => (tab === 'birthdays' ? data?.birthdays : data?.anniversaries) ?? [], [tab, data]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = format(parseISO(r.date), 'MMMM yyyy');
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return [...m.entries()];
  }, [rows]);

  if (!isAdmin) return null;
  const b = data?.birthdays ?? [];

  return (
    <div className="mx-auto max-w-screen-lg pb-10">
      <PageHeader title="Birthdays & anniversaries" description="Admin view. The team only sees who is celebrating today." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <KpiCard title="Today" tone="amber" icon={Cake} value={isLoading ? '–' : b.filter((x) => x.daysAway === 0).length} caption="birthdays today" />
        <KpiCard title="Next 7 days" tone="violet" icon={CalendarClock} value={isLoading ? '–' : b.filter((x) => x.daysAway <= 7).length} caption="birthdays this week" />
        <KpiCard title="Next 30 days" tone="emerald" icon={CalendarDays} value={isLoading ? '–' : b.filter((x) => x.daysAway <= 30).length} caption="birthdays this month" />
        <KpiCard title="No birthday yet" tone="rose" icon={UserX} value={isLoading ? '–' : data?.missing.length ?? 0} caption="haven't filled in their details" />
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-surface-dark-3 rounded-lg p-1 w-fit">
        {([['birthdays', 'Birthdays', Cake], ['anniversaries', 'Work anniversaries', Award]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', tab === id ? 'bg-white dark:bg-white/10 text-brand shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white')}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-64 rounded-2xl bg-gray-100 dark:bg-surface-dark-3 animate-pulse" />
      ) : groups.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-400 dark:text-violet-300/45">
          {tab === 'birthdays' ? 'No dates of birth have been entered yet. Employees add theirs in My Details.' : 'Nobody has completed a year with the company yet.'}
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([month, list]) => (
            <section key={month}>
              <h2 className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">{month}</h2>
              <Card className="divide-y divide-gray-50 dark:divide-violet-900/25">
                {list.map((r) => (
                  <Link key={`${r.userId}-${tab}`} href={`/hr/${r.userId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                    <Avatar name={r.name} url={r.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.name}</p>
                      <p className="text-xs text-gray-400 dark:text-violet-300/45 truncate">
                        {r.designation ?? '—'}{r.department ? ` · ${r.department}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-gray-900 dark:text-white tabular-nums">{format(parseISO(r.date), 'EEE, d MMM')}</p>
                      <p className="text-xs text-gray-400 dark:text-violet-300/45">
                        {r.turns !== undefined ? `Turns ${r.turns}` : `${r.years} year${r.years === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 w-24 shrink-0">
                      <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', r.daysAway === 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : r.daysAway <= 7 ? 'bg-violet-500/10 text-brand' : 'bg-gray-100 dark:bg-surface-dark-2 text-gray-500 dark:text-violet-300/55')}>
                        {when(r.daysAway)}
                      </span>
                      {r.hidden && <span className="flex items-center gap-1 text-[10px] text-gray-400"><EyeOff className="w-3 h-3" /> hidden from team</span>}
                    </div>
                  </Link>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      {tab === 'birthdays' && (data?.missing.length ?? 0) > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">Haven&apos;t added a date of birth</h2>
          <div className="flex flex-wrap gap-2">
            {data!.missing.map((m) => (
              <Link key={m.userId} href={`/hr/${m.userId}`} className="rounded-full border border-gray-200 dark:border-violet-900/40 px-3 py-1 text-xs text-gray-700 dark:text-violet-200/70 hover:border-violet-300 dark:hover:border-violet-500 transition-colors">{m.name}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
