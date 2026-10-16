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
import { CheckCircle2, TrendingUp, Users, Calendar, Award, Layers, Zap } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import {
  useTaskCompletions,
  type DateRangeFilter,
  type TimeframeFilter,
} from '@/hooks/useTaskCompletions';
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

interface TaskCompletionGraphProps {
  isAdmin?: boolean;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AdminCustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const early = Number(data.earlyCount ?? 0);
  const onTime = Number(data.onTimeCount ?? 0);
  const overtime = Number(data.lateCount ?? 0);
  const points = data.totalPoints !== undefined && data.totalPoints !== null
    ? Number(data.totalPoints)
    : early * 2 + onTime * 1;

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
          <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
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

      <div className="mt-2.5 space-y-1.5 border-t border-gray-100 dark:border-zinc-800 pt-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-zinc-400">Tasks Completed:</span>
          <span className="font-bold tabular-nums text-gray-900 dark:text-white">
            {data.completedCount}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Early (+2 pts):</span>
          <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{early}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-amber-600 dark:text-amber-400 font-medium">On-Time (+1 pt):</span>
          <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">{onTime}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-rose-600 dark:text-rose-400 font-medium">Overtime (0 pts):</span>
          <span className="font-bold tabular-nums text-rose-600 dark:text-rose-400">{overtime}</span>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-zinc-800/80 pt-1 text-[11px]">
          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
            <Zap className="size-3" /> Performance Points:
          </span>
          <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">{points} pts</span>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EmployeeCustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const early = Number(data.earlyCount ?? 0);
  const onTime = Number(data.onTimeCount ?? 0);
  const overtime = Number(data.lateCount ?? 0);

  return (
    <div className="min-w-44 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 text-xs">
      <p className="font-semibold text-gray-900 dark:text-white">{data.label}</p>
      {data.fullDate && (
        <p className="text-[11px] text-gray-500 dark:text-zinc-400">{data.fullDate}</p>
      )}
      <div className="mt-2.5 space-y-1.5 border-t border-gray-100 dark:border-zinc-800 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-zinc-400">Tasks Completed:</span>
          <span className="font-bold tabular-nums text-gray-900 dark:text-white">
            {data.completedCount}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Early (+2 pts):</span>
          <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{early}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-amber-600 dark:text-amber-400 font-medium">On-Time (+1 pt):</span>
          <span className="tabular-nums font-bold text-amber-600 dark:text-amber-400">{onTime}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-rose-600 dark:text-rose-400 font-medium">Overtime (0 pts):</span>
          <span className="tabular-nums font-bold text-rose-600 dark:text-rose-400">{overtime}</span>
        </div>
      </div>
    </div>
  );
}

