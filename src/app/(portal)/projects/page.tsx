'use client';

import { useState, useMemo } from 'react';
import {
  FolderKanban,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  IndianRupee,
  Users,
  Building2,
  AlertCircle
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { AssignProjectModal } from '@/components/projects/AssignProjectModal';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { useProjects, downloadProjectsExcel } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useEmployeeList } from '@/hooks/useTasks';
import type { ProjectStatus } from '@/types';

export default function ProjectsPage() {
  const { user, isAdmin } = useAuth();
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');

  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployeeList();

  const { data: projects = [], isLoading, isError } = useProjects({
    clientId:   clientFilter || undefined,
    employeeId: isAdmin && employeeFilter ? employeeFilter : undefined,
    status:     statusFilter !== 'ALL' ? statusFilter : undefined,
    search:     search || undefined,
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    let totalValue = 0;
    let activeCount = 0;
    let completedCount = 0;
    let onHoldCount = 0;

    for (const p of projects) {
      if (p.status === 'ACTIVE') activeCount++;
      else if (p.status === 'COMPLETED') completedCount++;
      else if (p.status === 'ON_HOLD') onHoldCount++;

      if (typeof p.amount === 'number') {
        totalValue += p.amount;
      }
    }

    return { totalValue, activeCount, completedCount, onHoldCount };
  }, [projects]);

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <PageHeader
        title={isAdmin ? 'Project Management & Assignment' : 'My Assigned Projects'}
        description={
          isAdmin
            ? `Manage client project assignments, deadlines, progress, and confidential financial budgets.`
            : `Track your active client project deliverables, deadlines, and project milestones.`
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            {isAdmin && (
              <button
                type="button"
                onClick={() => downloadProjectsExcel()}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40 rounded-lg transition-colors shadow-xs cursor-pointer"
                title="Download comprehensive project master spreadsheet with all budgets and assignments (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Export Excel (.xlsx)
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Assign Project
              </button>
            )}
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total / My Projects */}
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              {isAdmin ? 'Total Projects' : 'Assigned Projects'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-950 dark:text-white">
            {projects.length}
          </p>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">
            {isAdmin ? `${clients.length} registered clients` : 'Assigned to your queue'}
          </p>
        </div>

        {/* Active Projects */}
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Active In-Progress
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {kpis.activeCount}
          </p>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">
            Under active development
          </p>
        </div>

        {/* Completed Projects */}
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {kpis.completedCount}
          </p>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">
            Successfully delivered
          </p>
        </div>

        {/* Financial KPI: ADMIN ACCESS ONLY */}
        {isAdmin ? (
          <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Total Project Value
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-zinc-950 dark:text-white">
              ₹{kpis.totalValue.toLocaleString('en-IN')}
            </p>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1 font-semibold">
              Confidential (Admin only)
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                On Hold
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {kpis.onHoldCount}
            </p>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">
              Awaiting client approval / pause
            </p>
          </div>
        )}
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search projects by name, code, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-brand focus:outline-none"
            />
          </div>
        </div>

        {/* Dropdowns & Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-surface-dark-2 border border-gray-200 dark:border-white/5 text-xs">
            {['ALL', 'ACTIVE', 'ON_HOLD', 'COMPLETED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-white dark:bg-white/10 text-zinc-950 dark:text-white shadow-xs font-bold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Employee Filter (Admin Only) */}
          {isAdmin && (
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
            >
              <option value="">All Assignees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<FolderKanban className="w-10 h-10 text-gray-300" />}
          title="Failed to load projects"
          description="There was an issue fetching the projects. Please check your connection or refresh."
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-10 h-10 text-zinc-400" />}
          title={isAdmin ? 'No projects found' : 'No projects assigned yet'}
          description={
            isAdmin
              ? 'Assign client projects to employees to start tracking deadlines and deliverables.'
              : 'You do not have any projects currently assigned to you.'
          }
          action={
            isAdmin ? (
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
                Assign First Project
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showAssignModal && (
        <AssignProjectModal
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </div>
  );
}
