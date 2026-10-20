'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, Users, CheckSquare, Calendar, ClipboardList, Pencil, MoreVertical, UserX, KeyRound } from 'lucide-react';
import { formatDate, getInitials, cn } from '@/lib/utils';
import { useEmployee, useDeactivateEmployee } from '@/hooks/useEmployees';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { PersonalInfoTab } from '@/components/hr/PersonalInfoTab';
import { WorkInfoTab } from '@/components/hr/WorkInfoTab';
import { DocumentsTab } from '@/components/hr/DocumentsTab';
import { LeaveHistoryTab } from '@/components/hr/LeaveHistoryTab';
import { TasksTab } from '@/components/hr/TasksTab';
import { EditEmployeeModal } from '@/components/hr/EditEmployeeModal';
import { ResetPasswordModal } from '@/components/hr/ResetPasswordModal';
import { SalaryTab } from '@/components/hr/SalaryTab';
import { EmployeeDetailsForm } from '@/components/details/EmployeeDetailsForm';
import { CareerTimeline } from '@/components/hr/CareerTimeline';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

type Tab = 'personal' | 'details' | 'career' | 'work' | 'documents' | 'leaves' | 'tasks' | 'salary' | 'appraisals';

const BASE_TABS: { id: Tab; label: string }[] = [
  { id: 'personal',   label: 'Personal Info' },
  { id: 'details',    label: 'My Details' },
  { id: 'work',       label: 'Work Info' },
  { id: 'documents',  label: 'Documents' },
  { id: 'leaves',     label: 'Leave History' },
  { id: 'tasks',      label: 'Tasks' },
  { id: 'appraisals', label: 'Appraisals' },
];

// Someone looking at a colleague's profile (not their own, not an admin) only gets the work basics.
// Personal details, documents, leave history and tasks belong to that person and the admins.
const OTHERS_TABS: { id: Tab; label: string }[] = [
  { id: 'work', label: 'Work Info' },
];

const ADMIN_TABS: { id: Tab; label: string }[] = [
  { id: 'personal',   label: 'Personal Info' },
  { id: 'details',    label: 'Details' },
  { id: 'career',     label: 'Career' },
  { id: 'work',       label: 'Work Info' },
  { id: 'documents',  label: 'Documents' },
  { id: 'leaves',     label: 'Leave History' },
  { id: 'tasks',      label: 'Tasks' },
  { id: 'salary',     label: 'Salary' },
  { id: 'appraisals', label: 'Appraisals' },
];

function useLazyTabs(initial: Tab) {
  const [visited, setVisited] = useState<Set<Tab>>(new Set([initial]));
  function visit(tab: Tab) { setVisited((prev) => new Set([...prev, tab])); }
  return { visited, visit };
}

// ── Deactivate confirm dialog ─────────────────────────────────────────────────

interface DeactivateDialogProps {
  name:     string;
  onClose:  () => void;
  onConfirm: () => void;
  isPending: boolean;
}

