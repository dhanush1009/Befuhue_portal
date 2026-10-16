'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ArrowRight, ListChecks } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { BarChart } from '@/components/charts/BarChart';
import type { DashboardOverview } from '@/hooks/useDashboard';

const STAGES = [
  { key: 'TO_DO' as const,            label: 'To do',           color: '#A1A1AA' },
  { key: 'IN_PROGRESS' as const,      label: 'In progress',     color: '#8E51FF' },
  { key: 'INTERNAL_REVIEW' as const,  label: 'Internal review', color: '#F59E0B' },
  { key: 'CLIENT_REVIEW' as const,    label: 'Client review',   color: '#06B6D4' },
  { key: 'DONE' as const,             label: 'Done',            color: '#10B981' },
];

/** Where work sits right now, plus how much got finished over the last two weeks. */
export function TaskPipelineCard({ data }: { data: DashboardOverview | undefined }) {
  const counts = data?.taskStatus;
  const total = counts ? STAGES.reduce((s, st) => s + counts[st.key], 0) : 0;
  const closed = data?.closedByDay ?? [];
  const closedTotal = closed.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="h-full">
      <CardHeader
        icon={<div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand"><ListChecks className="size-[18px]" /></div>}
        title={data?.scope === 'mine' ? 'My task pipeline' : 'Task pipeline'}
        subtitle={data?.scope === 'mine' ? 'Where your work is right now' : 'Where the team\'s work is right now'}
        action={<Link href="/tasks" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open board <ArrowRight className="size-3" /></Link>}
      />

      <div className="space-y-6 p-5">
        {/* stacked bar */}
        <div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]" role="img" aria-label="Tasks by stage">
            {counts && total > 0 && STAGES.map((s) => counts[s.key] > 0 && (
              <div key={s.key} style={{ width: `${(counts[s.key] / total) * 100}%`, backgroundColor: s.color }} className="first:rounded-l-full last:rounded-r-full" title={`${s.label}: ${counts[s.key]}`} />
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STAGES.map((s) => (
              <div key={s.key} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                <dt className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />{s.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-white">{counts ? counts[s.key] : '–'}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* finished per day */}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Closed per day</p>
            <p className="text-xs text-zinc-500">{closedTotal} closed in the last 14 days{(data?.overdue ?? 0) > 0 && <span className="ml-2 font-medium text-rose-600 dark:text-rose-400">· {data!.overdue} overdue</span>}</p>
          </div>
          <BarChart
            height={84}
            color="#10B981"
            data={closed.map((d) => ({ label: format(parseISO(d.date), 'd'), value: d.count, hint: format(parseISO(d.date), 'EEE d MMM') }))}
          />
        </div>
      </div>
    </Card>
  );
}
