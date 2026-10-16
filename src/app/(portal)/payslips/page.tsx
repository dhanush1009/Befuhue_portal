'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useMyPayslips, useDownloadPayslip } from '@/hooks/usePayroll';
import { PayslipViewer } from '@/components/payroll/PayslipViewer';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { formatIndianCurrency } from '@/lib/payroll';
import { MONTH_NAMES } from '@/lib/constants';
import type { Payslip } from '@/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

function GhostCard({ monthName, year }: { monthName: string; year: number }) {
  return (
    <div className="border-2 border-dashed border-gray-200 dark:border-violet-900/40 rounded-xl p-5 flex flex-col items-center justify-center text-center min-h-[140px]">
      <Calendar className="w-6 h-6 text-gray-300 dark:text-violet-400/35 mb-2" />
      <p className="text-sm font-medium text-gray-400 dark:text-violet-300/45">{monthName} {year}</p>
      <p className="text-xs text-gray-400 dark:text-violet-400/35 mt-0.5">Payslip not yet generated</p>
      <p className="text-xs text-gray-400 dark:text-violet-400/35">Contact HR</p>
    </div>
  );
}

function PayslipGridCard({ payslip, onView }: { payslip: Payslip; onView: (p: Payslip) => void }) {
  const { mutate: download, isPending: downloading } = useDownloadPayslip();

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 hover:border-violet-200 dark:hover:border-violet-700 transition-colors flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-brand" />
          </div>
          <span className="text-base font-semibold text-gray-900 dark:text-white">{payslip.payPeriod}</span>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border bg-status-present/10 text-status-present border-status-present/20">
          Published
        </span>
      </div>

      <div>
        <p className="text-xs text-gray-500 dark:text-violet-300/55 mb-0.5">Net Pay</p>
        <p className="text-2xl font-semibold text-gray-900 dark:text-white">
          {formatIndianCurrency(payslip.totalNetPay)}
        </p>
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 dark:border-violet-900/40">
        <p className="text-xs text-gray-500 dark:text-violet-300/55">
          Paid Days: <span className="font-medium text-gray-700 dark:text-violet-200/70">{payslip.paidDays}</span>
          {' '}|{' '}LOP: <span className={cn('font-medium', payslip.lopDays > 0 ? 'text-status-absent' : 'text-gray-700 dark:text-violet-200/70')}>{payslip.lopDays}</span>
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onView(payslip)}
            className="text-xs text-gray-500 hover:text-brand transition-colors px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3"
          >View</button>
          <button
            onClick={() => download(payslip)}
            disabled={downloading}
            className="flex items-center gap-1 text-xs font-medium text-brand border border-brand/30 hover:bg-brand/5 px-2.5 py-1 rounded-md transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            <Download className="w-3 h-3" /> {downloading ? '…' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PayslipsPage() {
  const { setPageTitle } = useUIStore();
  const { data: payslips, isLoading } = useMyPayslips();
  const [viewing, setViewing]           = useState<Payslip | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => { setPageTitle('Payslips'); }, [setPageTitle]);

  const now = new Date();
  const last12: { month: number; year: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last12.push({ month: d.getMonth() + 1, year: d.getFullYear(), label: MONTH_NAMES[d.getMonth()] });
  }

  const payslipMap = new Map<string, Payslip>(
    (payslips ?? []).map((p) => [`${p.month}-${p.year}`, p]),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="max-w-4xl mx-auto flex flex-col gap-6"
    >
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Payslips</h1>
        <p className="text-sm text-gray-500 dark:text-violet-300/55 mt-1">
          Download your monthly salary statements.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} className="h-36" />)}
        </div>
      ) : !payslips?.length ? (
        <>
          <EmptyState
            icon={<FileText className="w-10 h-10 text-gray-300" />}
            title="No payslips yet"
            description="Your payslips will appear here once HR publishes them."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {last12.map(({ month, year, label }) => (
              <GhostCard key={`${month}-${year}`} monthName={label} year={year} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {last12.map(({ month, year, label }) => {
              const payslip = payslipMap.get(`${month}-${year}`);
              return payslip
                ? <PayslipGridCard key={payslip.id} payslip={payslip} onView={setViewing} />
                : <GhostCard key={`${month}-${year}`} monthName={label} year={year} />;
            })}
          </div>
          {(payslips?.length ?? 0) > visibleCount && (
            <div className="text-center">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="px-5 h-9 rounded-lg text-sm font-medium text-gray-600 dark:text-violet-200/70 border border-gray-200 dark:border-violet-900/40 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}

      {viewing && <PayslipViewer payslip={viewing} onClose={() => setViewing(null)} />}
    </motion.div>
  );
}
