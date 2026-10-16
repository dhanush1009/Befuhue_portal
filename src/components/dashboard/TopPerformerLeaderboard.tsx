'use client';

import { Trophy, Award, CheckCircle2, Clock, Zap, Target, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import type { EmployeeRankItem } from '@/lib/taskScoring';
import { cn } from '@/lib/utils';

interface TopPerformerLeaderboardProps {
  isAdmin?: boolean;
  topPerformer?: EmployeeRankItem | null;
  leaderboard?: EmployeeRankItem[];
  myPerformance?: (EmployeeRankItem & { totalEmployees: number }) | null;
  isLoading?: boolean;
  className?: string;
}

export function TopPerformerLeaderboard({
  isAdmin = false,
  topPerformer,
  leaderboard = [],
  myPerformance,
  isLoading = false,
  className,
}: TopPerformerLeaderboardProps) {
  if (isLoading) {
    return (
      <Card className={cn('w-full animate-pulse', className)}>
        <CardBody className="p-6">
          <div className="h-6 w-48 rounded bg-gray-100 dark:bg-surface-dark-2 mb-4" />
          <div className="h-32 w-full rounded-xl bg-gray-100 dark:bg-surface-dark-2" />
        </CardBody>
      </Card>
    );
  }

  // ── Employee Personal Performance View ──────────────────────────────────────
  if (!isAdmin && myPerformance) {
    const onTimeRate =
      myPerformance.totalCompleted > 0
        ? Math.round((myPerformance.onTimeAndEarlyCount / myPerformance.totalCompleted) * 100)
        : 0;

    return (
      <Card className={cn('w-full', className)}>
        <CardHeader
          icon={
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Trophy className="size-[18px]" />
            </div>
          }
          title="My Performance & Standing"
          subtitle="Track your earned performance points, ranking, and deadline adherence"
          action={
            <div className="flex items-center gap-2 rounded-lg border border-amber-300/80 bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <Award className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>Rank {myPerformance.rankDisplay}</span>
              <span className="text-amber-800 dark:text-amber-400/70 font-normal">of {myPerformance.totalEmployees}</span>
            </div>
          }
        />

        <CardBody className="space-y-4 pt-3 pb-5">
          {/* Top banner summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 p-3.5 dark:border-white/5 dark:bg-surface-dark-2/60">
              <span className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Zap className="size-3.5 text-amber-600 dark:text-amber-400" /> Total Points
              </span>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {myPerformance.totalPoints}
              </p>
              <span className="text-[11px] text-gray-500 dark:text-zinc-500">2 pts early · 1 pt on-time</span>
            </div>

            <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 p-3.5 dark:border-white/5 dark:bg-surface-dark-2/60">
              <span className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Completed Tasks
              </span>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {myPerformance.totalCompleted}
              </p>
              <span className="text-[11px] text-gray-500 dark:text-zinc-500">of {myPerformance.totalAssigned} assigned</span>
            </div>

            <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 p-3.5 dark:border-white/5 dark:bg-surface-dark-2/60">
              <span className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Target className="size-3.5 text-emerald-600 dark:text-emerald-400" /> On-Time / Early
              </span>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {myPerformance.onTimeAndEarlyCount}
              </p>
              <span className="text-[11px] text-gray-500 dark:text-zinc-500">
                {myPerformance.earlyCount} early · {myPerformance.onTimeCount} exact
              </span>
            </div>

            <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 p-3.5 dark:border-white/5 dark:bg-surface-dark-2/60">
              <span className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                <AlertCircle className="size-3.5 text-rose-600 dark:text-rose-400" /> Overtime Completions
              </span>
              <p className="mt-1 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {myPerformance.lateCount}
              </p>
              <span className="text-[11px] text-gray-500 dark:text-zinc-500">0 points awarded</span>
            </div>
          </div>

          {/* Scoring rule guide */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-400">
            <span className="font-semibold text-gray-900 dark:text-zinc-300">Scoring Rules:</span>
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <strong className="text-gray-900 dark:text-white">2 Points</strong> Before Deadline (Early)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                <strong className="text-gray-900 dark:text-white">1 Point</strong> At Deadline (On-Time)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-500 dark:bg-rose-400" />
                <strong className="text-gray-900 dark:text-white">0 Points</strong> After Deadline (Overtime)
              </span>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // ── Admin View: Spotlight Top Performer + Full Team Leaderboard ─────────────
  return (
    <div className={cn('space-y-4 w-full', className)}>
      {/* 1. Top Performer Spotlight Card */}
      {topPerformer && (
        <Card className="relative overflow-hidden border-amber-300/80 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/40 shadow-sm dark:border-amber-500/25 dark:bg-gradient-to-r dark:from-amber-500/10 dark:via-surface-dark-3 dark:to-surface-dark-3">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 size-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

          <CardBody className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {topPerformer.avatarUrl ? (
                    <img
                      src={topPerformer.avatarUrl}
                      alt={topPerformer.name}
                      className="size-16 rounded-full object-cover ring-2 ring-amber-500/80 shadow-md"
                    />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-lg font-bold text-zinc-950 ring-2 ring-amber-400/80 shadow-md">
                      {topPerformer.name?.charAt(0) ?? '?'}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow">
                    <Trophy className="size-3.5 fill-current" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900 border border-amber-300 dark:bg-amber-400/20 dark:text-amber-300 dark:border-amber-400/30">
                      Top Performer · Rank {topPerformer.rankDisplay}
                    </span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{topPerformer.name}</h3>
                  {topPerformer.designation && (
                    <p className="text-xs text-gray-600 dark:text-zinc-400">{topPerformer.designation}</p>
                  )}
                </div>
              </div>

              {/* Top Performer Score Pills */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="rounded-xl border border-amber-200 bg-white/90 p-2.5 sm:p-3 text-center dark:border-amber-500/20 dark:bg-black/20">
                  <span className="text-[11px] text-gray-500 dark:text-zinc-400">Total Points</span>
                  <p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-300">
                    {topPerformer.totalPoints}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white/90 p-2.5 sm:p-3 text-center dark:border-white/5 dark:bg-black/20">
                  <span className="text-[11px] text-gray-500 dark:text-zinc-400">Completed</span>
                  <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                    {topPerformer.totalCompleted}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white/90 p-2.5 sm:p-3 text-center dark:border-white/5 dark:bg-black/20">
                  <span className="text-[11px] text-gray-500 dark:text-zinc-400">On-Time / Early</span>
                  <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {topPerformer.onTimeAndEarlyCount}
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 2. Full Employee Leaderboard */}
      <Card>
        <CardHeader
          icon={
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Award className="size-[18px]" />
            </div>
          }
          title="Employee Performance Leaderboard"
          subtitle="Rankings determined by total performance points, with on-time completions as tie-breaker"
        />

        <CardBody className="pt-2 pb-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600 bg-gray-50/50 dark:border-white/10 dark:text-zinc-400 dark:bg-transparent">
                  <th className="py-3 px-3 font-medium uppercase tracking-wider">Rank</th>
                  <th className="py-3 px-3 font-medium uppercase tracking-wider">Employee</th>
                  <th className="py-3 px-3 font-medium uppercase tracking-wider text-center">Points</th>
                  <th className="py-3 px-3 font-medium uppercase tracking-wider text-center">Completed Tasks</th>
                  <th className="py-3 px-3 font-medium uppercase tracking-wider text-center">Early (2 pts)</th>
                  <th className="py-3 px-3 font-medium uppercase tracking-wider text-center">On-Time (1 pt)</th>
                  <th className="py-3 px-3 font-medium uppercase tracking-wider text-center">Overtime (0 pts)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/80 dark:divide-white/5">
                {leaderboard.map((emp) => {
                  const isFirst = emp.rank === 1 && emp.totalPoints > 0;
                  return (
                    <tr
                      key={emp.employeeId}
                      className={cn(
                        'transition-colors hover:bg-gray-50/80 dark:hover:bg-white/[0.02]',
                        isFirst && 'bg-amber-50/50 dark:bg-amber-500/[0.04]',
                      )}
                    >
                      {/* Rank badge */}
                      <td className="py-3 px-3">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums',
                            isFirst
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-400/20 dark:text-amber-300 dark:border-amber-400/40'
                              : emp.rank === 2
                                ? 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-zinc-200/10 dark:text-zinc-200 dark:border-white/10'
                                : emp.rank === 3
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-700/20 dark:text-amber-500/80'
                                  : 'text-gray-500 dark:text-zinc-400',
                          )}
                        >
                          {emp.rankDisplay}
                        </span>
                      </td>

                      {/* Employee details */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          {emp.avatarUrl ? (
                            <img
                              src={emp.avatarUrl}
                              alt={emp.name}
                              className="size-7 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/10"
                            />
                          ) : (
                            <div className="flex size-7 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              {emp.name?.charAt(0) ?? '?'}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{emp.name}</p>
                            {emp.designation && (
                              <p className="text-[11px] text-gray-500 dark:text-zinc-500">{emp.designation}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Total Points */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block rounded-md bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 text-xs font-bold tabular-nums dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
                          {emp.totalPoints} pts
                        </span>
                      </td>

                      {/* Completed tasks */}
                      <td className="py-3 px-3 text-center font-medium text-gray-900 dark:text-white tabular-nums">
                        {emp.totalCompleted}
                      </td>

                      {/* Early (2 pts) */}
                      <td className="py-3 px-3 text-center font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {emp.earlyCount}
                      </td>

                      {/* On-Time (1 pt) */}
                      <td className="py-3 px-3 text-center font-semibold text-amber-600 dark:text-amber-300 tabular-nums">
                        {emp.onTimeCount}
                      </td>

                      {/* Overtime (0 pts) */}
                      <td className="py-3 px-3 text-center font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                        {emp.lateCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
