'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Building2, Users, Calendar, Briefcase, Copy, Check } from 'lucide-react';
import { formatDistanceToNow, format, isValid } from 'date-fns';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { LEAVE_TYPES } from '@/lib/constants';
import type { MyProfile, LeaveBalanceEntry, AttendanceSummary } from '@/types/profile';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompletenessInfo {
  percentage:     number;
  nextSuggestion: { text: string; tab: string; field: string } | null;
}

interface ProfileCardProps {
  user:               MyProfile;
  isClockedIn:        boolean;
  isOnLeaveToday:     boolean;
  attendanceSummary:  AttendanceSummary;
  leaveBalances:      LeaveBalanceEntry[];
  completeness:       CompletenessInfo;
  onTabChange:        (tab: string) => void;
}

// ── Copy-on-click cell ────────────────────────────────────────────────────────

function CopyCell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex items-center gap-1 text-sm text-gray-700 dark:text-violet-200/70 hover:text-violet-600 dark:hover:text-violet-400 transition-colors duration-150 text-left"
    >
      <span className="truncate max-w-[160px]">{value}</span>
      {copied
        ? <Check className="w-3 h-3 text-green-500 shrink-0" />
        : <Copy className="w-3 h-3 text-gray-300 dark:text-violet-400/35 group-hover:text-violet-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />}
    </button>
  );
}

// ── Employment type badge ─────────────────────────────────────────────────────

function EmploymentBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-sm text-gray-400 dark:text-violet-300/45 italic">Not set</span>;
  const map: Record<string, string> = {
    FULL_TIME: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    PART_TIME: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    CONTRACT:  'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  };
  const label: Record<string, string> = { FULL_TIME: 'Full Time', PART_TIME: 'Part Time', CONTRACT: 'Contract' };
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', map[type] ?? 'bg-gray-100 text-gray-600')}>
      {label[type] ?? type}
    </span>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const label: Record<string, string> = { EMPLOYEE: 'Employee', MANAGER: 'Manager', ADMIN: 'Admin' };
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-600 dark:text-violet-200/70">
      {label[role] ?? role}
    </span>
  );
}

// ── Leave dot color ───────────────────────────────────────────────────────────

function leaveDotColor(type: string): string {
  const found = LEAVE_TYPES.find((l) => l.value === type);
  return found?.color ?? '#6B7280';
}

