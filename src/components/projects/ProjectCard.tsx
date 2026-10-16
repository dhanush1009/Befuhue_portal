'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Building2,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Pencil,
  Trash2,
  ShieldCheck,
  CheckSquare,
  ArrowRight
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { Project, ProjectStatus } from '@/types';
import { useDeleteProject } from '@/hooks/useProjects';
import { EditProjectModal } from './EditProjectModal';

interface ProjectCardProps {
  project: Project;
  isAdmin: boolean;
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  ACTIVE:    { label: 'Active',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40' },
  ON_HOLD:   { label: 'On Hold',   className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40' },
  COMPLETED: { label: 'Completed', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40' },
  CANCELLED: { label: 'Cancelled', className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40' },
};

export function ProjectCard({ project, isAdmin }: ProjectCardProps) {
  const [showEdit, setShowEdit] = useState(false);
  const deleteProject = useDeleteProject();

  const statusConfig = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.ACTIVE;
  const deadlineDate = project.deadline ? new Date(project.deadline) : (project.targetDate ? new Date(project.targetDate) : null);

  // Calculate days remaining to deadline
  let deadlineText = 'No deadline';
  let isOverdue = false;
  if (deadlineDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      deadlineText = `${Math.abs(diffDays)}d overdue`;
      isOverdue = project.status !== 'COMPLETED';
    } else if (diffDays === 0) {
      deadlineText = 'Due today';
    } else if (diffDays === 1) {
      deadlineText = 'Due tomorrow';
    } else {
      deadlineText = `${diffDays} days left`;
    }
  }

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete project "${project.name}"? This cannot be undone.`)) {
      deleteProject.mutate(project.id);
    }
  };

  const currencySymbol = project.currency === 'USD' ? '$' : project.currency === 'EUR' ? '€' : project.currency === 'GBP' ? '£' : '₹';

  return (
    <>
      <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm hover:shadow-md hover:border-brand/30 dark:hover:border-brand/30 transition-all flex flex-col justify-between group">
        <div>
          {/* Top Row: Client & Prefix & Status */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-brand-light text-brand dark:bg-brand/10 dark:text-brand border border-brand/20">
                {project.prefix}
              </span>
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 truncate flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                {project.client?.name ?? 'Internal'}
              </span>
            </div>

            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0', statusConfig.className)}>
              {statusConfig.label}
            </span>
          </div>

          {/* Project Name */}
          <h3 className="text-base font-bold text-zinc-950 dark:text-white group-hover:text-brand transition-colors line-clamp-1 mb-1.5">
            {project.name}
          </h3>

          {/* Project Details / Scope */}
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
            {project.description || 'No detailed scope provided.'}
          </p>

          {/* Assignment & Deadline Cards */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-gray-50/70 dark:bg-surface-dark-2/60 border border-gray-100 dark:border-white/5 mb-4 text-xs">
            {/* Assigned Employee */}
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Assigned To
              </span>
              {project.assignedEmployee ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-brand-light text-brand dark:bg-brand/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {project.assignedEmployee.name.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {project.assignedEmployee.name}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 italic">
                  Unassigned
                </span>
              )}
            </div>

            {/* Deadline */}
            <div>
              <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Deadline
              </span>
              <div className="flex items-center gap-1.5">
                <Calendar className={cn('w-3.5 h-3.5 shrink-0', isOverdue ? 'text-status-absent' : 'text-zinc-500')} />
                <div className="min-w-0">
                  <p className={cn('text-xs font-bold truncate', isOverdue ? 'text-status-absent font-extrabold' : 'text-zinc-900 dark:text-zinc-100')}>
                    {deadlineDate ? formatDate(deadlineDate) : '—'}
                  </p>
                  {deadlineDate && (
                    <p className={cn('text-[10px] font-semibold', isOverdue ? 'text-status-absent' : 'text-zinc-500 dark:text-zinc-400')}>
                      {deadlineText}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar & Tasks */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                <CheckSquare className="w-3.5 h-3.5" /> Progress
              </span>
              <span className="text-zinc-950 dark:text-white font-bold">
                {project.percentDone ?? 0}% · {project._count?.tasks ?? 0} task{(project._count?.tasks ?? 0) === 1 ? '' : 's'}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, project.percentDone ?? 0))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Footer: Admin Project Amount & Actions */}
        <div className="pt-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-between gap-3">
          {/* CONFIDENTIAL PROJECT AMOUNT: ADMIN ACCESS ONLY */}
          {isAdmin && (
            <div className="flex items-center gap-1.5" title="Confidential project amount — only visible to Admins">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block leading-none">
                  Amount
                </span>
                <span className="text-sm font-extrabold text-zinc-950 dark:text-white">
                  {project.amount != null
                    ? `${currencySymbol}${project.amount.toLocaleString('en-IN')}`
                    : 'Not set'}
                </span>
              </div>
            </div>
          )}

          {!isAdmin && (
            <div className="text-xs text-zinc-500 font-medium">
              Client: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{project.client?.name}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-gray-300 dark:border-white/10 rounded-lg text-zinc-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              {isAdmin ? 'Edit' : 'Update'}
            </button>

            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={deleteProject.isPending}
                className="p-1.5 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                title="Delete project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <Link
              href={`/tasks?projectId=${project.id}`}
              className="p-1.5 text-zinc-500 hover:text-brand hover:bg-brand-light dark:hover:bg-brand/10 rounded-lg transition-colors"
              title="Open tasks"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {showEdit && (
        <EditProjectModal
          project={project}
          isAdmin={isAdmin}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
