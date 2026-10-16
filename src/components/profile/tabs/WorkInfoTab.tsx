'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check } from 'lucide-react';
import { formatDistanceToNow, format, isValid } from 'date-fns';
import { cn, getInitials } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { MyProfile } from '@/types/profile';
import { JoiningDateRequest } from '@/components/profile/JoiningDateRequest';

interface WorkInfoTabProps {
  user: MyProfile;
}

function CopyId({ value }: { value: string }) {
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
      className="group flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white font-mono hover:text-violet-600 dark:hover:text-violet-400 transition-colors duration-150"
    >
      <span>{value.slice(0, 8).toUpperCase()}</span>
      {copied
        ? <Check className="w-3 h-3 text-green-500" />
        : <Copy className="w-3 h-3 text-gray-300 dark:text-violet-400/35 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />}
    </button>
  );
}

function EmploymentBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-sm text-gray-400 dark:text-violet-300/45 italic">Not set</span>;
  const map: Record<string, string> = {
    FULL_TIME: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    PART_TIME: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    CONTRACT:  'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  };
  const label: Record<string, string> = { FULL_TIME: 'Full Time', PART_TIME: 'Part Time', CONTRACT: 'Contract' };
  return (
    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', map[type] ?? 'bg-gray-100 text-gray-600')}>
      {label[type] ?? type}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    EMPLOYEE: 'bg-gray-100 text-gray-700 dark:bg-surface-dark-3 dark:text-violet-200/70',
    ADMIN:    'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  };
  const label: Record<string, string> = { EMPLOYEE: 'Employee', ADMIN: 'Admin' };
  return (
    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', map[role] ?? 'bg-gray-100 text-gray-600')}>
      {label[role] ?? role}
    </span>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">{label}</p>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{children}</div>
    </div>
  );
}

export function WorkInfoTab({ user }: WorkInfoTabProps) {
  const router = useRouter();

  // joiningDate is the employee's actual start date, set at onboarding; createdAt
  // (when their account record was created) is only a fallback for older accounts
  // onboarded before joiningDate existed.
  const joinedDate     = user.joiningDate ? new Date(user.joiningDate) : user.createdAt ? new Date(user.createdAt) : null;
  const joinedExact    = joinedDate && isValid(joinedDate) ? format(joinedDate, 'd MMM yyyy') : '—';
  const joinedRelative = joinedDate && isValid(joinedDate) ? formatDistanceToNow(joinedDate, { addSuffix: true }) : '';

  return (
    <div className="space-y-8">

      {/* Position Details */}
      <div>
        <div className="pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Position Details</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6">

          <Field label="Employee ID">
            <CopyId value={user.id} />
          </Field>

          <Field label="Designation">
            {user.designation ?? <span className="text-gray-400 dark:text-violet-300/45 italic font-normal">Not set</span>}
          </Field>

          <Field label="Department">
            {user.department
              ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">{user.department}</span>
              : <span className="text-gray-400 dark:text-violet-300/45 italic font-normal">Not set</span>}
          </Field>

          <Field label="Employment Type">
            <EmploymentBadge type={user.employmentType} />
          </Field>

          <Field label="Joining Date">
            <span>{joinedExact}</span>
            {joinedRelative && (
              <span className="ml-2 text-xs text-gray-400 dark:text-violet-300/45 font-normal">({joinedRelative})</span>
            )}
            <JoiningDateRequest currentDate={user.joiningDate ? new Date(user.joiningDate).toISOString().slice(0, 10) : null} />
          </Field>

          <Field label="Role">
            <div className="space-y-1">
              <RoleBadge role={user.role} />
              <p className="text-xs text-gray-400 dark:text-violet-300/45 font-normal mt-1">Contact admin to change your role.</p>
            </div>
          </Field>

          {/* Reports To — full width */}
          <Field label="Reports To" wide>
            {user.manager ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-xs font-semibold text-violet-700 dark:text-violet-300 shrink-0">
                  {user.manager.avatarUrl
                    ? <img src={user.manager.avatarUrl} alt={user.manager.name} className="w-full h-full object-cover" />
                    : getInitials(user.manager.name)}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => router.push(`/hr/${user.manager!.id}`)}
                    className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    {user.manager.name}
                  </button>
                  {user.manager.designation && (
                    <p className="text-xs text-gray-400 dark:text-violet-300/45 font-normal">{user.manager.designation}</p>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-gray-400 dark:text-violet-300/45 italic font-normal">Not assigned</span>
            )}
          </Field>

        </div>
      </div>

      {/* Direct Reports — shown for any employee who has reports */}
      {user.reports.length > 0 && (
        <div>
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Direct Reports</h3>
            {user.reports.length > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-600 dark:text-violet-200/70">
                {user.reports.length}
              </span>
            )}
          </div>

          {user.reports.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-violet-300/45 italic">No direct reports assigned yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {user.reports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => router.push(`/hr/${r.id}`)}
                  className="flex flex-col items-center p-3 border border-gray-200 dark:border-violet-900/40 rounded-lg hover:border-violet-200 dark:hover:border-violet-700 cursor-pointer transition-colors duration-150 text-center"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-sm font-semibold text-violet-700 dark:text-violet-300 shrink-0">
                    {r.avatarUrl
                      ? <img src={r.avatarUrl} alt={r.name} className="w-full h-full object-cover" />
                      : getInitials(r.name)}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-2 truncate w-full">{r.name}</p>
                  {r.designation && (
                    <p className="text-xs text-gray-400 dark:text-violet-300/45 truncate w-full">{r.designation}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
