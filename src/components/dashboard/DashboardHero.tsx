'use client';

import { format } from 'date-fns';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/shared/UserAvatar';
import type { PresenceEntry } from '@/hooks/useDashboard';

export interface HeroStat { label: string; value: ReactNode; accent?: boolean }

/** The welcome banner: a greeting, one data-driven sentence, three key numbers, and who's in right now. */
export function DashboardHero({ firstName, summary, stats, present, children }: {
  firstName: string;
  summary:   ReactNode;
  stats:     HeroStat[];
  present:   PresenceEntry[];
  children?: ReactNode;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const online = present.filter((p) => p.status === 'present' || p.status === 'wfh' || p.status === 'half_day');

  return (
    <section className="relative overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-violet-50 via-white to-white dark:border-white/10 dark:from-[#1a1230] dark:via-surface-dark-3 dark:to-surface-dark-3">
      {/* soft glow + fine grid, like the Nexora hero */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand/20 blur-3xl dark:bg-brand/25" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(0,0,0,0.06)_1px,transparent_1px)] [background-size:18px_18px] dark:[background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)]" />

      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
            </span>
            <span className="text-xs text-zinc-500">{format(new Date(), 'EEEE, d MMMM yyyy')}</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">{greeting}, {firstName}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">{summary}</p>
          {children && <div className="mt-4">{children}</div>}
        </div>

        <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <dl className="flex items-stretch divide-x divide-black/10 dark:divide-white/10">
            {stats.map((s) => (
              <div key={s.label} className="px-5 first:pl-0 last:pr-0">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{s.label}</dt>
                <dd className={cn('mt-1 text-2xl font-semibold tabular-nums', s.accent ? 'text-brand' : 'text-zinc-950 dark:text-white')}>{s.value}</dd>
              </div>
            ))}
          </dl>
          {online.length > 0 && (
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-2">
                {online.slice(0, 5).map((p) => (
                  <div key={p.id} className="rounded-full ring-2 ring-white dark:ring-surface-dark-3" title={p.name}>
                    <UserAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                  </div>
                ))}
                {online.length > 5 && (
                  <span className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-200 dark:ring-surface-dark-3">+{online.length - 5}</span>
                )}
              </div>
              <span className="text-xs text-zinc-500">{online.length} in today</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
