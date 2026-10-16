'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calculator, Clock, ChevronDown, CheckCircle, XCircle, AlertCircle, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/useUIStore';
import { useAuth } from '@/hooks/useAuth';
import { useTodayAttendance, useAttendanceLogs } from '@/hooks/useAttendance';
import { useMyRegularizations, useWithdrawRegularization, useAppealRegularization } from '@/hooks/useRegularizations';
import { ClockInCard, ClockInCardSkeleton }                       from '@/components/attendance/ClockInCard';
import { AttendanceSummaryStrip, AttendanceSummaryStripSkeleton } from '@/components/attendance/AttendanceSummaryStrip';
import { AttendanceCalendar, AttendanceCalendarSkeleton }         from '@/components/attendance/AttendanceCalendar';
import { AttendanceLogTable, AttendanceLogTableSkeleton }         from '@/components/attendance/AttendanceLogTable';
import { RegularizationRequestModal }                             from '@/components/attendance/RegularizationRequestModal';
import { HeadsUpComposer }                                        from '@/components/attendance/HeadsUpComposer';
import { SalaryCalculationModal }                                 from '@/components/payroll/SalaryCalculationModal';
import { EmptyState }                                             from '@/components/shared/EmptyState';
import { ConfirmDialog }                                          from '@/components/shared/ConfirmDialog';
import { SkeletonTable }                                          from '@/components/shared/SkeletonTable';
import type { RegularizationRequest } from '@/hooks/useRegularizations';

// Defined locally until prisma generate runs
type RegularizationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REJECTED_BY_ADMIN' | 'WITHDRAWN';

// ── Status badge config for regularization ─────────────────────────────────────────

