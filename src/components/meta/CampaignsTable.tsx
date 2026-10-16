'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronUp, ChevronDown, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney, formatNumber, formatPct } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/Card';
import { useMetaObjects, type MetaScope, type CampaignLine } from '@/hooks/useMeta';

type SortKey = 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'results' | 'costPerResult' | 'roas';

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_SALES: 'Sales', OUTCOME_LEADS: 'Leads', OUTCOME_TRAFFIC: 'Traffic', OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_ENGAGEMENT: 'Engagement', OUTCOME_APP_PROMOTION: 'App promotion',
};

interface Crumb { level: 'CAMPAIGN' | 'ADSET' | 'AD'; id?: string; name: string }

export function CampaignsTable({ scope, currency, resultLabel }: { scope: MetaScope; currency: string; resultLabel: string }) {
  const [trail, setTrail] = useState<Crumb[]>([{ level: 'CAMPAIGN', name: 'All campaigns' }]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'spend', dir: 'desc' });
  const current = trail[trail.length - 1];
  // Which level to list: the campaigns, the ad sets of the chosen campaign, or the ads of the chosen ad set
  const level = trail.length === 1 ? 'CAMPAIGN' : trail.length === 2 ? 'ADSET' : 'AD';
  const campaignId = trail[1]?.id;
  const adsetId = trail[2]?.id;

  const { data, isLoading } = useMetaObjects({ ...scope, currency, level, campaignId, adsetId });
  const lines = useMemo(() => {
    const rows = [...(data?.lines ?? [])];
    const val = (l: CampaignLine) => (l[sort.key] ?? -1) as number;
    rows.sort((a, b) => (sort.dir === 'desc' ? val(b) - val(a) : val(a) - val(b)));
    return rows;
  }, [data, sort]);

  const drill = (l: CampaignLine) => {
    if (level === 'AD') return;
    setTrail([...trail, { level: level === 'CAMPAIGN' ? 'ADSET' : 'AD', id: l.id, name: l.name }]);
  };

  const th = (key: SortKey, label: string, className?: string) => (
    <th className={cn('px-3 py-2.5 text-right font-medium', className)}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white">
        {label}
        {sort.key === key && (sort.dir === 'desc' ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />)}
      </button>
    </th>
  );

  function exportCsv() {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ['Name', 'Account', 'Objective', 'Spend', 'Impressions', 'Clicks', 'CTR %', 'CPC', resultLabel, `Cost per ${resultLabel.toLowerCase()}`, 'ROAS'];
    const body = lines.map((l) => [q(l.name), q(l.accountName), l.objective ?? '', l.spend.toFixed(2), l.impressions, l.clicks, l.ctr.toFixed(2), l.cpc?.toFixed(2) ?? '', l.results, l.costPerResult?.toFixed(2) ?? '', l.roas?.toFixed(2) ?? ''].join(','));
    const url = URL.createObjectURL(new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `meta-${level.toLowerCase()}-${scope.from}_${scope.to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const title = level === 'CAMPAIGN' ? 'Campaigns' : level === 'ADSET' ? 'Ad sets' : 'Ads';

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={level === 'CAMPAIGN' ? 'Click a campaign to see its ad sets, then its ads' : undefined}
        action={
          <button onClick={exportCsv} disabled={!lines.length} className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-black/[0.04] disabled:opacity-40 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]">
            <Download className="size-3.5" /> CSV
          </button>
        }
      />

      {trail.length > 1 && (
        <nav className="flex flex-wrap items-center gap-1 px-5 pt-3 text-xs text-zinc-500" aria-label="Drill-down">
          {trail.map((c, i) => (
            <span key={`${c.level}-${c.id ?? 'root'}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" />}
              <button onClick={() => setTrail(trail.slice(0, i + 1))} className={cn('max-w-[16rem] truncate hover:text-brand', i === trail.length - 1 && 'font-medium text-zinc-900 dark:text-white')}>{c.name}</button>
            </span>
          ))}
        </nav>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-y border-black/10 text-xs text-zinc-500 dark:border-white/10">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">{title.replace(/s$/, '')}</th>
              {th('spend', 'Spend')}
              {th('impressions', 'Impr.')}
              {th('clicks', 'Clicks')}
              {th('ctr', 'CTR')}
              {th('cpc', 'CPC')}
              {th('results', resultLabel)}
              {th('costPerResult', 'Cost / result')}
              {th('roas', 'ROAS', 'pr-5')}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {isLoading && !data && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}><td colSpan={9} className="px-5 py-3"><div className="h-4 animate-pulse rounded bg-black/5 dark:bg-white/10" /></td></tr>
            ))}
            {!isLoading && lines.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-zinc-500">No {title.toLowerCase()} with data in this range.</td></tr>
            )}
            {lines.map((l) => (
              <tr key={l.id} onClick={() => drill(l)} className={cn('transition-colors', level !== 'AD' && 'cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]')}>
                <td className="max-w-[20rem] px-5 py-3">
                  <p className="truncate font-medium text-zinc-900 dark:text-white">{l.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {[l.objective ? OBJECTIVE_LABELS[l.objective] ?? l.objective : null, l.accountName].filter(Boolean).join(' · ')}
                  </p>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <span className="font-medium text-zinc-900 dark:text-white">{formatMoney(l.spend, currency)}</span>
                  <div className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, l.share)}%` }} /></div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{formatNumber(l.impressions)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{formatNumber(l.clicks)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{formatPct(l.ctr, 2)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{formatMoney(l.cpc, currency)}</td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-zinc-900 dark:text-white">{formatNumber(l.results)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{formatMoney(l.costPerResult, currency)}</td>
                <td className="px-3 py-3 pr-5 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{l.roas === null ? '—' : `${l.roas.toFixed(2)}×`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {current.level !== 'CAMPAIGN' && <p className="px-5 pb-4 pt-2 text-xs text-zinc-500">Showing {title.toLowerCase()} inside “{current.name}”.</p>}
    </Card>
  );
}
