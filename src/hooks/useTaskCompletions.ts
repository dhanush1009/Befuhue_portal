'use client';

import { useQuery } from '@tanstack/react-query';

export type DateRangeFilter = 'today' | 'this_week' | 'this_month' | 'this_year' | 'all_time';
export type TimeframeFilter = 'daily' | 'weekly' | 'monthly';

export interface EmployeeCompletionItem {
  label: string;
  fullDate: string;
  completedCount: number;
  earlyCount?: number;
  onTimeCount?: number;
  lateCount?: number;
}

export interface AdminTeamCompletionItem {
  employeeId: string;
  name: string;
  avatarUrl: string | null;
  designation: string | null;
  completedCount: number;
  earlyCount?: number;
  onTimeCount?: number;
  lateCount?: number;
  totalPoints?: number;
}

export interface TaskCompletionData {
  view: 'team' | 'employee';
  range: DateRangeFilter;
  timeframe?: TimeframeFilter;
  totalCompleted: number;
  totalEarly?: number;
  totalOnTime?: number;
  totalLate?: number;
  employeeName?: string;
  chartData: (EmployeeCompletionItem & AdminTeamCompletionItem)[];
}

interface UseTaskCompletionsOptions {
  range?: DateRangeFilter;
  timeframe?: TimeframeFilter;
  view?: 'team' | 'employee';
}

export function useTaskCompletions({
  range = 'this_month',
  timeframe = 'daily',
  view,
}: UseTaskCompletionsOptions = {}) {
  return useQuery({
    queryKey: ['task-completions', range, timeframe, view],
    queryFn: async (): Promise<TaskCompletionData> => {
      const params = new URLSearchParams();
      if (range) params.set('range', range);
      if (timeframe) params.set('timeframe', timeframe);
      if (view) params.set('view', view);

      const res = await fetch(`/api/dashboard/task-completion-stats?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Failed to fetch task completion statistics');
      }
      const json = await res.json() as { data: TaskCompletionData };
      return json.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}