export function TaskCompletionGraph({ isAdmin = false, className }: TaskCompletionGraphProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [range, setRange] = useState<DateRangeFilter>('this_month');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('daily');
  const [adminViewMode, setAdminViewMode] = useState<'team' | 'employee'>(isAdmin ? 'team' : 'employee');
  const [chartMode, setChartMode] = useState<'breakdown' | 'total'>('breakdown');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Sync adminViewMode whenever isAdmin resolves to true
  useEffect(() => {
    if (isAdmin) {
      setAdminViewMode('team');
    }
  }, [isAdmin]);

  // Ensure Recharts dimensions recalculate reliably after mount
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

  const { data, isLoading } = useTaskCompletions({
    range,
    timeframe,
    view: effectiveView,
  });

  // Deduplicate display names for chart axis
  const chartData = useMemo(() => {
    if (!data?.chartData) return [];
    if (effectiveView === 'team') {
      const nameCounts = new Map<string, number>();
      return data.chartData.map((item) => {
        const baseName = item.name || 'Unknown';
        const count = nameCounts.get(baseName) ?? 0;
        nameCounts.set(baseName, count + 1);
        const displayName = count > 0 ? `${baseName} (${count + 1})` : baseName;
        return {
          ...item,
          displayName,
          earlyCount: Number(item.earlyCount ?? 0),
          onTimeCount: Number(item.onTimeCount ?? 0),
          lateCount: Number(item.lateCount ?? 0),
        };
      });
    }
    return data.chartData.map((item) => ({
      ...item,
      earlyCount: Number(item.earlyCount ?? 0),
      onTimeCount: Number(item.onTimeCount ?? 0),
      lateCount: Number(item.lateCount ?? 0),
    }));
  }, [data, effectiveView]);

  // Top contributor for team view
  const topContributor = useMemo(() => {
    if (effectiveView !== 'team' || !chartData.length) return null;
    const sorted = [...chartData].sort((a, b) => b.completedCount - a.completedCount);
    return sorted[0]?.completedCount > 0 ? sorted[0] : null;
  }, [chartData, effectiveView]);

  const totalCompleted = data?.totalCompleted ?? 0;
  const totalEarly = data?.totalEarly ?? chartData.reduce((acc, c) => acc + (c.earlyCount ?? 0), 0);
  const totalOnTime = data?.totalOnTime ?? chartData.reduce((acc, c) => acc + (c.onTimeCount ?? 0), 0);
  const totalLate = data?.totalLate ?? chartData.reduce((acc, c) => acc + (c.lateCount ?? 0), 0);

  // Maximum value for Y-axis domain
  const maxCount = useMemo(() => {
    if (!chartData.length) return 5;
    const max = Math.max(...chartData.map((d) => d.completedCount), 0);
    return Math.max(Math.ceil(max * 1.25), 4);
  }, [chartData]);

  return (
    <Card className={cn('w-full flex flex-col', className)}>
      <CardHeader
        icon={
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-[18px]" />
          </div>
        }
        title={
          isAdmin && adminViewMode === 'team'
            ? 'Team Task Completion Breakdown'
            : 'My Task Completion Breakdown'
        }
        subtitle={
          isAdmin && adminViewMode === 'team'
            ? 'Early vs On-Time vs Overtime completions per employee'
            : 'Track completions: Early (+2 pts), On-Time (+1 pt), Overtime (0 pts)'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Concept chart mode toggle: Early vs Overtime breakdown vs Total */}
            <div className="flex rounded-lg border border-gray-200 bg-gray-100/80 p-0.5 dark:border-white/10 dark:bg-black/20">
              <button
                type="button"
                onClick={() => setChartMode('breakdown')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
                  chartMode === 'breakdown'
                    ? 'bg-white text-emerald-700 font-semibold shadow-xs dark:bg-surface-dark-3 dark:text-emerald-400'
                    : 'text-gray-600 hover:text-gray-900 border border-transparent dark:text-zinc-400 dark:hover:text-white',
                )}
                title="Early vs Overtime breakdown"
              >
                <Layers className="size-3" />
                Early vs Overtime
              </button>
              <button
                type="button"
                onClick={() => setChartMode('total')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
                  chartMode === 'total'
                    ? 'bg-white text-gray-900 font-semibold shadow-xs dark:bg-surface-dark-3 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 border border-transparent dark:text-zinc-400 dark:hover:text-white',
                )}
                title="Total completed count"
              >
                Total
              </button>
            </div>

            {/* Admin view mode toggle */}
            {isAdmin && (
              <div className="flex rounded-lg border border-gray-200 bg-gray-100/80 p-0.5 dark:border-white/10 dark:bg-black/20">
                <button
                  type="button"
                  onClick={() => setAdminViewMode('team')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
                    adminViewMode === 'team'
                      ? 'bg-emerald-600 text-white font-semibold shadow-xs dark:bg-emerald-500/20 dark:text-emerald-400 dark:border dark:border-emerald-500/30'
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
                      ? 'bg-emerald-600 text-white font-semibold shadow-xs dark:bg-emerald-500/20 dark:text-emerald-400 dark:border dark:border-emerald-500/30'
                      : 'text-gray-600 hover:text-gray-900 border border-transparent dark:text-zinc-400 dark:hover:text-white',
                  )}
                >
                  <TrendingUp className="size-3" />
                  My Tasks
                </button>
              </div>
            )}

            {/* Timeframe selector for Employee view (Daily / Weekly / Monthly) */}
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
                        ? 'bg-emerald-600 text-white font-semibold shadow-xs dark:bg-emerald-500/20 dark:text-emerald-400 dark:border dark:border-emerald-500/30'
                        : 'text-gray-600 hover:text-gray-900 border border-transparent dark:text-zinc-400 dark:hover:text-white',
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            )}

            {/* Date range filters for Admin view (Today / This Week / This Month / This Year / All Time) */}
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
                        ? 'bg-emerald-600 text-white font-semibold shadow-xs dark:bg-emerald-500/20 dark:text-emerald-400 dark:border dark:border-emerald-500/30'
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/90 bg-gray-50/90 p-3 dark:border-white/5 dark:bg-surface-dark-2/60">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-500">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {effectiveView === 'team' ? 'Total Completed Tasks' : 'My Total Completed'}
              </p>
              <div className="flex items-baseline gap-3">
                <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                  {isLoading ? '–' : totalCompleted}
                </p>
                {!isLoading && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {totalEarly} Early
                    </span>
                    <span className="text-gray-300 dark:text-zinc-700">·</span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {totalOnTime} On-Time
                    </span>
                    <span className="text-gray-300 dark:text-zinc-700">·</span>
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      {totalLate} Overtime
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {effectiveView === 'team' && topContributor && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-100/80 px-3 py-1.5 text-xs text-amber-900 border border-amber-300/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
              <Award className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>
                Top Contributor: <strong className="text-amber-950 dark:text-amber-200 font-bold">{topContributor.name}</strong> ({topContributor.completedCount})
              </span>
            </div>
          )}

          {effectiveView === 'employee' && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
              <Calendar className="size-3.5" />
              <span>
                {timeframe === 'daily' && 'Last 14 days activity'}
                {timeframe === 'weekly' && 'Last 8 weeks activity'}
                {timeframe === 'monthly' && 'Last 6 months activity'}
              </span>
            </div>
          )}
        </div>

        {/* Concept Legend Pills */}
        {chartMode === 'breakdown' && (
          <div className="mb-2 flex flex-wrap items-center gap-4 px-1 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              Early (+2 pts)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
              <span className="size-2.5 rounded-full bg-amber-500" />
              On-Time (+1 pt)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
              <span className="size-2.5 rounded-full bg-rose-500" />
              Overtime (0 pts)
            </span>
          </div>
        )}

        {/* Chart container with guaranteed fixed height */}
        <div
          className="w-full relative"
          style={{ height: 260, minHeight: 260 }}
        >
          {!mounted || isLoading ? (
            <div className="flex h-[260px] w-full animate-pulse items-center justify-center rounded-xl bg-gray-100 dark:bg-surface-dark-2">
              <span className="text-xs text-gray-500 dark:text-zinc-400">Loading completion data...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-[260px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
              <CheckCircle2 className="mb-2 size-8 text-gray-400 dark:text-zinc-600" />
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-400">No completed tasks yet</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500">
                {effectiveView === 'team'
                  ? 'No tasks completed by employees in this period.'
                  : 'Tasks you mark as Completed or Closed will show up here.'}
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
                  <linearGradient id="completedBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="hoverBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={1} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? '#27272A' : '#E4E4E7'}
                />
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
                  domain={[0, maxCount]}
                  stroke={isDark ? '#71717A' : '#94A3B8'}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: isDark ? '#71717A' : '#64748B', fontSize: 11 }}
                />
                <Tooltip
                  content={
                    effectiveView === 'team' ? <AdminCustomTooltip /> : <EmployeeCustomTooltip />
                  }
                  cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
                />

                {chartMode === 'breakdown' ? (
                  <>
                    {/* Stacked breakdown: Early -> On-Time -> Overtime */}
                    <Bar
                      dataKey="earlyCount"
                      name="Early (+2 pts)"
                      stackId="taskStatus"
                      fill="#10B981"
                      maxBarSize={52}
                      minPointSize={2}
                      animationDuration={500}
                    />
                    <Bar
                      dataKey="onTimeCount"
                      name="On-Time (+1 pt)"
                      stackId="taskStatus"
                      fill="#F59E0B"
                      maxBarSize={52}
                      minPointSize={2}
                      animationDuration={500}
                    />
                    <Bar
                      dataKey="lateCount"
                      name="Overtime (0 pts)"
                      stackId="taskStatus"
                      fill="#F43F5E"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={52}
                      minPointSize={2}
                      animationDuration={500}
                    >
                      <LabelList
                        dataKey="completedCount"
                        position="top"
                        fill={isDark ? '#E4E4E7' : '#18181B'}
                        fontSize={12}
                        fontWeight={700}
                        offset={6}
                        formatter={(val: any) => (Number(val) > 0 ? String(val) : '')}
                      />
                    </Bar>
                  </>
                ) : (
                  <Bar
                    dataKey="completedCount"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={52}
                    minPointSize={4}
                    animationDuration={500}
                  >
                    <LabelList
                      dataKey="completedCount"
                      position="top"
                      fill="#10B981"
                      fontSize={12}
                      fontWeight={600}
                      offset={6}
                      formatter={(val: any) => (Number(val) > 0 ? String(val) : '')}
                    />
                    {chartData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={hoveredIndex === index ? 'url(#hoverBarGradient)' : 'url(#completedBarGradient)'}
                        className="transition-colors duration-150 cursor-pointer"
                      />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
