import type { ElementType, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDelta } from '@/lib/format';
import { Card } from './Card';
import { Sparkline } from '@/components/charts/Sparkline';

export type Tone = 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'blue';

// The gradient behind the icon, and the matching sparkline/stroke colour.
const TONE: Record<Tone, { chip: string; stroke: string }> = {
  violet:  { chip: 'from-violet-500 to-purple-600',  stroke: '#8E51FF' },
  cyan:    { chip: 'from-cyan-500 to-blue-600',      stroke: '#06B6D4' },
  emerald: { chip: 'from-emerald-500 to-teal-600',   stroke: '#10B981' },
  amber:   { chip: 'from-amber-500 to-orange-600',   stroke: '#F59E0B' },
  rose:    { chip: 'from-rose-500 to-pink-600',      stroke: '#F43F5E' },
  blue:    { chip: 'from-blue-500 to-indigo-600',    stroke: '#3B82F6' },
};

interface KpiCardProps {
  title:     string;
  value:     ReactNode;
  icon:      ElementType;
  tone?:     Tone;
  /** Percent change vs the previous period; null/undefined hides the badge. */
  delta?:    number | null;
  /** Whether going up is good news (default). Pass false for costs, null when neither direction is better (e.g. spend). */
  upIsGood?: boolean | null;
  caption?:  string;
  trend?:    number[];
  className?: string;
}

export function KpiCard({ title, value, icon: Icon, tone = 'violet', delta, upIsGood = true, caption, trend, className }: KpiCardProps) {
  const t = TONE[tone];
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const good = hasDelta ? (delta! === 0 || upIsGood === null ? null : (delta! > 0) === upIsGood) : null;

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* the faint dot grid from the Nexora tiles */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(0,0,0,0.07)_1px,transparent_1px)] [background-size:16px_16px] dark:[background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)]" />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/10 p-0.5 shadow-sm dark:border-white/10">
            <div className={cn('flex size-full items-center justify-center rounded-md bg-gradient-to-br text-white', t.chip)}>
              <Icon className="size-5" />
            </div>
          </div>
        </div>

        <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums dark:text-white">{value}</p>

        <div className="mt-2 flex min-h-[22px] items-center gap-2 text-xs">
          {hasDelta && (
            <span className={cn(
              'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-medium tabular-nums',
              good === null && 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400',
              good === true && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400',
              good === false && 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-400',
            )}>
              {delta! >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {formatDelta(delta!)}
            </span>
          )}
          {caption && <span className="truncate text-zinc-500">{caption}</span>}
        </div>

        {trend && trend.length > 1 && (
          <div className="mt-3 -mb-1" style={{ color: t.stroke }}>
            <Sparkline values={trend} stroke={t.stroke} />
          </div>
        )}
      </div>
    </Card>
  );
}
