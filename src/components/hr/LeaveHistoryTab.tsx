'use client';

import { CalendarOff } from 'lucide-react';
import { LeaveTable, LeaveTableSkeleton } from '@/components/attendance/LeaveTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { useEmployeeLeaves } from '@/hooks/useEmployees';

interface LeaveHistoryTabProps {
  employeeId: string;
}

export function LeaveHistoryTab({ employeeId }: LeaveHistoryTabProps) {
  const { data, isLoading, isError } = useEmployeeLeaves(employeeId);

  if (isLoading) return <LeaveTableSkeleton />;

  if (isError) {
    return (
      <EmptyState
        icon={<CalendarOff className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
        title="Failed to load leave history"
        description="Please try again."
      />
    );
  }

  return <LeaveTable leaves={data ?? []} />;
}