const REG_STATUS_CONFIG: Record<RegularizationStatus, { label: string; icon: React.ElementType; className: string }> = {
  PENDING:           { label: 'Pending',             icon: Clock,        className: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800' },
  APPROVED:          { label: 'Approved',            icon: CheckCircle,  className: 'bg-green-50 text-status-present border-green-200 dark:bg-green-950/20 dark:border-green-800' },
  REJECTED:          { label: 'Rejected (appeal available)', icon: AlertCircle, className: 'bg-red-50 text-status-absent border-status-absent/30 dark:bg-red-950/20' },
  REJECTED_BY_ADMIN: { label: 'Rejected',            icon: XCircle,      className: 'bg-red-50 text-status-absent border-status-absent/30 dark:bg-red-950/20' },
  WITHDRAWN:         { label: 'Withdrawn',           icon: MinusCircle,  className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-surface-dark-3 dark:text-violet-300/55 dark:border-white/10' },
};

const TYPE_LABELS: Record<string, string> = {
  FORGOT_CLOCK_IN: 'Forgot Clock In', FORGOT_CLOCK_OUT: 'Forgot Clock Out',
  WRONG_TIME: 'Wrong Time', SYSTEM_ERROR: 'System Error',
  ON_FIELD_WORK: 'On-Field Work', OTHER: 'Other',
};

// ── My Regularizations section ────────────────────────────────────────────────────

function MyRegularizationsSection() {
  const [expanded,   setExpanded]   = useState(false);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const { data: regs = [], isLoading } = useMyRegularizations();
  const withdraw = useWithdrawRegularization();
  const appeal   = useAppealRegularization();

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-surface-dark-3/50 transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">My Regularization Requests</p>
          {regs.filter((r) => r.status === 'PENDING').length > 0 && (
            <span className="min-w-[18px] h-4.5 px-1 bg-amber-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
              {regs.filter((r) => r.status === 'PENDING').length}
            </span>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform duration-150', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-violet-900/40">
          {isLoading ? (
            <div className="p-4"><SkeletonTable rows={3} columns={5} /></div>
          ) : regs.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-8 h-8 text-gray-300 dark:text-violet-400/35" />}
              title="No regularization requests raised"
              description="Raise a request if you missed a punch."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider bg-gray-50 dark:bg-surface-dark-3/50 border-b border-gray-100 dark:border-violet-900/40">
                  <tr>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Type</th>
                    <th className="px-5 py-3 text-left">Requested Time</th>
                    <th className="px-5 py-3 text-left">Reason</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Submitted</th>
                    <th className="px-5 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-violet-900/25">
                  {regs.map((reg) => {
                    const cfg  = REG_STATUS_CONFIG[reg.status as RegularizationStatus] ?? REG_STATUS_CONFIG.PENDING;
                    const Icon = cfg.icon;
                    const ciStr = reg.requestedClockIn  ? format(new Date(reg.requestedClockIn), 'hh:mm a') : '—';
                    const coStr = reg.requestedClockOut ? format(new Date(reg.requestedClockOut), 'hh:mm a') : '—';
                    return (
                      <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-3/50 transition-colors duration-150">
                        <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {format(new Date(reg.date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 dark:text-violet-300/55 text-xs">
                          {TYPE_LABELS[reg.regularizationType] ?? reg.regularizationType}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-mono text-gray-700 dark:text-violet-200/70">
                          {ciStr}{coStr !== '—' ? ` → ${coStr}` : ''}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-violet-300/55 max-w-[140px] truncate" title={reg.reason}>
                          {reg.reason}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
                            cfg.className,
                          )}>
                            <Icon className="w-3 h-3" /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-400 dark:text-violet-300/45 whitespace-nowrap">
                          {format(new Date(reg.createdAt), 'dd MMM, hh:mm a')}
                        </td>
                        <td className="px-5 py-3.5">
                          {reg.status === 'PENDING' && (
                            <button
                              onClick={() => setWithdrawId(reg.id)}
                              className="text-xs text-gray-500 hover:text-status-absent border border-gray-200 dark:border-white/10 hover:border-status-absent/30 px-2 py-0.5 rounded transition-colors duration-150"
                            >
                              Withdraw
                            </button>
                          )}
                          {reg.status === 'REJECTED' && (
                            <button
                              onClick={() => appeal.mutate(reg.id)}
                              disabled={appeal.isPending}
                              className="text-xs text-brand hover:underline underline-offset-1 transition-colors duration-150 disabled:opacity-50"
                            >
                              Request Admin Review
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!withdrawId}
        title="Withdraw regularization request?"
        description="Are you sure you want to withdraw this request? You can raise a new one if needed."
        confirmLabel="Yes, Withdraw"
        onConfirm={() => {
          if (withdrawId) withdraw.mutate(withdrawId, { onSuccess: () => setWithdrawId(null) });
        }}
        onCancel={() => setWithdrawId(null)}
      />
    </div>
  );
}

// ── Attendance page ───────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { setPageTitle }               = useUIStore();
  const { user, isAdmin }              = useAuth();
  const [showCalcModal,  setShowCalcModal]  = useState(false);
  const [showRegModal,   setShowRegModal]   = useState(false);
  const [regInitialDate, setRegInitialDate] = useState<string | undefined>(undefined);

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  const { data: todayData, isLoading: todayLoading } = useTodayAttendance();
  const { data: logs = [],  isLoading: logsLoading  } = useAttendanceLogs(year, month);
  const { data: regs = [] }                           = useMyRegularizations();

  useEffect(() => { setPageTitle('My Time'); }, [setPageTitle]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = user as any;

  function openRegModal(date?: string) {
    setRegInitialDate(date);
    setShowRegModal(true);
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">

      {/* Top action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => openRegModal()}
          className="text-sm text-brand hover:underline underline-offset-2 transition-colors duration-150 cursor-pointer"
        >
          Missed a punch? → Raise Regularization Request
        </button>
        {isAdmin && currentUser?.id && (
          <button
            onClick={() => setShowCalcModal(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-brand border border-brand/30 hover:bg-brand/5 transition-colors duration-150 active:scale-[0.98]"
          >
            <Calculator className="w-4 h-4" /> Calculate Salary
          </button>
        )}
      </div>

      {/* Clock-in card */}
      {todayLoading ? <ClockInCardSkeleton /> : <ClockInCard todayData={todayData} />}

      {/* Heads-up for the admins: leaving early / coming in late (not needed for work-from-anywhere people) */}
      {todayData?.attendanceMode !== 'ANYWHERE' && <HeadsUpComposer />}

      {/* Summary strip */}
      {logsLoading
        ? <AttendanceSummaryStripSkeleton />
        : <AttendanceSummaryStrip logs={logs} year={year} month={month} />}

      {/* Calendar + Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {logsLoading ? <AttendanceCalendarSkeleton /> : <AttendanceCalendar onRaiseRegularization={(date) => openRegModal(date)} />}
        {logsLoading
          ? <AttendanceLogTableSkeleton />
          : <AttendanceLogTable
              logs={logs}
              regularizations={regs}
              onRegularize={(date) => openRegModal(date)}
            />}
      </div>

      {/* My regularization requests */}
      <MyRegularizationsSection />

      {/* Modals */}
      {showRegModal && (
        <RegularizationRequestModal
          initialDate={regInitialDate}
          onClose={() => setShowRegModal(false)}
        />
      )}

      {showCalcModal && isAdmin && currentUser?.id && (
        <SalaryCalculationModal
          employee={{
            id:          currentUser.id,
            name:        currentUser.name ?? 'Employee',
            designation: currentUser.designation ?? null,
          }}
          month={now.getMonth() + 1}
          year={year}
          onClose={() => setShowCalcModal(false)}
        />
      )}
    </div>
  );
}
