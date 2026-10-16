'use client';

import { cn, getInitials } from '@/lib/utils';
import { LEAVE_TYPES } from '@/lib/constants';
import type { MyProfile, LeaveBalanceEntry } from '@/types/profile';

interface CompletenessInfo {
  percentage: number;
}

interface MobileProfileHeaderProps {
  user:         MyProfile;
  completeness: CompletenessInfo;
}

export function MobileProfileHeader({ user, completeness }: MobileProfileHeaderProps) {
  const { percentage } = completeness;

  const barColor =
    percentage === 100 ? 'bg-green-500' :
    percentage >= 60   ? 'bg-violet-500' :
                         'bg-amber-400';

  const absent = Math.max(
    0,
    user.attendanceSummary.total -
    user.attendanceSummary.present -
    user.attendanceSummary.wfh -
    user.attendanceSummary.halfDay,
  );

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4">
      {/* Top row: avatar + name + completeness */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-lg font-semibold text-violet-700 dark:text-violet-300 shrink-0">
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            : getInitials(user.name)}
        </div>

        {/* Name + designation + completeness */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
          {user.designation && (
            <p className="text-xs text-gray-500 dark:text-violet-300/55 truncate">{user.designation}</p>
          )}
          {/* Status dot */}
          <div className="flex items-center gap-1.5 mt-1">
            {user.isClockedIn ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-700 dark:text-green-400">Working</span>
              </>
            ) : user.isOnLeave ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-xs text-amber-700 dark:text-amber-400">On Leave</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-surface-dark-3" />
                <span className="text-xs text-gray-400 dark:text-violet-300/45">Offline</span>
              </>
            )}
          </div>
          {/* Compact completeness bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-surface-dark-3 rounded-full h-1.5">
              <div className={cn('h-1.5 rounded-full transition-all duration-700', barColor)} style={{ width: `${percentage}%` }} />
            </div>
            <span className="text-xs text-gray-400 dark:text-violet-300/45 shrink-0">{percentage}%</span>
          </div>
        </div>
      </div>

      {/* Horizontal scroll chip row */}
      <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none pb-0.5">
        <Chip label="Present" value={user.attendanceSummary.present} color="text-green-600 dark:text-green-400" />
        <Chip label="Absent"  value={absent}                         color="text-status-absent dark:text-red-400" />
        <Chip label="WFH"     value={user.attendanceSummary.wfh}     color="text-amber-600 dark:text-amber-400" />
        {user.leaveBalances.filter((b) => b.allowance > 0).map((b) => (
          <LeaveChip key={b.type} balance={b} />
        ))}
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg px-3 py-1.5 shrink-0">
      <span className={cn('text-sm font-semibold', color)}>{value}</span>
      <span className="text-xs text-gray-400 dark:text-violet-300/45">{label}</span>
    </div>
  );
}

function LeaveChip({ balance }: { balance: LeaveBalanceEntry }) {
  const found = LEAVE_TYPES.find((l) => l.value === balance.type);
  const label = found?.label.replace(' Leave', '').replace('Compensatory Off', 'Comp Off') ?? balance.type;
  return (
    <div className="flex flex-col items-center bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg px-3 py-1.5 shrink-0">
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{balance.remaining}</span>
      <span className="text-xs text-gray-400 dark:text-violet-300/45">{label}</span>
    </div>
  );
}
