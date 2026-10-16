'use client';

import Link from 'next/link';
import { Briefcase, Building2, ArrowRight, FolderKanban, CheckSquare, ShieldCheck } from 'lucide-react';
import type { AgencyBillingSummary } from '@/types';

interface AgencyCardProps {
  item: AgencyBillingSummary;
}

export function AgencyCard({ item }: AgencyCardProps) {
  const isClient = item.clientType === 'CLIENT';

  return (
    <div className="group relative bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-6 shadow-xs hover:shadow-md hover:border-brand/40 dark:hover:border-brand/40 transition-all duration-200 flex flex-col justify-between">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`size-12 rounded-xl flex items-center justify-center font-bold text-base shrink-0 border shadow-xs ${
              isClient
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                : 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light border-brand/20'
            }`}>
              {item.logoUrl ? (
                <img src={item.logoUrl} alt={item.name} className="size-full rounded-xl object-contain p-1" />
              ) : isClient ? (
                <Building2 className="size-6 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Briefcase className="size-6 text-brand" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate group-hover:text-brand transition-colors">
                {item.name}
              </h3>
              <p className="text-xs font-mono text-gray-500 dark:text-zinc-400 truncate mt-0.5">
                Ref: {item.billingReference || (isClient ? `CLI-${item.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-REF` : `AGY-${item.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-REF`)}
              </p>
            </div>
          </div>

          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase shrink-0 border ${
            isClient
              ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20'
              : 'bg-brand/10 text-brand border-brand/20'
          }`}>
            {isClient ? 'Client' : 'Agency'}
          </span>
        </div>

        {/* Aggregate Metrics (Projects & Tasks) */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50/80 dark:bg-surface-dark-3/60 rounded-xl border border-gray-100 dark:border-white/5 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FolderKanban className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Projects
              </p>
              <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                {item.totalProjects}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckSquare className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Total Tasks
              </p>
              <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                {item.totalTasks}
              </p>
            </div>
          </div>
        </div>

        {/* Total Billing Amount Card */}
        <div className="p-4 bg-brand/5 dark:bg-brand/10 border border-brand/20 rounded-xl mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand dark:text-brand-light">
              {isClient ? 'Total Client Billing' : 'Total Agency Billing'}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              <ShieldCheck className="size-3" /> Confidential
            </span>
          </div>
          <p className="text-2xl font-black text-brand dark:text-white tracking-tight">
            ₹{item.totalBilling.toLocaleString('en-IN')}
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 ml-1.5 uppercase">
              {item.currency}
            </span>
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
        <Link
          href={`/billing/${item.id}`}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-xs transition-all duration-150 active:scale-[0.99] cursor-pointer"
        >
          <span>View Projects</span>
          <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
