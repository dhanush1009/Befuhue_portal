'use client';

import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { CalendarOff, X } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCancelLeave } from '@/hooks/useLeaves';
import { LEAVE_TYPES } from '@/lib/constants';
import type { Leave } from '@/types';
import type { LeaveStatus, LeaveType } from '@prisma/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function leaveLabel(type: string): string {
  return LEAVE_TYPES.find((l) => l.value === type)?.label ?? type;
}

function isPendingOld(leave: Leave): boolean {
  if (leave.status !== 'PENDING') return false;
  return differenceInDays(new Date(), new Date(leave.createdAt)) >= 7;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function LeaveTableSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-violet-900/40 last:border-0">
          <div className="w-20 h-5 bg-gray-200 dark:bg-surface-dark-3 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="w-32 h-3 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            <div className="w-24 h-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          </div>
          <div className="w-16 h-5 bg-gray-100 dark:bg-surface-dark-3 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  statusFilter: LeaveStatus | '';
  typeFilter:   LeaveType   | '';
  onStatus:     (v: LeaveStatus | '') => void;
  onType:       (v: LeaveType   | '') => void;
}

function FilterBar({ statusFilter, typeFilter, onStatus, onType }: FilterBarProps) {
  const selectClass = 'text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg px-3 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-violet-900/40 bg-gray-50/50 dark:bg-surface-dark-3/20">
      <select value={statusFilter} onChange={(e) => onStatus(e.target.value as LeaveStatus | '')} className={selectClass}>
        <option value="">All Statuses</option>
        {(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as LeaveStatus[]).map((s) => (
          <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
        ))}
      </select>
      <select value={typeFilter} onChange={(e) => onType(e.target.value as LeaveType | '')} className={selectClass}>
        <option value="">All Types</option>
        {LEAVE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LeaveTableProps {
  leaves: Leave[];
}

export function LeaveTable({ leaves }: LeaveTableProps) {
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | ''>('');
  const [typeFilter,   setTypeFilter]   = useState<LeaveType   | ''>('');
  const [cancelId,     setCancelId]     = useState<string | null>(null);

  const cancelMutation = useCancelLeave();

  const filtered = leaves.filter((l) => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (typeFilter   && l.type   !== typeFilter)   return false;
    return true;
  });

  return (
    <>
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
        <FilterBar
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onStatus={setStatusFilter}
          onType={setTypeFilter}
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={<CalendarOff className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
            title="No leave requests"
            description="Your leave history will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider bg-gray-50 dark:bg-surface-dark-3/50 border-b border-gray-100 dark:border-violet-900/40">
                <tr>
                  <th className="px-5 py-3 text-left">Leave Type</th>
                  <th className="px-5 py-3 text-left">From</th>
                  <th className="px-5 py-3 text-left">To</th>
                  <th className="px-5 py-3 text-left">Days</th>
                  <th className="px-5 py-3 text-left">Reason</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Applied On</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-violet-900/25">
                {filtered.map((leave) => (
                  <tr
                    key={leave.id}
                    className={cn(
                      'hover:bg-gray-50 dark:hover:bg-surface-dark-3/50 transition-colors duration-150',
                      isPendingOld(leave) && 'bg-amber-50/50 dark:bg-amber-900/10',
                    )}
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {leaveLabel(leave.type)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 dark:text-violet-200/70 whitespace-nowrap">
                      {formatDate(leave.fromDate)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 dark:text-violet-200/70 whitespace-nowrap">
                      {formatDate(leave.toDate)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 dark:text-violet-200/70">
                      {leave.days}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-violet-300/55 max-w-[200px] truncate" title={leave.reason}>
                      {leave.reason}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={leave.status.toLowerCase()} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 dark:text-violet-300/45 whitespace-nowrap text-xs">
                      {format(new Date(leave.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-5 py-3.5">
                      {leave.status === 'PENDING' && (
                        <button
                          onClick={() => setCancelId(leave.id)}
                          className="flex items-center gap-1 text-xs text-status-absent hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-md transition-colors duration-150 active:scale-[0.98]"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!cancelId}
        title="Cancel Leave Request"
        description="Are you sure you want to cancel this leave request? This action cannot be undone."
        confirmLabel="Yes, Cancel"
        destructive
        onConfirm={() => {
          if (cancelId) cancelMutation.mutate(cancelId);
          setCancelId(null);
        }}
        onCancel={() => setCancelId(null)}
      />
    </>
  );
}