function DeactivateDialog({ name, onClose, onConfirm, isPending }: DeactivateDialogProps) {
  const [typed, setTyped] = useState('');
  const confirmed = typed === name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-slate-200 dark:border-violet-900/30 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-status-absent/10 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5 text-status-absent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Deactivate {name}&apos;s account?</h3>
            <p className="text-sm text-slate-500 dark:text-violet-300/55">
              This will immediately revoke their portal access. All pending tasks will become unassigned and pending leaves will be cancelled. This action cannot be undone easily.
            </p>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">
            Type <span className="font-semibold text-gray-900 dark:text-white">{name}</span> to confirm
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={name}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-status-absent focus:outline-none transition-colors duration-150"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-violet-200/70 bg-white dark:bg-surface-dark-3 border border-slate-200 dark:border-violet-900/40 rounded-lg hover:bg-slate-50 dark:hover:bg-surface-dark-3 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-status-absent hover:bg-red-700 rounded-lg disabled:opacity-40 transition-colors"
          >
            {isPending && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Yes, Deactivate Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface EmployeeProfilePageProps {
  params: { employeeId: string };
}

export default function EmployeeProfilePage({ params }: EmployeeProfilePageProps) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { update: updateSession } = useSession();
  const [activeTab,      setActiveTab]      = useState<Tab>('personal');
  const [showEdit,          setShowEdit]          = useState(false);
  const [showDeactivate,    setShowDeactivate]    = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [overflowOpen,      setOverflowOpen]      = useState(false);
  const [otherImgError,     setOtherImgError]     = useState(false);
  const { visited, visit } = useLazyTabs('personal');

  const { data: employee, isLoading } = useEmployee(params.employeeId);

  useEffect(() => {
    setOtherImgError(false);
  }, [employee?.avatarUrl]);
  const deactivate = useDeactivateEmployee();
  const queryClient = useQueryClient();

  const isSelf   = user?.id === params.employeeId;
  const canEdit  = isSelf || isAdmin;
  const isActive = (employee as (typeof employee & { isActive?: boolean }) | undefined)?.isActive !== false;
  const TABS = isAdmin ? ADMIN_TABS : isSelf ? BASE_TABS : OTHERS_TABS;
  // The tab actually shown: falls back to the first allowed one, and anything not allowed is never rendered.
  const can = (t: Tab) => TABS.some((x) => x.id === t);
  const tab = can(activeTab) ? activeTab : TABS[0].id;
  const canSeePrivate = isAdmin || isSelf;

  function handleTabChange(tab: Tab) { setActiveTab(tab); visit(tab); }

  function handleDeactivate() {
    deactivate.mutate(params.employeeId, {
      onSuccess: () => {
        toast.success(`${employee?.name}'s account has been deactivated.`);
        router.push('/hr');
      },
    });
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto pb-10 space-y-4">
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-4xl mx-auto pb-10 text-center py-20">
        <p className="text-gray-500 dark:text-violet-300/55">Employee not found.</p>
        <button onClick={() => router.push('/hr')} className="mt-4 text-sm text-brand hover:underline">Back to Directory</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-10">
      {/* Back */}
      <button onClick={() => router.push('/hr')} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-violet-300/55 hover:text-gray-900 dark:hover:text-white mb-5 transition-colors duration-150">
        <ArrowLeft className="w-4 h-4" /> People Directory
      </button>

      {/* Hero card */}
      <div className={cn('bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-6 mb-5', !isActive && 'opacity-75')}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="relative shrink-0">
            {isSelf ? (
              <AvatarUpload
                currentAvatarUrl={employee.avatarUrl ?? null}
                userName={employee.name}
                size="md"
                onUploadComplete={(url) => {
                  queryClient.invalidateQueries({ queryKey: ['employees', params.employeeId] });
                  queryClient.invalidateQueries({ queryKey: ['employees'] });
                  queryClient.invalidateQueries({ queryKey: ['myProfile'] });
                  void updateSession({ avatarUrl: url });
                }}
              />
            ) : (
              <div className={cn('w-20 h-20 rounded-full bg-brand-light text-brand flex items-center justify-center text-2xl font-semibold overflow-hidden border-2 border-white dark:border-violet-900/40 shadow-sm', !isActive && 'grayscale')}>
                {employee.avatarUrl && !otherImgError ? (
                  <img src={employee.avatarUrl} alt={employee.name} className="w-full h-full object-cover" onError={() => setOtherImgError(true)} />
                ) : (
                  getInitials(employee.name)
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{employee.name}</h1>
                <p className="text-sm text-gray-500 dark:text-violet-300/55 mt-0.5">{employee.designation ?? '—'}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {employee.department && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-light text-brand dark:bg-violet-900/30 dark:text-violet-300">
                      {employee.department}
                    </span>
                  )}
                  <StatusBadge status={isActive ? 'active' : 'inactive'} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {canEdit && (
                  <button
                    onClick={() => setShowEdit(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                )}
                {/* Overflow menu — ADMIN only, deactivate */}
                {isAdmin && !isSelf && isActive && (
                  <div className="relative">
                    <button
                      onClick={() => setOverflowOpen((v) => !v)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {overflowOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOverflowOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-xl shadow-lg py-1 z-20">
                          <button
                            onClick={() => { setOverflowOpen(false); setShowResetPassword(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
                          >
                            <KeyRound className="w-4 h-4" /> Reset Password
                          </button>
                          <button
                            onClick={() => { setOverflowOpen(false); setShowDeactivate(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-status-absent hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors duration-150"
                          >
                            <UserX className="w-4 h-4" /> Deactivate Account
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stat chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">
                  <CalendarDays className="w-3.5 h-3.5" /> Joined
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(employee.joiningDate ?? employee.createdAt)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">
                  <Users className="w-3.5 h-3.5" /> Reports To
                </div>
                {employee.manager ? (
                  <Link href={`/hr/${employee.manager.id}`} className="text-sm font-semibold text-brand hover:underline truncate block">
                    {employee.manager.name}
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-gray-400">—</p>
                )}
              </div>
              {canSeePrivate && <div className="bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">
                  <Calendar className="w-3.5 h-3.5" /> Leaves Taken
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{employee._count?.leaves ?? 0}</p>
              </div>}
              {canSeePrivate && <div className="bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">
                  <ClipboardList className="w-3.5 h-3.5" /> Open Tasks
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{employee._count?.tasks ?? 0}</p>
              </div>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100 dark:border-violet-900/40 scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                'px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 border-b-2 -mb-px',
                tab === t.id
                  ? 'border-brand text-brand dark:text-violet-400'
                  : 'border-transparent text-gray-500 dark:text-violet-300/55 hover:text-gray-700 dark:hover:text-violet-200/70',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          <div className={tab === 'personal'   ? '' : 'hidden'}>{(visited.has('personal') || tab === 'personal') && can('personal')   && <PersonalInfoTab employee={employee} canEdit={canEdit} />}</div>
          <div className={tab === 'details'    ? '' : 'hidden'}>{(visited.has('details') || tab === 'details') && can('details') && <EmployeeDetailsForm employeeId={employee.id} isSelf={isSelf} />}</div>
          <div className={tab === 'career'     ? '' : 'hidden'}>{(visited.has('career') || tab === 'career') && can('career') && isAdmin && <CareerTimeline employeeId={employee.id} />}</div>
          <div className={tab === 'work'       ? '' : 'hidden'}>{(visited.has('work') || tab === 'work') && can('work')       && <WorkInfoTab employee={employee} isAdmin={isAdmin} />}</div>
          <div className={tab === 'documents'  ? '' : 'hidden'}>{(visited.has('documents') || tab === 'documents') && can('documents')  && <DocumentsTab employeeId={employee.id} canUpload={canEdit} canDelete={isSelf || isAdmin} />}</div>
          <div className={tab === 'leaves'     ? '' : 'hidden'}>{(visited.has('leaves') || tab === 'leaves') && can('leaves')     && <LeaveHistoryTab employeeId={employee.id} />}</div>
          <div className={tab === 'tasks'      ? '' : 'hidden'}>{(visited.has('tasks') || tab === 'tasks') && can('tasks')      && <TasksTab employeeId={employee.id} />}</div>
          <div className={tab === 'salary'     ? '' : 'hidden'}>{(visited.has('salary') || tab === 'salary') && can('salary')     && isAdmin && <SalaryTab employeeId={employee.id} />}</div>
          {can('appraisals') && <div className={tab === 'appraisals' ? '' : 'hidden'}>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center mb-4">
                <CalendarDays className="w-8 h-8 text-gray-300 dark:text-violet-300/45" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Appraisal cycles coming soon</h3>
              <p className="text-sm text-gray-400 dark:text-violet-300/45 max-w-xs">Performance reviews and appraisal cycles will be available in a future update.</p>
            </div>
          </div>}
        </div>
      </div>

      {/* Modals */}
      {showEdit && (
        <EditEmployeeModal
          employee={employee}
          isAdmin={isAdmin}
          isSelf={isSelf}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showResetPassword && employee && (
        <ResetPasswordModal
          employeeId={employee.id}
          employeeName={employee.name}
          employeeEmail={employee.email}
          onClose={() => setShowResetPassword(false)}
        />
      )}
      {showDeactivate && (
        <DeactivateDialog
          name={employee.name}
          onClose={() => setShowDeactivate(false)}
          onConfirm={handleDeactivate}
          isPending={deactivate.isPending}
        />
      )}
    </div>
  );
}
