'use client';

import Link from 'next/link';
import { FolderKanban, CheckCircle2, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import type { AgencyProjectSummary } from '@/types';

interface ProjectCardProps {
  agencyId: string;
  project: AgencyProjectSummary;
}

export function ProjectCard({ agencyId, project }: ProjectCardProps) {
  const completionRate =
    project.totalTasks > 0
      ? Math.round((project.completedTasks / project.totalTasks) * 100)
      : 0;

  return (
    <div className="group relative bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-5 shadow-xs hover:shadow-md hover:border-brand/40 dark:hover:border-brand/40 transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Header: Project Name & Client Name */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-xs">
              <FolderKanban className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-brand transition-colors">
                {project.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-medium text-gray-400 dark:text-zinc-500">
                  [{project.prefix}]
                </span>
                {project.clientName && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-zinc-300 truncate">
                    <UserCheck className="size-3 text-brand" />
                    {project.clientName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shrink-0 border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
            {project.status}
          </span>
        </div>

        {/* Task Metrics */}
        <div className="grid grid-cols-2 gap-2.5 p-3 bg-gray-50/80 dark:bg-surface-dark-3/60 rounded-xl border border-gray-100 dark:border-white/5 mb-4">
          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Total Tasks
            </p>
            <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
              {project.totalTasks}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-500" /> Completed
            </p>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {project.completedTasks}
              <span className="text-xs font-normal text-gray-400 dark:text-zinc-500 ml-1.5">
                ({completionRate}%)
              </span>
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-zinc-400">Completion Progress</span>
            <span className="font-semibold text-gray-900 dark:text-white">{completionRate}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-surface-dark-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Total Project Billing Amount */}
        <div className="p-3 bg-brand/5 dark:bg-brand/10 border border-brand/20 rounded-xl mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand dark:text-brand-light">
              Total Project Billing
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              <ShieldCheck className="size-3" /> Admin Only
            </span>
          </div>
          <p className="text-xl font-black text-brand dark:text-white tracking-tight">
            ₹{project.totalBilling.toLocaleString('en-IN')}
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 ml-1.5 uppercase">
              {project.currency}
            </span>
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
        <Link
          href={`/billing/${agencyId}/project/${project.id}`}
          className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-xs transition-all duration-150 active:scale-[0.99] cursor-pointer"
        >
          <span>View Billing Details</span>
          <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
