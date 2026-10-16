'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
} from 'recharts';
import { Zap, Trophy, Users, Calendar, CheckCircle2, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { usePerformance } from '@/hooks/usePerformance';
import type { DateRangeFilter, TimeframeFilter } from '@/hooks/useTaskCompletions';
import { cn } from '@/lib/utils';

const DATE_RANGE_OPTIONS: { key: DateRangeFilter; label: string }[] = [
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year',  label: 'This Year' },
  { key: 'all_time',   label: 'All Time' },
];

const TIMEFRAME_OPTIONS: { key: TimeframeFilter; label: string }[] = [
  { key: 'daily',   label: 'Daily' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

interface PerformanceGraphProps {
  isAdmin?: boolean;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AdminPerformanceTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="min-w-48 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2.5">
        {data.avatarUrl ? (
          <img
            src={data.avatarUrl}
            alt={data.name}
            className="size-8 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/10"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-amber-500/15 text-xs font-semibold text-amber-700 dark:text-amber-300">
            {data.name?.charAt(0) ?? '?'}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">{data.name}</p>
          {data.designation && (
            <p className="truncate text-[11px] text-gray-500 dark:text-zinc-400">{data.designation}</p>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-gray-100 dark:border-zinc-800 pt-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-zinc-400">Total Points:</span>
          <span className="font-bold tabular-nums text-amber-600 dark:text-amber-300">{data.totalPoints} pts</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-zinc-400">Completed Tasks:</span>
          <span className="font-medium tabular-nums text-gray-900 dark:text-white">{data.totalCompleted}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-emerald-600 dark:text-emerald-400">Early (+2 pts):</span>
          <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{data.earlyCount}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-amber-600 dark:text-amber-400">On-Time (+1 pt):</span>
          <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">{data.onTimeCount}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-rose-600 dark:text-rose-400">Overtime (0 pts):</span>
          <span className="font-medium tabular-nums text-rose-600 dark:text-rose-400">{data.lateCount}</span>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EmployeePerformanceTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="min-w-44 rounded-xl border border-gray-200 bg-white p-3 shadow-xl text-xs dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-semibold text-gray-900 dark:text-white">{data.label}</p>
      {data.fullDate && <p className="text-[11px] text-gray-500 dark:text-zinc-400">{data.fullDate}</p>}

      <div className="mt-2.5 space-y-1.5 border-t border-gray-100 dark:border-zinc-800 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-zinc-400">Points Earned:</span>
          <span className="font-bold tabular-nums text-amber-600 dark:text-amber-300">{data.pointsEarned} pts</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-zinc-400">Tasks Completed:</span>
          <span className="font-medium tabular-nums text-gray-900 dark:text-white">{data.completedCount}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-emerald-600 dark:text-emerald-400">Early (2 pts):</span>
          <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{data.earlyCount}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-amber-600 dark:text-amber-400">On-Time (1 pt):</span>
          <span className="tabular-nums text-amber-600 dark:text-amber-400">{data.onTimeCount}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-rose-600 dark:text-rose-400">Overtime (0 pts):</span>
          <span className="tabular-nums text-rose-600 dark:text-rose-400">{data.lateCount}</span>
        </div>
      </div>
    </div>
  );
}

export function PerformanceGraph({ isAdmin = false, className }: PerformanceGraphProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [range, setRange] = useState<DateRangeFilter>('this_month');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('daily');
  const [adminViewMode, setAdminViewMode] = useState<'team' | 'employee'>(isAdmin ? 'team' : 'employee');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isAdmin) setAdminViewMode('team');
  }, [isAdmin]);

  useEffect(() => {
    setMounted(true);
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 150);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const effectiveView = isAdmin ? adminViewMode : 'employee';

  const { data, isLoading } = usePerformance({
    range,
    timeframe,
    view: effectiveView,
  });

  const chartData = data?.chartData ?? [];

  // Y-axis upper limit
  const maxVal = useMemo(() => {
    if (!chartData.length) return 4;
    const values = chartData.map((d) => (effectiveView === 'team' ? d.totalPoints ?? 0 : d.pointsEarned ?? 0));
    const highest = Math.max(...values);
    return Math.max(3, highest + 1);
  }, [chartData, effectiveView]);

  return (
    <Card className={cn('w-full flex flex-col', className)}>
      <CardHeader
        icon={
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
            <Zap className="size-[18px]" />
          </div>
        }
        title={
          isAdmin && adminViewMode === 'team'
            ? 'Employee Performance Points'
            : 'My Performance Points Over Time'
        }
        subtitle={
          isAdmin && adminViewMode === 'team'
            ? 'Comparison of total performance points earned per employee (sorted highest first)'
            : 'Track points earned: Early (+2 pts), On-Time (+1 pt), Overtime (0 pts)'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Admin view toggle */}
            {isAdmin && (
              <div className="flex rounded-lg border border-gray-200 bg-gray-100/80 p-0.5 dark:border-white/10 dark:bg-black/20">
                <button
                  type="button"
                  onClick={() => setAdminViewMode('team')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
                    adminViewMode === 'team'
                      ? 'bg-amber-500 text-white font-semibold shadow-xs dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-500/30'
                      : 'text-gray-600 hover:text-gray-900 border border-transparent dark:text-zinc-400 dark:hover:text-white',
                  )}
                >
                  <Users className="size-3" />
                  Team
                </button>
                <button
                  type="button"
                  onClick={() => setAdminViewMode('employee')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
                    adminViewMode === 'employee'
                      ? 'bg-amber-500 text-white font-semibold shadow-xs dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-500/30'
                      : 'text-gray-600 hover:text-gray-900 border border-transparent dark:text-zinc-400 dark:hover:text-white',
                  )}
                >
                  <TrendingUp className="size-3" />
                  My Points
                </button>
              </div>
            )}

            {/* Timeframe selector for Employee view */}
            {effectiveView === 'employee' && (
              <div className="flex rounded-lg border border-gray-200 bg-gray-100/80 p-0.5 dark:border-white/10 dark:bg-black/20">
                {TIMEFRAME_OPTIONS.map((tf) => (
                  <button
                    key={tf.key}
                    type="button"
                    onClick={() => setTimeframe(tf.key)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs transition-colors',
                      timeframe === tf.key
                        ? 'bg-amber-500 text-white font-semibold shadow-xs dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-500/30'
                        : 'text-gray-600 hover:text-gray-900 border border-transparent dark:text-zinc-400 dark:hover:text-white',
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            )}

            {/* Date range filters for Admin view */}
            {effectiveView === 'team' && (
              <div className="flex flex-wrap rounded-lg border border-gray-200 bg-gray-100/80 p-0.5 dark:border-white/10 dark:bg-black/20">
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRange(opt.key)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs transition-colors',
                      range === opt.key
                        ? 'bg-amber-500 text-white font-semibold shadow-xs dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-500/30'
                        : 'text-gray-600 hover:text-gray-900 border border-transparent dark:text-zinc-400 dark:hover:text-white',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      <CardBody className="flex flex-col pt-3 pb-5">
        {/* Metric summary banner */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/90 bg-gray-50/90 p-3 dark:border-white/5 dark:bg-surface-dark-2/60">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400">
              <Zap className="size-4" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {effectiveView === 'team' ? 'Total Team Performance Points' : 'My Total Points'}
              </p>
              <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                {isLoading
                  ? '–'
                  : effectiveView === 'team'
                    ? data?.totalTeamPoints ?? 0
                    : data?.myPerformance?.totalPoints ?? 0}
              </p>
            </div>
          </div>

          {effectiveView === 'team' && data?.topPerformer && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-100/80 px-3 py-1.5 text-xs text-amber-900 border border-amber-300/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
              <Trophy className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>
                #1 Top Performer: <strong className="text-amber-950 dark:text-amber-200 font-bold">{data.topPerformer.name}</strong> ({data.topPerformer.totalPoints} pts)
              </span>
            </div>
          )}

          {effectiveView === 'employee' && data?.myPerformance && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-100/80 px-3 py-1.5 text-xs text-amber-900 border border-amber-300/80 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">
              <Trophy className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>
                Current Standing: <strong className="font-bold">Rank {data.myPerformance.rankDisplay}</strong> (of {data.myPerformance.totalEmployees})
              </span>
            </div>
          )}
        </div>

        {/* Chart container with guaranteed fixed height */}
        <div className="w-full relative" style={{ height: 260, minHeight: 260 }}>
          {!mounted || isLoading ? (
            <div className="flex h-[260px] w-full animate-pulse items-center justify-center rounded-xl bg-gray-100 dark:bg-surface-dark-2">
              <span className="text-xs text-gray-500 dark:text-zinc-400">Loading performance points...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-[260px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
              <Zap className="mb-2 size-8 text-gray-400 dark:text-zinc-600" />
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-400">No performance points yet</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500">
                Complete tasks before or at deadline to earn performance points!
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260} minHeight={260} minWidth={100}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 16, left: -16, bottom: 20 }}
                onMouseMove={(state) => {
                  if (state?.activeTooltipIndex !== undefined && state.activeTooltipIndex !== null) {
                    const idx = Number(state.activeTooltipIndex);
                    setHoveredIndex(Number.isFinite(idx) ? idx : null);
                  }
                }}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <defs>
                  <linearGradient id="pointsBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#D97706" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="hoverPointsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FBBF24" stopOpacity={1} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#27272A' : '#E4E4E7'} />
                <XAxis
                  dataKey={effectiveView === 'team' ? 'displayName' : 'label'}
                  stroke={isDark ? '#71717A' : '#94A3B8'}
                  tickLine={false}
                  axisLine={{ stroke: isDark ? '#27272A' : '#E2E8F0' }}
                  interval={0}
                  tick={{ fill: isDark ? '#A1A1AA' : '#475569', fontSize: 11 }}
                  tickFormatter={(val) => {
                    const s = String(val ?? '');
                    return s.length > 14 ? `${s.slice(0, 12)}…` : s;
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, maxVal]}
                  stroke={isDark ? '#71717A' : '#94A3B8'}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: isDark ? '#71717A' : '#64748B', fontSize: 11 }}
                />
                <Tooltip
                  content={
                    effectiveView === 'team' ? (
                      <AdminPerformanceTooltip />
                    ) : (
                      <EmployeePerformanceTooltip />
                    )
                  }
                  cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }}
                />
                <Bar
                  dataKey={effectiveView === 'team' ? 'totalPoints' : 'pointsEarned'}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={52}
                  minPointSize={4}
                  animationDuration={500}
                >
                  <LabelList
                    dataKey={effectiveView === 'team' ? 'totalPoints' : 'pointsEarned'}
                    position="top"
                    fill="#F59E0B"
                    fontSize={12}
                    fontWeight={600}
                    offset={6}
                    formatter={(val: any) => (Number(val) > 0 ? `${val} pts` : '')}
                  />
                  {chartData.map((_entry, index) => (
                    <Cell
                      key={`perf-cell-${index}`}
                      fill={
                        hoveredIndex === index
                          ? 'url(#hoverPointsGradient)'
                          : 'url(#pointsBarGradient)'
                      }
                      className="transition-colors duration-150 cursor-pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
