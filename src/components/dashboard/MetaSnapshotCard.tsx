'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ArrowRight, BarChart3, Megaphone } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { AreaChart } from '@/components/charts/AreaChart';
import { formatDelta, formatMoney, formatNumber } from '@/lib/format';
import { presetRange } from '@/lib/meta/ranges';
import { isGood } from '@/lib/meta/metrics';
import { cn } from '@/lib/utils';
import { useMetaOverview, useMetaStatus } from '@/hooks/useMeta';

/** Admin-only glance at the last 14 days of ad performance, with a path into the full Meta Ads section. */
export function MetaSnapshotCard() {
  const status = useMetaStatus();
  const connected = (status.data?.accounts.enabled ?? 0) > 0; // 'connected' here = there is something to show
  const today = format(new Date(), 'yyyy-MM-dd');
  const range = presetRange('last14', today);
  const { data: o } = useMetaOverview(range, connected);

  const icon = <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"><BarChart3 className="size-[18px]" /></div>;
  const link = <Link href="/meta-ads" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">Meta Ads <ArrowRight className="size-3" /></Link>;

  if (status.isLoading) return <Card className="h-full min-h-[18rem] animate-pulse" />;

  if (!connected) {
    return (
      <Card className="h-full">
        <CardHeader icon={icon} title="Ad performance" subtitle="Meta Ads, per client" />
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Megaphone className="size-5" /></div>
          <p className="max-w-sm text-sm text-zinc-500">
            {status.data?.configured ? 'Pick which ad accounts to track and link them to your clients.' : 'Connect Meta to see spend, results and cost per result for every client, right here.'}
          </p>
          <Link href="/meta-ads" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover">
            {status.data?.configured ? 'Choose accounts' : 'Set up Meta Ads'}
          </Link>
        </div>
      </Card>
    );
  }

  const cur = o?.currency ?? 'INR';
  const t = o?.totals;
  const d = o?.deltas ?? {};
  const points = (o?.series ?? []).map((p, i) => ({
    label: format(parseISO(p.date), 'EEE, d MMM'), axis: format(parseISO(p.date), 'd MMM'), value: p.spend, prev: o?.previousSeries[i]?.spend,
  }));

  const tile = (label: string, value: string, delta: number | null | undefined, metric: string) => {
    const good = isGood(metric, delta ?? null);
    return (
      <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p>
        <p className={cn('text-xs tabular-nums', good === true ? 'text-emerald-600 dark:text-emerald-400' : good === false ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400')}>{delta == null ? '—' : formatDelta(delta)}</p>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader icon={icon} title="Ad performance" subtitle={`Last 14 days · ${cur}${(o?.currencies.length ?? 0) > 1 ? ` (+${o!.currencies.length - 1} more currency)` : ''}`} action={link} />
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-3 gap-3">
          {tile('Spend', t ? formatMoney(t.spend, cur, true) : '—', d.spend, 'spend')}
          {tile(o?.resultLabel ?? 'Results', t ? formatNumber(t.results) : '—', d.results, 'results')}
          {tile('Cost / result', t ? formatMoney(t.costPerResult, cur, true) : '—', d.costPerResult, 'costPerResult')}
        </div>
        {points.length > 0 && <AreaChart data={points} height={150} format={(v) => formatMoney(v, cur, true)} seriesName="Spend" />}
      </div>
    </Card>
  );
}
