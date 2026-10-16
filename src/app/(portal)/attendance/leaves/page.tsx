'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/useUIStore';
import { useAuth } from '@/hooks/useAuth';
import { useLeaveBalance, useLeaveHistory } from '@/hooks/useLeaves';
import { LeaveBalanceCards, LeaveBalanceCardsSkeleton } from '@/components/attendance/LeaveBalanceCards';
import { LeaveApplyForm }                               from '@/components/attendance/LeaveApplyForm';
import { LeaveTable, LeaveTableSkeleton }               from '@/components/attendance/LeaveTable';
import { TeamLeaveCalendar }                            from '@/components/attendance/TeamLeaveCalendar';

type Tab = 'my-leaves' | 'apply-leave' | 'team-calendar';

export default function LeavesPage() {
  const { setPageTitle } = useUIStore();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('my-leaves');

  const { data: balances = [], isLoading: balancesLoading } = useLeaveBalance();
  const { data: leaves  = [], isLoading: leavesLoading   } = useLeaveHistory();

  useEffect(() => { setPageTitle('Time Off'); }, [setPageTitle]);

  // Seeing everyone's leave is an admin view.
  const tabs: { id: Tab; label: string }[] = [
    { id: 'my-leaves',     label: 'My Leaves'     },
    { id: 'apply-leave',   label: 'Apply Leave'   },
    ...(isAdmin ? [{ id: 'team-calendar' as Tab, label: 'Team Calendar' }] : []),
  ];

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">

      {/* Balance cards */}
      {balancesLoading
        ? <LeaveBalanceCardsSkeleton />
        : <LeaveBalanceCards balances={balances} />}

      {/* Tabs */}
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 dark:border-violet-900/40 px-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-4 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 dark:text-violet-300/55 hover:text-gray-700 dark:hover:text-violet-100/80',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {activeTab === 'my-leaves' && (
            leavesLoading
              ? <LeaveTableSkeleton />
              : <LeaveTable leaves={leaves} />
          )}

          {activeTab === 'apply-leave' && (
            <LeaveApplyForm onSuccess={() => setActiveTab('my-leaves')} />
          )}

          {activeTab === 'team-calendar' && isAdmin && (
            <TeamLeaveCalendar />
          )}
        </div>
      </div>

    </div>
  );
}
