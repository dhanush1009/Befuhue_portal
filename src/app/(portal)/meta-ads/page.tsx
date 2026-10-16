'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Wallet, Target, Coins, TrendingUp, Eye, MousePointerClick, Percent, RefreshCw, Settings2, Loader2, Info, Link2,
  Megaphone, CalendarRange,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDelta, formatMoney, formatNumber, formatPct } from '@/lib/format';
import { presetRange, PRESET_LABELS, rangeLabel, type RangePreset } from '@/lib/meta/ranges';
import { isGood } from '@/lib/meta/metrics';
import { useAuth } from '@/hooks/useAuth';
import { useMetaAccounts, useMetaOverview, useMetaStatus, syncMetaAccount } from '@/hooks/useMeta';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { Donut } from '@/components/charts/Donut';
import { ShareBars } from '@/components/charts/BarChart';
import { MetaTabs } from '@/components/meta/MetaTabs';
import { MetaSetupCard } from '@/components/meta/MetaSetupCard';
import { CampaignsTable } from '@/components/meta/CampaignsTable';
import { BreakdownCard } from '@/components/meta/BreakdownCard';

type ChartMetric = 'spend' | 'results' | 'impressions' | 'clicks';
const COLORS = ['#8E51FF', '#06B6D4', '#10B981', '#F59E0B', '#F43F5E', '#3B82F6'];

const SELECT = 'h-9 rounded-lg border border-black/10 bg-white px-3 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand dark:border-white/10 dark:bg-surface-dark-3 dark:text-zinc-100';

function MetaAdsInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();

  const today = format(new Date(), 'yyyy-MM-dd');
  const [preset, setPreset] = useState<RangePreset>('last30');
  const [custom, setCustom] = useState({ from: presetRange('last30', today).from, to: today });
  const [scope, setScope] = useState<{ clientId: string | null; accountId: string | null }>({
    clientId: sp.get('clientId'), accountId: sp.get('accountId'),
  });
  const [currency, setCurrency] = useState<string | null>(null);
  const [metric, setMetric] = useState<ChartMetric>('spend');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { if (!authLoading && !isAdmin) router.replace('/dashboard'); }, [authLoading, isAdmin, router]);

  const range = preset === 'custom' ? custom : presetRange(preset, today);
  const status = useMetaStatus();
  const accounts = useMetaAccounts();
  const enabled = useMemo(() => (accounts.data ?? []).filter((a) => a.isEnabled), [accounts.data]);
  const connected = !!status.data?.configured;
  const hasAccounts = enabled.length > 0;
  // Stored data stays viewable even if the token is later removed; only syncing needs it.

  const query = useMetaOverview({ ...range, clientId: scope.clientId, accountId: scope.accountId, currency }, hasAccounts && isAdmin);
  const o = query.data;
  const cur = o?.currency ?? currency ?? 'INR';

  // Pick the scope with ONE select: a client (all of its accounts) or a single ad account
  const clients = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of enabled) if (a.clientId && a.clientName) m.set(a.clientId, a.clientName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [enabled]);
  const scopeValue = scope.clientId ? `c:${scope.clientId}` : scope.accountId ? `a:${scope.accountId}` : '';

  async function syncNow() {
    if (!enabled.length) return;
    setSyncing(true);
    let ok = 0, failed = 0, firstError = '';
    for (const a of enabled) {
      try { await syncMetaAccount({ accountId: a.id }); ok++; }
      catch (e) { failed++; firstError ||= (e as Error).message; if ((e as { code?: string }).code === 'AUTH') break; }
    }
    setSyncing(false);
    void qc.invalidateQueries({ queryKey: ['meta'] });
    if (failed) toast.error(`${failed} account${failed === 1 ? '' : 's'} failed: ${firstError}`);
    else toast.success(`Refreshed ${ok} account${ok === 1 ? '' : 's'}`);
  }

  if (authLoading || !isAdmin) return null;

  const series = (o?.series ?? []).map((p, i) => ({ ...p, prev: o?.previousSeries[i] }));
  const moneyFmt = (v: number) => formatMoney(v, cur, true);
  const chartFmt = metric === 'spend' ? moneyFmt : (v: number) => formatNumber(v);
  const chartColor = { spend: '#8E51FF', results: '#10B981', impressions: '#06B6D4', clicks: '#F59E0B' }[metric];
  const chartPoints = series.map((p) => ({
    label: format(parseISO(p.date), 'EEE, d MMM'), axis: format(parseISO(p.date), 'd MMM'),
    value: p[metric], prev: o?.previousSeries[series.indexOf(p)]?.[metric],
  }));

  const t = o?.totals, d = o?.deltas ?? {};
  const costTrend = series.map((p) => (p.results > 0 ? p.spend / p.results : 0));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <PageHeader
        title="Meta Ads"
        description="Daily ad performance pulled straight from Meta, per client."
        actions={<MetaTabs />}
      />

      {!connected && !hasAccounts && !status.isLoading && !accounts.isLoading && <MetaSetupCard />}

      {!connected && hasAccounts && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>Meta is not connected right now, so no new data is being pulled. You are looking at what was synced before. <Link href="/meta-ads/accounts" className="font-medium underline underline-offset-2">Reconnect</Link>.</span>
        </div>
      )}

      {connected && !hasAccounts && !accounts.isLoading && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand/10 text-brand"><Megaphone className="size-6" /></div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Meta is connected. Now pick your accounts.</h2>
            <p className="max-w-md text-sm text-zinc-500">Choose which ad accounts to track and link each one to the right client. Only the accounts you switch on are ever synced.</p>
            <Link href="/meta-ads/accounts" className="mt-1 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover">
              <Settings2 className="size-4" /> Choose accounts
            </Link>
          </CardBody>
        </Card>
      )}

      {hasAccounts && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Account or client" className={cn(SELECT, 'max-w-[16rem]')} value={scopeValue}
              onChange={(e) => {
                const v = e.target.value;
                setCurrency(null);
                setScope(v.startsWith('c:') ? { clientId: v.slice(2), accountId: null } : v.startsWith('a:') ? { clientId: null, accountId: v.slice(2) } : { clientId: null, accountId: null });
              }}>
              <option value="">All enabled accounts</option>
              {clients.length > 0 && <optgroup label="Clients">{clients.map(([id, name]) => <option key={id} value={`c:${id}`}>{name}</option>)}</optgroup>}
              <optgroup label="Ad accounts">{enabled.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}</optgroup>
            </select>

            <select aria-label="Date range" className={SELECT} value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)}>
              {(Object.keys(PRESET_LABELS) as (keyof typeof PRESET_LABELS)[]).map((k) => <option key={k} value={k}>{PRESET_LABELS[k]}</option>)}
              <option value="custom">Custom range…</option>
            </select>
            {preset === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input type="date" className={cn(SELECT, 'dark:[color-scheme:dark]')} value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} />
                <span className="text-zinc-400">–</span>
                <input type="date" className={cn(SELECT, 'dark:[color-scheme:dark]')} value={custom.to} min={custom.from} max={today} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} />
              </div>
            )}

            {(o?.currencies.length ?? 0) > 1 && (
              <div className="flex gap-1 rounded-lg bg-black/[0.05] p-1 dark:bg-white/[0.07]" role="group" aria-label="Currency">
                {o!.currencies.map((c) => (
                  <button key={c.code} onClick={() => setCurrency(c.code)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', c.code === cur ? 'bg-white text-zinc-900 shadow-sm dark:bg-surface-dark-2 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')}>{c.code}</button>
                ))}
              </div>
            )}

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-1.5 text-xs text-zinc-500 sm:flex">
                <CalendarRange className="size-3.5" /> {rangeLabel(range.from, range.to)}
                {o?.lastSyncedAt && <span>· updated {formatDistanceToNow(new Date(o.lastSyncedAt), { addSuffix: true })}</span>}
              </span>
              <button onClick={syncNow} disabled={syncing || !connected} title={connected ? undefined : 'Connect Meta to sync'} className="flex h-9 items-center gap-2 rounded-lg border border-black/10 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[0.04] disabled:opacity-60 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.06]">
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Sync now
              </button>
            </div>
          </div>

          {(status.data?.errors ?? 0) > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>{status.data!.errors} account{status.data!.errors === 1 ? ' hit' : 's hit'} an error on the last sync. <Link href="/meta-ads/accounts" className="font-medium underline underline-offset-2">See which</Link>.</span>
            </div>
          )}

          {/* KPI tiles */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Spend" tone="violet" icon={Wallet} value={t ? formatMoney(t.spend, cur) : '—'} delta={d.spend} upIsGood={null} caption="vs previous period" trend={series.map((p) => p.spend)} />
            <KpiCard title={o?.resultLabel ?? 'Results'} tone="emerald" icon={Target} value={t ? formatNumber(t.results) : '—'} delta={d.results} caption="vs previous period" trend={series.map((p) => p.results)} />
            <KpiCard title="Cost per result" tone="amber" icon={Coins} value={t ? formatMoney(t.costPerResult, cur) : '—'} delta={d.costPerResult} upIsGood={false} caption="lower is better" trend={costTrend} />
            {t?.roas != null
              ? <KpiCard title="ROAS" tone="blue" icon={TrendingUp} value={`${t.roas.toFixed(2)}×`} delta={d.roas} caption={`${formatMoney(t.purchaseValue, cur, true)} revenue`} />
              : <KpiCard title="CTR" tone="cyan" icon={Percent} value={t ? formatPct(t.ctr, 2) : '—'} delta={d.ctr} caption="clicks per impression" trend={series.map((p) => (p.impressions ? (p.clicks / p.impressions) * 100 : 0))} />}
          </div>

          {/* Trend + results */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Performance over time"
                subtitle="Dashed line = the previous period, for comparison"
                action={
                  <div className="flex gap-1 rounded-lg bg-black/[0.05] p-1 dark:bg-white/[0.07]">
                    {([['spend', 'Spend'], ['results', o?.resultLabel ?? 'Results'], ['impressions', 'Impressions'], ['clicks', 'Clicks']] as const).map(([k, label]) => (
                      <button key={k} onClick={() => setMetric(k)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', metric === k ? 'bg-white text-zinc-900 shadow-sm dark:bg-surface-dark-2 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')}>{label}</button>
                    ))}
                  </div>
                }
              />
              <CardBody>
                {query.isLoading && !o ? <div className="h-[260px] animate-pulse rounded-lg bg-black/5 dark:bg-white/10" /> : (
                  <AreaChart data={chartPoints} height={260} color={chartColor} format={chartFmt} seriesName={metric === 'results' ? (o?.resultLabel ?? 'Results') : metric[0].toUpperCase() + metric.slice(1)} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="All results" subtitle="Everything that happened, including custom conversions" />
              <CardBody>
                {!o || o.results.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">No results recorded in this range.</p>
                ) : (
                  <ShareBars rows={o.results.slice(0, 8).map((r, i) => ({
                    key: r.key, label: r.label, color: COLORS[i % COLORS.length],
                    share: (r.count / o.results[0].count) * 100,
                    value: formatNumber(r.count),
                    sub: r.costPer !== null ? `${formatMoney(r.costPer, cur, true)} each` : undefined,
                  }))} />
                )}
              </CardBody>
            </Card>
          </div>

          {/* Secondary metrics */}
          <Card>
            <div className="grid grid-cols-2 divide-black/10 sm:grid-cols-4 lg:grid-cols-7 lg:divide-x dark:divide-white/10">
              {([
                ['Impressions', t ? formatNumber(t.impressions) : '—', d.impressions, 'impressions', Eye],
                ['Reach*', t ? formatNumber(t.reach) : '—', d.reach, 'reach', Eye],
                ['Clicks', t ? formatNumber(t.clicks) : '—', d.clicks, 'clicks', MousePointerClick],
                ['CTR', t ? formatPct(t.ctr, 2) : '—', d.ctr, 'ctr', Percent],
                ['CPC', t ? formatMoney(t.cpc, cur) : '—', d.cpc, 'cpc', Coins],
                ['CPM', t ? formatMoney(t.cpm, cur) : '—', d.cpm, 'cpm', Coins],
                ['Frequency', t?.frequency != null ? t.frequency.toFixed(2) : '—', d.frequency, 'frequency', Link2],
              ] as const).map(([label, value, delta, key, Icon]) => {
                const good = isGood(key, delta ?? null);
                return (
                  <div key={label} className="p-4">
                    <p className="flex items-center gap-1.5 text-xs text-zinc-500"><Icon className="size-3.5" />{label}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p>
                    <p className={cn('text-xs tabular-nums', good === true ? 'text-emerald-600 dark:text-emerald-400' : good === false ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400')}>
                      {delta === null || delta === undefined ? '—' : formatDelta(delta)}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="border-t border-black/10 px-4 py-2 text-[11px] text-zinc-500 dark:border-white/10">
              *Reach is summed day by day: a person who saw your ads on two days counts twice, so use it as a trend, not a unique-people count.
            </p>
          </Card>

          {/* Spend split + accounts */}
          {(o?.accounts.length ?? 0) > 1 && (
            <Card>
              <CardHeader title="By account" subtitle={`Spend in ${cur}`} />
              <div className="flex flex-col items-center gap-6 p-5 md:flex-row">
                <Donut
                  size={168}
                  slices={o!.accounts.slice(0, 6).map((a, i) => ({ key: a.id, label: a.name, value: a.totals.spend, color: COLORS[i % COLORS.length] }))}
                  center={<><p className="text-xs text-zinc-500">Total</p><p className="text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">{formatMoney(t?.spend ?? 0, cur, true)}</p></>}
                />
                <div className="w-full min-w-0 flex-1 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="text-xs text-zinc-500"><tr>
                      <th className="py-1.5 text-left font-medium">Account</th><th className="py-1.5 text-right font-medium">Spend</th><th className="py-1.5 text-right font-medium">{o!.resultLabel}</th><th className="py-1.5 text-right font-medium">Cost / result</th>
                    </tr></thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {o!.accounts.map((a, i) => (
                        <tr key={a.id}>
                          <td className="py-2"><span className="flex items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="min-w-0"><span className="block truncate font-medium text-zinc-900 dark:text-white">{a.name}</span>{a.clientName && <span className="block truncate text-xs text-zinc-500">{a.clientName}</span>}</span></span></td>
                          <td className="py-2 text-right tabular-nums">{formatMoney(a.totals.spend, cur)}</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(a.totals.results)}</td>
                          <td className="py-2 text-right tabular-nums">{formatMoney(a.totals.costPerResult, cur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}

          <CampaignsTable scope={{ ...range, clientId: scope.clientId, accountId: scope.accountId }} currency={cur} resultLabel={o?.resultLabel ?? 'Results'} />
          <BreakdownCard scope={{ ...range, clientId: scope.clientId, accountId: scope.accountId }} currency={cur} resultLabel={o?.resultLabel ?? 'Results'} />
        </>
      )}
    </div>
  );
}

export default function MetaAdsPage() {
  return (
    <Suspense fallback={null}>
      <MetaAdsInner />
    </Suspense>
  );
}