function leaveLabel(type: string): string {
  const found = LEAVE_TYPES.find((l) => l.value === type);
  return found?.label ?? type;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProfileCard({
  user,
  isClockedIn,
  isOnLeaveToday,
  attendanceSummary,
  leaveBalances,
  completeness,
  onTabChange,
}: ProfileCardProps) {
  const router = useRouter();
  const { updateAvatarCache } = useMyProfile();
  const { isAdmin } = useAuth();

  const { percentage, nextSuggestion } = completeness;

  const barColor =
    percentage === 100 ? 'bg-green-500' :
    percentage >= 60   ? 'bg-violet-500' :
                         'bg-amber-400';

  const pctColor =
    percentage === 100 ? 'text-green-600 dark:text-green-400' :
    percentage >= 60   ? 'text-violet-600 dark:text-violet-400' :
                         'text-amber-600 dark:text-amber-400';

  // Joining date
  const joinedDate = user.createdAt ? new Date(user.createdAt) : null;
  const joinedRelative = joinedDate && isValid(joinedDate)
    ? formatDistanceToNow(joinedDate, { addSuffix: true })
    : '—';
  const joinedExact = joinedDate && isValid(joinedDate)
    ? format(joinedDate, 'd MMM yyyy')
    : '—';

  // Absent = working days in month minus present+wfh+halfDay
  const absent = Math.max(0, attendanceSummary.total - attendanceSummary.present - attendanceSummary.wfh - attendanceSummary.halfDay);

  function handleSuggestionClick() {
    if (!nextSuggestion) return;
    onTabChange(nextSuggestion.tab);
    setTimeout(() => {
      const el = document.getElementById(nextSuggestion.field);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
    }, 120);
  }

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 sticky top-6">

      {/* ── Avatar ── */}
      <div className="flex flex-col items-center pt-1">
        <AvatarUpload
          currentAvatarUrl={user.avatarUrl}
          userName={user.name}
          size="lg"
          onUploadComplete={(url) => updateAvatarCache(url)}
        />

        {/* Completeness bar */}
        <div className="w-full mt-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Profile completeness</span>
            <span className={cn('text-xs font-semibold', pctColor)}>{percentage}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-surface-dark-3 rounded-full h-2">
            <div
              className={cn('h-2 rounded-full transition-all duration-700', barColor)}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {nextSuggestion && percentage < 100 && (
            <button
              type="button"
              onClick={handleSuggestionClick}
              className="mt-1.5 text-xs text-gray-400 dark:text-violet-300/45 hover:text-violet-600 dark:hover:text-violet-400 transition-colors duration-150 text-left"
            >
              → {nextSuggestion.text}
            </button>
          )}
          {percentage === 100 && (
            <p className="mt-1.5 text-xs text-green-600 dark:text-green-400 font-medium">Profile complete ✓</p>
          )}
        </div>

        {/* Name / designation / department */}
        <p className="text-xl font-semibold text-gray-900 dark:text-white text-center mt-3 leading-tight">{user.name}</p>
        {user.designation && (
          <p className="text-sm text-gray-500 dark:text-violet-300/55 text-center mt-0.5">{user.designation}</p>
        )}
        {user.department && (
          <span className="mt-1.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium px-3 py-1 rounded-full">
            {user.department}
          </span>
        )}

        {/* Status row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
          {isClockedIn ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-xs text-green-700 dark:text-green-400 font-medium">Currently working</span>
            </>
          ) : isOnLeaveToday ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-xs text-amber-700 dark:text-amber-400">On Leave today</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-surface-dark-3 shrink-0" />
              <span className="text-xs text-gray-400 dark:text-violet-300/45">Offline</span>
            </>
          )}
          <RoleBadge role={user.role} />
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-violet-900/40 my-4" />

      {/* ── Quick info ── */}
      <div className="space-y-3">
        {/* Email */}
        <div className="flex items-center gap-3">
          <Mail className="w-4 h-4 text-gray-400 dark:text-violet-300/45 shrink-0" />
          <CopyCell value={user.email} />
        </div>

        {/* Phone */}
        <div className="flex items-center gap-3">
          <Phone className="w-4 h-4 text-gray-400 dark:text-violet-300/45 shrink-0" />
          {user.phone
            ? <CopyCell value={user.phone} />
            : (
              <button
                type="button"
                onClick={() => onTabChange('personal')}
                className="text-sm text-gray-400 dark:text-violet-300/45 italic hover:text-violet-600 dark:hover:text-violet-400 transition-colors duration-150"
              >
                Not set
              </button>
            )}
        </div>

        {/* Department */}
        <div className="flex items-center gap-3">
          <Building2 className="w-4 h-4 text-gray-400 dark:text-violet-300/45 shrink-0" />
          <span className="text-sm text-gray-700 dark:text-violet-200/70 truncate">
            {user.department ?? <span className="text-gray-400 dark:text-violet-300/45 italic">No department</span>}
          </span>
        </div>

        {/* Manager */}
        <div className="flex items-start gap-3">
          <Users className="w-4 h-4 text-gray-400 dark:text-violet-300/45 shrink-0 mt-0.5" />
          {user.manager ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-gray-400 dark:text-violet-300/45 shrink-0">Reports to:</span>
              <div className="w-5 h-5 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-[9px] font-semibold text-violet-700 dark:text-violet-300 shrink-0">
                {user.manager.avatarUrl
                  ? <img src={user.manager.avatarUrl} alt={user.manager.name} className="w-full h-full object-cover" />
                  : user.manager.name.charAt(0).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={() => router.push(`/hr/${user.manager!.id}`)}
                className="text-sm text-violet-600 dark:text-violet-400 hover:underline truncate"
              >
                {user.manager.name}
              </button>
            </div>
          ) : (
            <span className="text-sm text-gray-400 dark:text-violet-300/45 italic">No manager assigned</span>
          )}
        </div>

        {/* Joined */}
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-gray-400 dark:text-violet-300/45 shrink-0" />
          <span
            className="text-sm text-gray-700 dark:text-violet-200/70 cursor-default"
            title={joinedExact}
          >
            Joined {joinedRelative}
          </span>
        </div>

        {/* Employment type */}
        <div className="flex items-center gap-3">
          <Briefcase className="w-4 h-4 text-gray-400 dark:text-violet-300/45 shrink-0" />
          <EmploymentBadge type={user.employmentType} />
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-violet-900/40 my-4" />

      {/* ── Leave balances (admins only) ── */}
      {isAdmin && <><div>
        <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Leave Balance</p>
        {leaveBalances.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-violet-300/45 italic mt-2">No leave policy assigned</p>
        ) : (
          <div className="mt-3 space-y-2">
            {leaveBalances.filter((b) => b.allowance > 0).map((b) => (
              <div key={b.type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: leaveDotColor(b.type) }}
                  />
                  <span className="text-sm text-gray-700 dark:text-violet-200/70">{leaveLabel(b.type)}</span>
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{b.remaining}</span>
                  <span className="text-xs text-gray-400 dark:text-violet-300/45">/{b.allowance}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-violet-900/40 my-4" /></>}

      {/* ── Attendance this month ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">This Month</p>
        <div className="mt-3 flex gap-2">
          <div className="flex-1 text-center bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg py-2">
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">{attendanceSummary.present}</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">Present</p>
          </div>
          <div className="flex-1 text-center bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg py-2">
            <p className="text-lg font-semibold text-status-absent dark:text-red-400">{absent}</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">Absent</p>
          </div>
          <div className="flex-1 text-center bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg py-2">
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{attendanceSummary.wfh}</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">WFH</p>
          </div>
        </div>
      </div>
    </div>
  );
}
