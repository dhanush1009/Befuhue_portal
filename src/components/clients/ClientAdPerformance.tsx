'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDelta, formatMoney, formatNumber } from '@/lib/format';
import { presetRange } from '@/lib/meta/ranges';
import { isGood } from '@/lib/meta/metrics';
import { useMetaAccounts, useMetaOverview } from '@/hooks/useMeta';
import { AreaChart } from '@/components/charts/AreaChart';

/** Admin-only: this client's Meta ad performance (last 30 days), from the ad accounts linked to it. */
export function ClientAdPerformance({ clientId, clientName }: { clientId: string; clientName: string }) {
  const accounts = useMetaAccounts();
  const linked = (accounts.data ?? []).filter((a) => a.isEnabled && a.clientId === clientId);
  const today = format(new Date(), 'yyyy-MM-dd');
  const range = presetRange('last30', today);
  const { data: o } = useMetaOverview({ ...range, clientId }, linked.length > 0);

  if (accounts.isLoading) return null;

  const shell = 'bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 p-6 mb-5';
  const heading = (
    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
      <BarChart3 className="w-3.5 h-3.5 text-brand" /> Meta Ads · last 30 days
    </p>
  );

  if (linked.length === 0) {
    return (
      <div className={shell}>
        {heading}
        <p className="mt-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          No Meta ad account is linked to {clientName} yet.{' '}
          <Link href="/meta-ads/accounts" className="font-semibold text-brand hover:underline">Link one</Link>
        </p>
      </div>
    );
  }

  const cur = o?.currency ?? linked[0].currency;
  const t = o?.totals;
  const d = o?.deltas ?? {};
  const points = (o?.series ?? []).map((p, i) => ({
    label: format(parseISO(p.date), 'EEE, d MMM'), axis: format(parseISO(p.date), 'd MMM'), value: p.spend, prev: o?.previousSeries[i]?.spend,
  }));
  const tile = (label: string, value: string, delta: number | null | undefined, metric: string) => {
    const good = isGood(metric, delta ?? null);
    return (
      <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 bg-gray-50/50 dark:bg-transparent">
        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{label}</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-zinc-950 dark:text-white">{value}</p>
        <p className={cn('text-xs tabular-nums font-medium', good === true ? 'text-emerald-700 dark:text-emerald-400' : good === false ? 'text-rose-700 dark:text-rose-400' : 'text-zinc-500')}>{delta == null ? '—' : `${formatDelta(delta)} vs previous`}</p>
      </div>
    );
  };

  return (
    <div className={shell}>
      <div className="flex items-center justify-between gap-3">
        {heading}
        <Link href={`/meta-ads?clientId=${clientId}`} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Full report <ArrowRight className="size-3" /></Link>
      </div>
      <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">{linked.length} ad account{linked.length === 1 ? '' : 's'} · {cur}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {tile('Spend', t ? formatMoney(t.spend, cur, true) : '—', d.spend, 'spend')}
        {tile(o?.resultLabel ?? 'Results', t ? formatNumber(t.results) : '—', d.results, 'results')}
        {tile('Cost / result', t ? formatMoney(t.costPerResult, cur, true) : '—', d.costPerResult, 'costPerResult')}
      </div>
      {points.length > 0 && <div className="mt-5"><AreaChart data={points} height={150} format={(v) => formatMoney(v, cur, true)} seriesName="Spend" /></div>}
    </div>
  );
}
