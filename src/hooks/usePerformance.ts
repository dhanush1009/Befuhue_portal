'use client';

import { useQuery } from '@tanstack/react-query';
import type { DateRangeFilter, TimeframeFilter } from '@/hooks/useTaskCompletions';
import type { EmployeeRankItem } from '@/lib/taskScoring';

export interface PerformanceChartItem {
  employeeId?: string;
  name?: string;
  displayName?: string;
  label?: string;
  fullDate?: string;
  avatarUrl?: string | null;
  designation?: string | null;
  totalPoints?: number;
  pointsEarned?: number;
  totalCompleted?: number;
  completedCount?: number;
  earlyCount: number;
  onTimeCount: number;
  lateCount: number;
  rankDisplay?: string;
}

export interface PerformanceResponseData {
  view: 'team' | 'employee';
  range: DateRangeFilter;
  timeframe?: TimeframeFilter;
  topPerformer?: EmployeeRankItem | null;
  leaderboard?: EmployeeRankItem[];
  myPerformance?: EmployeeRankItem & { totalEmployees: number };
  chartData: PerformanceChartItem[];
  totalTeamPoints?: number;
  totalTeamCompleted?: number;
}

interface UsePerformanceOptions {
  range?: DateRangeFilter;
  timeframe?: TimeframeFilter;
  view?: 'team' | 'employee';
}

export function usePerformance({
  range = 'this_month',
  timeframe = 'daily',
  view,
}: UsePerformanceOptions = {}) {
  return useQuery({
    queryKey: ['performance', range, timeframe, view],
    queryFn: async (): Promise<PerformanceResponseData> => {
      const params = new URLSearchParams();
      if (range) params.set('range', range);
      if (timeframe) params.set('timeframe', timeframe);
      if (view) params.set('view', view);

      const res = await fetch(`/api/dashboard/performance?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Failed to fetch performance statistics');
      }
      const json = await res.json() as { data: PerformanceResponseData };
      return json.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}
