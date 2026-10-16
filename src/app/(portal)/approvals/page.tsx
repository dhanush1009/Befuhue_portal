'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { differenceInDays, differenceInHours, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, addMonths, subMonths } from 'date-fns';
import { ClipboardCheck, Check, X, ChevronLeft, ChevronRight, Loader2, Download, CalendarClock } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { useAuth } from '@/hooks/useAuth';
import { usePendingLeaves, useAllLeaves, useApproveLeave, useRejectLeave, type ApprovalLeave } from '@/hooks/useApprovals';
import { usePendingRegularizations, useApproveRegularization, useRejectRegularization, type RegularizationRequest } from '@/hooks/useRegularizations';
import { LEAVE_TYPES, DEPARTMENTS } from '@/lib/constants';
import type { LeaveStatus, LeaveType } from '@prisma/client';
import { JoiningRequestsTab } from '@/components/approvals/JoiningRequests';
import { useJoiningRequests } from '@/hooks/useVault';

const isAdminRole = (r: string | null | undefined) => r === 'ADMIN';

// Regularization types (defined here until prisma generate runs)
type RegularizationType = 'FORGOT_CLOCK_IN' | 'FORGOT_CLOCK_OUT' | 'WRONG_TIME' | 'SYSTEM_ERROR' | 'ON_FIELD_WORK' | 'OTHER';

// ── Helpers ───────────────────────────────────────────────────────────────────

function leaveLabel(type: string) { return LEAVE_TYPES.find((t) => t.value === type)?.label ?? type; }
function leaveColor(type: string) { return LEAVE_TYPES.find((t) => t.value === type)?.color ?? '#6B7280'; }

function daysAgo(date: string) {
  const d = differenceInDays(new Date(), new Date(date));
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
}

// ── Reject dialog ─────────────────────────────────────────────────────────────

interface RejectDialogProps {
  leaveId:  string;
  onClose:  () => void;
}

