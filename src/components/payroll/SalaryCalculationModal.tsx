'use client';

import { useEffect } from 'react';
import { X, RefreshCw, Save, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatIndianCurrency } from '@/lib/payroll';
import { usePayrollPreview, useCalculatePayroll, usePublishBulk, type PayrollPreviewResult } from '@/hooks/usePayroll';
import type { Employee } from '@/types';
import { MONTH_NAMES } from '@/lib/constants';

interface Props {
  employee: Pick<Employee, 'id' | 'name' | 'designation'>;
  month:    number;
  year:     number;
  onClose:  () => void;
}

function StatBox({ label, value, highlight }: { label: string; value: string | number; highlight?: 'red' | 'green' }) {
  return (
    <div className="bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg p-3 text-center">
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn(
        'text-lg font-semibold',
        highlight === 'red'   ? 'text-status-absent' :
        highlight === 'green' ? 'text-status-present' :
        'text-gray-900 dark:text-white',
      )}>{value}</p>
    </div>
  );
}

function EarningRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 dark:border-violet-900/40">
      <span className="text-sm text-gray-700 dark:text-violet-200/70">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white font-medium">{formatIndianCurrency(amount)}</span>
    </div>
  );
}

function DeductionRow({ label, amount, highlight, sub }: { label: string; amount: number; highlight?: boolean; sub?: string }) {
  return (
    <div className={cn('py-2 border-b border-gray-50 dark:border-violet-900/40', highlight && amount > 0 && 'bg-red-50/50 dark:bg-red-950/20 -mx-3 px-3 rounded')}>
      <div className="flex justify-between">
        <span className={cn('text-sm', highlight && amount > 0 ? 'text-status-absent font-medium' : 'text-gray-700 dark:text-violet-200/70')}>{label}</span>
        <span className={cn('text-sm font-medium', highlight && amount > 0 ? 'text-status-absent' : 'text-gray-900 dark:text-white')}>{formatIndianCurrency(amount)}</span>
      </div>
      {sub && amount > 0 && (
        <p className="text-xs text-status-absent/70 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

export function SalaryCalculationModal({ employee, month, year, onClose }: Props) {
  const { mutate: preview, data, isPending, error } = usePayrollPreview();
  const { mutate: calculate, isPending: saving }     = useCalculatePayroll();
  const { mutate: publishAll, isPending: publishing } = usePublishBulk();

  useEffect(() => {
    preview({ employeeId: employee.id, month, year });
  }, [employee.id, month, year, preview]);

  const result: PayrollPreviewResult | undefined = data;
  const payPeriod = `${MONTH_NAMES[month - 1]} ${year}`;

  const lopSub = result
    ? `(${formatIndianCurrency(result.salary.basic)} ÷ ${result.workingDays} days × ${result.lopDays} LOP days = ${formatIndianCurrency(result.lopDeduction)})`
    : '';

  function handleSaveDraft() {
    calculate({ month, year, employeeId: employee.id });
  }

  function handlePublish() {
    calculate(
      { month, year, employeeId: employee.id },
      { onSuccess: () => publishAll({ month, year, employeeIds: [employee.id] }, { onSuccess: onClose }) },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-surface-dark-2 rounded-xl border border-gray-200 dark:border-violet-900/40 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Salary Calculation — {employee.name}
            </h2>
            <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-0.5">
              {employee.designation ? `${employee.designation} · ` : ''}{payPeriod}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 text-gray-400 transition-colors duration-150">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">
          {isPending && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4 text-sm text-status-absent">
              {(error as Error).message}
            </div>
          )}

          {result && (
            <>
              {/* Section 1 — Attendance Summary */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-3">
                  Attendance Summary
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  <StatBox label="Total Days"   value={result.totalDays} />
                  <StatBox label="Sundays"      value={result.sundays} />
                  <StatBox label="Working Days" value={result.workingDays} />
                  <StatBox label="Leaves Taken" value={result.leaveTakenDays} />
                  <StatBox label="EL Available" value={result.earnedLeaveAvailable} />
                  <StatBox label="EL Used"      value={result.earnedLeaveUsed} />
                  <StatBox label="LOP Days"     value={result.lopDays}  highlight={result.lopDays > 0 ? 'red' : undefined} />
                  <StatBox label="Paid Days"    value={result.paidDays} highlight="green" />
                </div>
              </div>

              {/* Section 2 — Earnings + Deductions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-3">Earnings</p>
                  <div className="bg-white dark:bg-surface-dark-3 rounded-lg border border-gray-200 dark:border-violet-900/40 px-4 py-1">
                    <EarningRow label="Basic"                amount={result.basic} />
                    <EarningRow label="House Rent Allowance" amount={result.hra} />
                    <EarningRow label="Conveyance"           amount={result.conveyance} />
                    <EarningRow label="Medical Allowance"    amount={result.medicalAllowance} />
                    <EarningRow label="Special Allowance"    amount={result.specialAllowance} />
                    <EarningRow label="Bonus"                amount={result.bonus} />
                    <EarningRow label="Incentive"            amount={result.incentive} />
                    <div className="flex justify-between py-2 font-medium">
                      <span className="text-sm text-gray-900 dark:text-white">Gross Earnings</span>
                      <span className="text-sm text-gray-900 dark:text-white">{formatIndianCurrency(result.grossEarnings)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-3">Deductions</p>
                  <div className="bg-white dark:bg-surface-dark-3 rounded-lg border border-gray-200 dark:border-violet-900/40 px-4 py-1">
                    <DeductionRow label="Income Tax"       amount={result.incomeTax} />
                    <DeductionRow label="Provident Fund"   amount={result.providentFund} />
                    <DeductionRow label="ESI"              amount={result.esi} />
                    <DeductionRow label="Professional Tax" amount={result.professionalTax} />
                    <DeductionRow label="Other Deductions" amount={result.otherDeductions} />
                    <DeductionRow
                      label="LOP Deduction"
                      amount={result.lopDeduction}
                      highlight
                      sub={result.lopDays > 0 ? lopSub : undefined}
                    />
                    <div className="flex justify-between py-2 font-medium">
                      <span className="text-sm text-status-absent">Total Deductions</span>
                      <span className="text-sm text-status-absent">{formatIndianCurrency(result.totalDeductions)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3 — Net Pay */}
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Gross Earnings</p>
                    <p className="text-sm font-medium text-gray-700 dark:text-violet-200/70 mt-0.5">{formatIndianCurrency(result.grossEarnings)}</p>
                  </div>
                  <span className="text-gray-300 text-xl">−</span>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Total Deductions</p>
                    <p className="text-sm font-medium text-status-absent mt-0.5">{formatIndianCurrency(result.totalDeductions)}</p>
                  </div>
                  <span className="text-gray-300 text-xl">=</span>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Net Pay</p>
                    <p className="text-2xl font-semibold text-green-700 dark:text-green-400 mt-0.5">
                      {formatIndianCurrency(result.totalNetPay)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-violet-300/55 pt-3 border-t border-green-200 dark:border-green-900">
                  Amount In Words: <span className="font-medium text-gray-700 dark:text-violet-200/70">{result.amountInWords}</span>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0 flex-wrap">
          <button
            onClick={() => preview({ employeeId: employee.id, month, year })}
            disabled={isPending}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-medium text-gray-600 dark:text-violet-200/70 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98] border border-gray-200 dark:border-violet-900/40"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Recalculate
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={!result || saving}
              className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-medium text-brand border border-brand hover:bg-brand/5 transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save as Draft'}
            </button>
            <button
              onClick={handlePublish}
              disabled={!result || publishing || saving}
              className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> {publishing ? 'Publishing…' : 'Generate & Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
