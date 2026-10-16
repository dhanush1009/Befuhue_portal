'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatMoney, formatNumber } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/Card';
import { ShareBars } from '@/components/charts/BarChart';
import { useMetaBreakdown, type MetaScope } from '@/hooks/useMeta';

const KINDS = [
  { id: 'age_gender' as const, label: 'Age & gender', hint: 'Who your spend reaches' },
  { id: 'placement' as const,  label: 'Placement',    hint: 'Facebook, Instagram, feed, reels…' },
  { id: 'device' as const,     label: 'Device',       hint: 'Mobile, desktop, tablet' },
];
const COLORS = ['#8E51FF', '#06B6D4', '#10B981', '#F59E0B', '#F43F5E', '#3B82F6', '#A855F7', '#84CC16'];

export function BreakdownCard({ scope, currency, resultLabel }: { scope: MetaScope; currency: string; resultLabel: string }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('age_gender');
  const { data, isLoading } = useMetaBreakdown({ ...scope, currency, kind });
  const lines = (data?.lines ?? []).slice(0, 10);
  const active = KINDS.find((k) => k.id === kind)!;

  return (
    <Card>
      <CardHeader
        title="Breakdown"
        subtitle={active.hint}
        action={
          <div className="flex gap-1 rounded-lg bg-black/[0.05] p-1 dark:bg-white/[0.07]">
            {KINDS.map((k) => (
              <button key={k.id} onClick={() => setKind(k.id)}
                className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', kind === k.id ? 'bg-white text-zinc-900 shadow-sm dark:bg-surface-dark-2 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')}>
                {k.label}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-5">
        {isLoading && !data ? (
          <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-black/5 dark:bg-white/10" />)}</div>
        ) : lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No breakdown data for this range yet.</p>
        ) : (
          <ShareBars
            rows={lines.map((l, i) => ({
              key: l.key, label: l.label, share: l.share, color: COLORS[i % COLORS.length],
              value: formatMoney(l.spend, currency, true),
              sub: l.results > 0 ? `${formatNumber(l.results)} ${resultLabel.toLowerCase()} · ${formatMoney(l.costPerResult, currency, true)} each` : `${l.share.toFixed(0)}%`,
            }))}
          />
        )}
      </div>
    </Card>
  );
}