function RejectDialog({ leaveId, onClose }: RejectDialogProps) {
  const [remarks, setRemarks] = useState('');
  const reject = useRejectLeave();

  function handleSubmit() {
    if (remarks.trim().length < 10) return;
    reject.mutate({ id: leaveId, remarks: remarks.trim() }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-slate-200 dark:border-violet-900/30 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Reject Leave Request</h3>
        <p className="text-sm text-gray-500 dark:text-violet-300/55 mb-4">Provide a reason for rejection (required).</p>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder="Minimum 10 characters…"
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none resize-none transition-colors duration-150"
        />
        {remarks.length > 0 && remarks.trim().length < 10 && (
          <p className="text-xs text-status-absent mt-1">At least 10 characters required.</p>
        )}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={remarks.trim().length < 10 || reject.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-status-absent text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors duration-150"
          >
            {reject.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pending card ──────────────────────────────────────────────────────────────

interface PendingCardProps {
  leave:     ApprovalLeave;
  onReject:  (id: string) => void;
}

function PendingCard({ leave, onReject }: PendingCardProps) {
  const approve = useApproveLeave();
  const isOld   = differenceInDays(new Date(), new Date(leave.createdAt)) >= 7;

  return (
    <div className={cn(
      'bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 flex flex-col sm:flex-row gap-4 hover:border-violet-200 dark:hover:border-violet-500 transition-colors duration-150',
      isOld && 'border-l-4 border-l-amber-400',
    )}>
      {/* Left: employee */}
      <div className="flex items-center gap-3 sm:w-48 shrink-0">
        <UserAvatar name={leave.user.name} avatarUrl={leave.user.avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{leave.user.name}</p>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 truncate">{leave.user.designation ?? leave.user.department ?? '—'}</p>
        </div>
      </div>

      {/* Center: leave details */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: leaveColor(leave.type) }}
          >
            {leaveLabel(leave.type)}
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {format(new Date(leave.fromDate), 'dd MMM')} – {format(new Date(leave.toDate), 'dd MMM')}, {leave.days} day{leave.days !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-violet-300/55 italic line-clamp-2 mb-1">"{leave.reason}"</p>
        <p className="text-xs text-gray-400 dark:text-violet-300/45">Applied {daysAgo(leave.createdAt)}</p>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => approve.mutate(leave.id)}
          disabled={approve.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-status-present text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
        >
          {approve.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Approve
        </button>
        <button
          onClick={() => onReject(leave.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-status-absent text-status-absent rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 active:scale-[0.98]"
        >
          <X className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
}

// ── Pending tab ───────────────────────────────────────────────────────────────

function PendingTab() {
  const { data: leaves, isLoading } = usePendingLeaves();
  const [rejectId, setRejectId] = useState<string | null>(null);

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>;

  if (!leaves || leaves.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
        title="No pending requests"
        description="All leave requests have been actioned."
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {leaves.map((leave) => (
          <PendingCard key={leave.id} leave={leave} onReject={setRejectId} />
        ))}
      </div>
      {rejectId && <RejectDialog leaveId={rejectId} onClose={() => setRejectId(null)} />}
    </>
  );
}

// ── All Requests tab ──────────────────────────────────────────────────────────

function exportCSV(leaves: ApprovalLeave[]) {
  const header = 'Employee,Email,Leave Type,From,To,Days,Reason,Status,Applied On';
  const rows = leaves.map((l) =>
    [l.user.name, l.user.email, leaveLabel(l.type),
     formatDate(l.fromDate), formatDate(l.toDate), l.days,
     `"${l.reason.replace(/"/g, '""')}"`, l.status,
     formatDate(l.createdAt)].join(','),
  );
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'leave-requests.csv'; a.click();
  URL.revokeObjectURL(url);
}

function AllRequestsTab() {
  const [status,   setStatus]   = useState<LeaveStatus | ''>('');
  const [type,     setType]     = useState<LeaveType   | ''>('');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);

  const { data, isLoading } = useAllLeaves({ status: status || undefined, type: type || undefined, search: search || undefined, page });
  const leaves     = data?.data  ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / (data?.limit ?? 25));

  const selectClass = 'text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg px-3 py-2 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search employee…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg px-3 py-2 text-gray-700 dark:text-violet-200/70 placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 w-48"
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value as LeaveStatus | ''); setPage(1); }} className={selectClass}>
          <option value="">All Statuses</option>
          {(['PENDING','APPROVED','REJECTED','CANCELLED'] as LeaveStatus[]).map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value as LeaveType | ''); setPage(1); }} className={selectClass}>
          <option value="">All Types</option>
          {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button
          onClick={() => exportCSV(leaves)}
          disabled={leaves.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150 ml-auto"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={6} columns={8} />
        ) : leaves.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
            title="No requests found"
            description="Try adjusting your filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider bg-gray-50 dark:bg-surface-dark-3/50 border-b border-gray-100 dark:border-violet-900/40">
                <tr>
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-5 py-3 text-left">Leave Type</th>
                  <th className="px-5 py-3 text-left">Dates</th>
                  <th className="px-5 py-3 text-left">Days</th>
                  <th className="px-5 py-3 text-left">Reason</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-violet-900/25">
                {leaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-3/50 transition-colors duration-150">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={leave.user.name} avatarUrl={leave.user.avatarUrl} size="sm" />
                        <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{leave.user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: leaveColor(leave.type) }}>
                        {leaveLabel(leave.type)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 dark:text-violet-200/70 whitespace-nowrap">
                      {format(new Date(leave.fromDate), 'dd MMM')} – {format(new Date(leave.toDate), 'dd MMM yyyy')}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 dark:text-violet-200/70">{leave.days}</td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-violet-300/55 max-w-[180px] truncate" title={leave.reason}>{leave.reason}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={leave.status.toLowerCase()} /></td>
                    <td className="px-5 py-3.5 text-gray-400 dark:text-violet-300/45 whitespace-nowrap text-xs">{formatDate(leave.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500 dark:text-violet-300/55">Page {page} of {totalPages} · {total} total</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150">Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Team Calendar tab ─────────────────────────────────────────────────────────

// Deterministic color per employee id
const CALENDAR_COLORS = ['#8E51FF','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2','#DB2777','#059669','#EA580C','#6366F1'];
function empColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return CALENDAR_COLORS[Math.abs(h) % CALENDAR_COLORS.length];
}

function TeamCalendarTab() {
  const [month, setMonth] = useState(new Date());
  const { data } = useAllLeaves({ status: 'APPROVED' });
  const leaves = data?.data ?? [];

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const firstDow = startOfMonth(month).getDay(); // 0=Sun

  // Build legend: unique employees with approved leaves this month
  const legendMap = new Map<string, { name: string; color: string }>();
  for (const l of leaves) {
    if (!legendMap.has(l.user.id)) {
      legendMap.set(l.user.id, { name: l.user.name, color: empColor(l.user.id) });
    }
  }

  function getLeavesForDay(day: Date) {
    return leaves.filter((l) =>
      isWithinInterval(day, { start: new Date(l.fromDate), end: new Date(l.toDate) }),
    );
  }

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth((m) => subMonths(m, 1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
          <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
        </button>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{format(month, 'MMMM yyyy')}</h3>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-violet-900/40">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-50 dark:border-violet-900/50" />
          ))}

          {days.map((day) => {
            const dayLeaves = getLeavesForDay(day);
            const isToday   = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className="min-h-[80px] p-1.5 border-b border-r border-gray-50 dark:border-violet-900/50 last:border-r-0"
              >
                <span className={cn(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1',
                  isToday ? 'bg-brand text-white' : 'text-gray-500 dark:text-violet-300/55',
                )}>
                  {format(day, 'd')}
                </span>
                <div className="space-y-0.5">
                  {dayLeaves.slice(0, 2).map((l) => (
                    <div
                      key={l.id}
                      className="text-[10px] font-medium text-white px-1 py-0.5 rounded truncate"
                      style={{ backgroundColor: empColor(l.user.id) }}
                      title={`${l.user.name} — ${leaveLabel(l.type)}`}
                    >
                      {l.user.name.split(' ')[0]}
                    </div>
                  ))}
                  {dayLeaves.length > 2 && (
                    <div className="text-[10px] text-gray-400 dark:text-violet-300/45 px-1">+{dayLeaves.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {legendMap.size > 0 && (
        <div className="flex flex-wrap gap-3 mt-4">
          {Array.from(legendMap.entries()).map(([id, { name, color }]) => (
            <div key={id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-violet-300/55">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

// ── Regularization type badge config ─────────────────────────────────────────

const REG_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  FORGOT_CLOCK_IN:  { label: 'Forgot Clock In',    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  FORGOT_CLOCK_OUT: { label: 'Forgot Clock Out',   className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  WRONG_TIME:       { label: 'Wrong Time',          className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  SYSTEM_ERROR:     { label: 'System Error',        className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  ON_FIELD_WORK:    { label: 'On-Field Work',       className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  OTHER:            { label: 'Other',               className: 'bg-gray-100 text-gray-600 dark:bg-surface-dark-3 dark:text-violet-200/70' },
};

// ── Regularization approve/reject popover ─────────────────────────────────────

interface RegActionPopoverProps {
  regId:      string;
  action:     'approve' | 'reject';
  onClose:    () => void;
}

function RegActionPopover({ regId, action, onClose }: RegActionPopoverProps) {
  const [remarks, setRemarks] = useState('');
  const approve = useApproveRegularization();
  const reject  = useRejectRegularization();
  const isPending = action === 'approve' ? approve.isPending : reject.isPending;
  const minLen    = action === 'reject' ? 5 : 0;

  function handleConfirm() {
    if (action === 'reject' && remarks.trim().length < 5) return;
    if (action === 'approve') {
      approve.mutate({ id: regId, remarks: remarks.trim() || undefined }, { onSuccess: onClose });
    } else {
      reject.mutate({ id: regId, remarks: remarks.trim() }, { onSuccess: onClose });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-slate-200 dark:border-violet-900/30 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          {action === 'approve' ? 'Approve Regularization' : 'Reject Regularization'}
        </h3>
        <p className="text-xs text-gray-500 dark:text-violet-300/55 mb-3">
          {action === 'approve'
            ? 'Optionally add remarks. Attendance will be updated immediately.'
            : 'Provide a reason for rejection (required, min 5 characters).'}
        </p>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder={action === 'approve' ? 'Remarks (optional)…' : 'Rejection reason (required)…'}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none resize-none transition-colors duration-150"
        />
        {action === 'reject' && remarks.trim().length > 0 && remarks.trim().length < 5 && (
          <p className="text-xs text-status-absent mt-1">At least 5 characters required.</p>
        )}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || (action === 'reject' && remarks.trim().length < minLen)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-colors duration-150',
              action === 'approve' ? 'bg-status-present hover:bg-green-700' : 'bg-status-absent hover:bg-red-700',
            )}
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Regularization card ───────────────────────────────────────────────────────

function RegCard({ reg }: { reg: RegularizationRequest }) {
  const [popover, setPopover] = useState<'approve' | 'reject' | null>(null);
  const typeConfig = REG_TYPE_LABELS[reg.regularizationType] ?? REG_TYPE_LABELS.OTHER;
  const ciStr = reg.requestedClockIn  ? format(new Date(reg.requestedClockIn), 'hh:mm a') : '—';
  const coStr = reg.requestedClockOut ? format(new Date(reg.requestedClockOut), 'hh:mm a') : '(not specified)';
  const submittedHoursAgo = differenceInHours(new Date(), new Date(reg.createdAt));
  const submittedLabel = submittedHoursAgo < 24
    ? `${submittedHoursAgo}h ago`
    : `${Math.floor(submittedHoursAgo / 24)}d ago`;

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 flex flex-col sm:flex-row gap-4 hover:border-violet-200 dark:hover:border-violet-500 transition-colors duration-150">
      {/* Left: employee */}
      <div className="flex items-center gap-3 sm:w-48 shrink-0">
        <UserAvatar name={reg.user?.name ?? '?'} avatarUrl={reg.user?.avatarUrl ?? null} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{reg.user?.name ?? '—'}</p>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 truncate">{reg.user?.designation ?? reg.user?.department ?? '—'}</p>
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {format(new Date(reg.date), 'EEE, dd MMM yyyy')}
          </span>
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', typeConfig.className)}>
            {typeConfig.label}
          </span>
        </div>
        <p className="text-xs text-gray-600 dark:text-violet-200/70">
          <span className="font-medium">Requested:</span>{' '}
          <span className="font-mono">{ciStr}</span>{' → '}
          <span className="font-mono">{coStr}</span>
        </p>
        <p className="text-sm text-gray-500 dark:text-violet-300/55 italic line-clamp-2">"{reg.reason}"</p>
        <p className="text-xs text-gray-400 dark:text-violet-300/45">Submitted {submittedLabel}</p>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        {reg.status === 'PENDING' && (
          <>
            <button
              onClick={() => setPopover('approve')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-status-present text-white rounded-lg hover:bg-green-700 transition-colors duration-150 active:scale-[0.98]"
            >
              <Check className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => setPopover('reject')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-status-absent text-status-absent rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 active:scale-[0.98]"
            >
              <X className="w-3.5 h-3.5" /> Reject
            </button>
          </>
        )}
        {reg.status === 'REJECTED' && (
          <button
            onClick={() => setPopover('approve')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-brand text-brand rounded-lg hover:bg-brand/5 transition-colors duration-150"
          >
            <CalendarClock className="w-3.5 h-3.5" /> Override Approve
          </button>
        )}
        {popover && <RegActionPopover regId={reg.id} action={popover} onClose={() => setPopover(null)} />}
      </div>
    </div>
  );
}

// ── Regularization tab ────────────────────────────────────────────────────────

function RegularizationTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: regs = [], isLoading } = usePendingRegularizations(statusFilter || undefined);

  const selectClass = 'text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg px-3 py-2 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">Pending</option>
          <option value="APPROVED_BY_REVIEWER">Approved by Reviewer</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="REJECTED_BY_ADMIN">Rejected by Admin</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : regs.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
          title="No regularization requests"
          description="No requests match the current filter."
        />
      ) : (
        <div className="space-y-3">
          {regs.map((reg) => <RegCard key={reg.id} reg={reg} />)}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'pending' | 'all' | 'calendar' | 'regularization' | 'joining';

export default function ApprovalsPage() {
  const router = useRouter();
  const { role, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(['pending']));

  const { data: pending }    = usePendingLeaves();
  const { data: pendingRegs } = usePendingRegularizations();
  const { data: joiningData } = useJoiningRequests();
  const pendingJoining = isAdminRole(role) ? (joiningData?.items ?? []).filter((r) => r.status === 'PENDING').length : 0;
  const pendingCount    = pending?.length ?? 0;
  const pendingRegCount = pendingRegs?.length ?? 0;

  const isAdmin = role === 'ADMIN';

  // Links like /approvals?tab=joining open that tab directly
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'joining') { setActiveTab('joining'); setVisitedTabs((prev) => new Set([...prev, 'joining'])); }
  }, []);

  // Route guard: ADMIN can see all tabs; any authenticated employee can see regularization tab
  useEffect(() => {
    if (authLoading) return;
    // Non-admins with pending regularizations to review can access /approvals
    // but will only see the Regularization tab
    if (!role) router.replace('/dashboard');
  }, [role, authLoading, router]);

  if (authLoading || !role) return null;

  // Non-admins: force to regularization tab and only show that
  const effectiveTabs: { id: Tab; label: string }[] = isAdmin
    ? [
        { id: 'pending',        label: 'Pending' },
        { id: 'all',            label: 'All Requests' },
        { id: 'calendar',       label: 'Team Calendar' },
        { id: 'regularization', label: 'Regularization' },
        { id: 'joining',        label: 'Joining dates' },
      ]
    : [{ id: 'regularization', label: 'Regularization' }];

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
  }

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Approvals"
        description="Review and act on requests awaiting your approval."
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-violet-900/40">
        {effectiveTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150',
              activeTab === tab.id
                ? 'border-brand text-brand dark:text-violet-400'
                : 'border-transparent text-gray-500 dark:text-violet-300/55 hover:text-gray-700 dark:hover:text-violet-200/70',
            )}
          >
            {tab.label}
            {tab.id === 'pending' && pendingCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 bg-status-absent text-white text-[11px] font-semibold rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
            {tab.id === 'joining' && pendingJoining > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 bg-amber-500 text-white text-[11px] font-semibold rounded-full flex items-center justify-center">
                {pendingJoining}
              </span>
            )}
            {tab.id === 'regularization' && pendingRegCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 bg-amber-500 text-white text-[11px] font-semibold rounded-full flex items-center justify-center">
                {pendingRegCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content — lazy rendered */}
      <div className={activeTab === 'pending'        ? '' : 'hidden'}>{visitedTabs.has('pending')        && <PendingTab />}</div>
      <div className={activeTab === 'all'            ? '' : 'hidden'}>{visitedTabs.has('all')            && <AllRequestsTab />}</div>
      <div className={activeTab === 'calendar'       ? '' : 'hidden'}>{visitedTabs.has('calendar')       && <TeamCalendarTab />}</div>
      <div className={activeTab === 'regularization' ? '' : 'hidden'}>{visitedTabs.has('regularization') && <RegularizationTab />}</div>
      <div className={activeTab === 'joining'        ? '' : 'hidden'}>{visitedTabs.has('joining')        && isAdmin && <JoiningRequestsTab />}</div>
    </div>
  );
}
