'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FolderKanban,
  Briefcase,
  Search,
  CheckSquare,
  ShieldAlert,
  ArrowLeft,
  DollarSign,
  Download,
  ChevronRight,
  UserCheck,
  Calendar,
  Clock,
  User,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProjectBillingDetail, downloadProjectBillingExcel } from '@/hooks/useBilling';
import { useExcelDownloadStore } from '@/store/useExcelDownloadStore';
import { PageLoader } from '@/components/shared/PageLoader';
import { cn } from '@/lib/utils';
import { getProjectBillingExportFilename } from '@/lib/billingExcel';

type FilterStatus = 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';

export default function ProjectBillingDetailPage() {
  const params = useParams();
  const rawAgencyId = (params?.id as string) ?? '';
  const rawProjectId = (params?.projectId as string) ?? '';

  const agencyId = decodeURIComponent(rawAgencyId);
  const projectId = decodeURIComponent(rawProjectId);

  const { user, isLoading: authLoading } = useAuth();
  const { data, isLoading: dataLoading, error } = useProjectBillingDetail(agencyId, projectId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const isExcelDownloading = useExcelDownloadStore((s) => s.isDownloading);

  const isAdmin = user?.role === 'ADMIN';

  const agency = data?.agency;
  const project = data?.project;
  const summary = data?.summary;
  const tasks = data?.tasks ?? [];

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Status filter
      if (statusFilter === 'COMPLETED') {
        if (!['DONE', 'CLOSED', 'VERIFIED'].includes(t.status)) return false;
      } else if (statusFilter === 'IN_PROGRESS') {
        if (!['IN_PROGRESS', 'IN_TESTING', 'READY_FOR_QA', 'INTERNAL_REVIEW', 'CLIENT_REVIEW'].includes(t.status))
          return false;
      } else if (statusFilter === 'PENDING') {
        if (
          ['DONE', 'CLOSED', 'VERIFIED', 'IN_PROGRESS', 'IN_TESTING', 'READY_FOR_QA', 'INTERNAL_REVIEW', 'CLIENT_REVIEW'].includes(
            t.status,
          )
        )
          return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchHumanId = t.humanId.toLowerCase().includes(q);
        const matchEmp = t.assignee?.name.toLowerCase().includes(q);
        if (!matchTitle && !matchHumanId && !matchEmp) return false;
      }

      return true;
    });
  }, [tasks, statusFilter, search]);

  // Calculate filtered total
  const filteredTotal = useMemo(() => {
    return filteredTasks.reduce((acc, t) => acc + (t.amount || 0), 0);
  }, [filteredTasks]);

  const exportFilename = useMemo(() => {
    return agency?.name && project?.name
      ? getProjectBillingExportFilename(agency.name, project.name)
      : 'Project_Billing_Report.xlsx';
  }, [agency?.name, project?.name]);

  const exportUrl = useMemo(() => {
    if (!agencyId || !projectId) return '';
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());
    const qs = params.toString();
    return `/api/billing/${encodeURIComponent(agencyId)}/project/${encodeURIComponent(projectId)}/export/${exportFilename}${qs ? `?${qs}` : ''}`;
  }, [agencyId, projectId, exportFilename, statusFilter, search]);

  if (authLoading || dataLoading) {
    return <PageLoader />;
  }

  // Security check: Only Admin
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="size-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
          <ShieldAlert className="size-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Admin Authorization Required
        </h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mb-6">
          The Billing and Financial Management section is strictly confidential and reserved for authorized administrators.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-colors"
        >
          <ArrowLeft className="size-4" /> Return to Dashboard
        </Link>
      </div>
    );
  }

  if (error || !project || !agency) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <FolderKanban className="size-16 text-gray-300 dark:text-zinc-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Project Billing Not Found</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mb-6">
          The requested project billing details could not be located.
        </p>
        <Link
          href={`/billing/${encodeURIComponent(agencyId)}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to Projects
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DONE':
      case 'CLOSED':
      case 'VERIFIED':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'IN_PROGRESS':
      case 'IN_TESTING':
      case 'READY_FOR_QA':
      case 'INTERNAL_REVIEW':
      case 'CLIENT_REVIEW':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation: Billing → Agency → Project → Billing Details */}
      <nav className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-400 flex-wrap">
        <Link href="/billing" className="hover:text-brand transition-colors">
          Billing
        </Link>
        <ChevronRight className="size-3.5 text-gray-400 shrink-0" />
        <Link
          href={`/billing/${encodeURIComponent(agency.id)}`}
          className="hover:text-brand transition-colors truncate max-w-xs"
        >
          {agency.name}
        </Link>
        <ChevronRight className="size-3.5 text-gray-400 shrink-0" />
        <span className="text-gray-900 dark:text-white font-semibold truncate max-w-xs">
          {project.name}
        </span>
        <ChevronRight className="size-3.5 text-gray-400 shrink-0" />
        <span className="text-brand font-bold">Billing Details</span>
      </nav>

      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <Link
              href={`/billing/${encodeURIComponent(agency.id)}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-brand dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="size-3.5" /> Back to Projects
            </Link>
            <span className="text-xs text-gray-300 dark:text-zinc-600">|</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20">
              <Briefcase className="size-3" /> {agency.name}
            </span>
            {project.clientName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <UserCheck className="size-3" /> Client: {project.clientName}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FolderKanban className="size-6 text-brand" />
            {project.name}
            <span className="text-xs font-mono font-medium text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-surface-dark-3 px-2 py-0.5 rounded-md">
              [{project.prefix}]
            </span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Individual task billing records, completion statuses, and verified financial calculations.
          </p>
        </div>

        {/* Export Excel Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              downloadProjectBillingExcel(
                agencyId,
                projectId,
                agency?.name || 'Agency',
                project?.name || 'Project',
                { status: statusFilter, search }
              );
            }}
            disabled={isExcelDownloading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download className="size-4" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-5 shadow-xs flex items-center gap-4">
          <div className="size-12 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <CheckSquare className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Total Project Tasks
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {summary?.totalTasks ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-5 shadow-xs flex items-center gap-4">
          <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckSquare className="size-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Completed Tasks
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {summary?.completedTasks ?? 0}
              <span className="text-xs font-normal text-gray-400 dark:text-zinc-500 ml-2">
                (
                {summary?.totalTasks
                  ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
                  : 0}
                %)
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-brand/30 dark:border-brand/40 bg-gradient-to-br from-brand/[0.04] to-transparent p-5 shadow-xs flex items-center gap-4">
          <div className="size-12 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign className="size-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-brand uppercase tracking-wider">
              Total Project Billing Amount
            </p>
            <p className="text-2xl font-black text-brand tracking-tight mt-0.5">
              ₹{(summary?.totalBilling ?? 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by task ID, task name, or assigned employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-surface-dark-3 rounded-xl border border-gray-200/60 dark:border-white/5 shrink-0 overflow-x-auto">
          {(['ALL', 'COMPLETED', 'IN_PROGRESS', 'PENDING'] as FilterStatus[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                statusFilter === tab
                  ? 'bg-white dark:bg-surface-dark-2 text-brand shadow-xs font-bold'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white',
              )}
            >
              {tab === 'ALL'
                ? 'All Tasks'
                : tab === 'COMPLETED'
                  ? 'Completed'
                  : tab === 'IN_PROGRESS'
                    ? 'In Progress'
                    : 'Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* Dedicated Project Billing Table */}
      <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 dark:bg-surface-dark-3/60 border-b border-gray-200/80 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Task ID</th>
                <th className="py-3.5 px-4">Task Name</th>
                <th className="py-3.5 px-4">Assigned Employee</th>
                <th className="py-3.5 px-4">Assigned Date</th>
                <th className="py-3.5 px-4">Deadline</th>
                <th className="py-3.5 px-4">Task Status</th>
                <th className="py-3.5 px-4 text-right">Individual Task Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 dark:text-zinc-400">
                    <CheckSquare className="size-8 mx-auto mb-2 text-gray-300 dark:text-zinc-600" />
                    <p className="text-sm font-medium">No tasks found matching your filter criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-surface-dark-3/40 transition-colors"
                  >
                    {/* Task ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-brand dark:text-brand-light whitespace-nowrap">
                      {t.humanId}
                    </td>

                    {/* Task Name */}
                    <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-white max-w-md">
                      <div className="truncate" title={t.title}>
                        {t.title}
                      </div>
                    </td>

                    {/* Assigned Employee */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {t.assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full overflow-hidden bg-brand/10 text-brand flex items-center justify-center text-[10px] font-bold shrink-0">
                            {t.assignee.avatarUrl ? (
                              <img
                                src={t.assignee.avatarUrl}
                                alt={t.assignee.name}
                                className="size-full object-cover"
                              />
                            ) : (
                              t.assignee.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <span className="text-xs text-gray-900 dark:text-white font-medium">
                            {t.assignee.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Assigned Date */}
                    <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-3 text-gray-400" />
                        {new Date(t.assignedDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>

                    {/* Deadline */}
                    <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
                      {t.dueDate ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="size-3 text-gray-400" />
                          {new Date(t.dueDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">No deadline</span>
                      )}
                    </td>

                    {/* Task Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wider uppercase',
                          getStatusBadge(t.status),
                        )}
                      >
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Individual Task Amount */}
                    <td className="py-3.5 px-4 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      ₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Footer: Total calculated amount */}
            <tfoot className="bg-gray-50/90 dark:bg-surface-dark-3/80 border-t-2 border-gray-200 dark:border-white/10 font-bold">
              <tr>
                <td colSpan={2} className="py-4 px-4 text-xs uppercase tracking-wider text-gray-600 dark:text-zinc-300">
                  Total Tasks Displayed: {filteredTasks.length}
                </td>
                <td colSpan={4} className="py-4 px-4 text-right text-xs uppercase tracking-wider text-gray-700 dark:text-zinc-300">
                  Total Project Billing Amount:
                </td>
                <td className="py-4 px-4 text-right text-lg font-black text-brand dark:text-brand-light whitespace-nowrap">
                  ₹{filteredTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
