'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Briefcase, CheckCircle2, Clock, Receipt, ArrowRight, ShieldCheck, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientBillingSummary } from '@/types';
import { downloadBillingExcel } from '@/hooks/useBilling';

interface BillingCardProps {
  item: ClientBillingSummary;
}

export function BillingCard({ item }: BillingCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const isAgency = item.clientType === 'AGENCY';
  const completionRate = item.totalTasks > 0 ? Math.round((item.completedTasks / item.totalTasks) * 100) : 0;

  const handleExport = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExporting(true);
    try {
      downloadBillingExcel(item.id, item.name);
    } finally {
      setTimeout(() => setIsExporting(false), 800);
    }
  };

  return (
    <div className="group relative bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200 dark:border-violet-900/40 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      {/* Top section */}
      <div>
        {/* Header: Name, Type Badge, and Reference */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'size-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs border',
              isAgency
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : 'bg-brand/10 text-brand border-brand/20',
            )}>
              {item.logoUrl ? (
                <img src={item.logoUrl} alt={item.name} className="size-full rounded-xl object-contain p-1" />
              ) : isAgency ? (
                <Briefcase className="size-5" />
              ) : (
                <Building2 className="size-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                  {item.name}
                </h3>
              </div>
              <p className="text-xs font-mono text-gray-500 dark:text-violet-300/60 truncate mt-0.5">
                Ref: {item.billingReference ?? 'N/A'}
              </p>
            </div>
          </div>

          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shrink-0 border',
            isAgency
              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
              : 'bg-brand/10 text-brand border-brand/20',
          )}>
            {item.clientType}
          </span>
        </div>

        {/* Task Metrics */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-surface-dark-3/60 rounded-xl border border-gray-100 dark:border-white/5 mb-4">
          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-violet-300/60 uppercase tracking-wider">
              Total Tasks
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
              {item.totalTasks}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-violet-300/60 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="size-3 text-status-present" /> Completed
            </p>
            <p className="text-lg font-bold text-status-present mt-0.5">
              {item.completedTasks}
              <span className="text-xs font-normal text-gray-400 dark:text-violet-300/40 ml-1.5">
                ({completionRate}%)
              </span>
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-violet-300/60">Task Completion</span>
            <span className="font-semibold text-gray-900 dark:text-white">{completionRate}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-surface-dark-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-status-present rounded-full transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Total Billing Amount */}
        <div className="p-3 bg-brand/5 dark:bg-brand/10 border border-brand/20 rounded-xl mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand">
              Total Billing Amount
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              <ShieldCheck className="size-3" /> Admin Private
            </span>
          </div>
          <p className="text-2xl font-black text-brand tracking-tight">
            ₹{item.totalBilling.toLocaleString('en-IN')}
            <span className="text-xs font-medium text-gray-500 dark:text-violet-300/50 ml-1.5 uppercase">
              {item.currency}
            </span>
          </p>
        </div>
      </div>

      {/* Bottom Bar: Billing Button on the Bottom-Left */}
      <div className="pt-3 border-t border-gray-100 dark:border-violet-900/30 flex items-center justify-between gap-2">
        <Link
          href={`/billing/${item.id}`}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-xs transition-all duration-150 active:scale-[0.98]"
        >
          <Receipt className="size-3.5" />
          <span>Billing</span>
          <ArrowRight className="size-3.5" />
        </Link>

        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          title="Export to Excel (.xlsx)"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 dark:text-violet-200/80 bg-gray-100 hover:bg-gray-200 dark:bg-surface-dark-3 dark:hover:bg-surface-dark-3/80 disabled:opacity-60 rounded-xl border border-gray-200/80 dark:border-white/10 transition-colors cursor-pointer"
        >
          {isExporting ? <Loader2 className="size-3.5 text-gray-500 animate-spin" /> : <Download className="size-3.5 text-gray-500" />}
          <span className="hidden sm:inline">Excel (.xlsx)</span>
        </button>
      </div>
    </div>
  );
}
