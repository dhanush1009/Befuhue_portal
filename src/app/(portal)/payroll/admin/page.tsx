'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Send, Ban, Download, Eye, IndianRupee, Users, TrendingDown, TrendingUp, CheckCircle, CalendarPlus } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useAuth } from '@/hooks/useAuth';
import { useEmployees } from '@/hooks/useEmployees';
import {
  useAllPayslips,
  usePayrollSummary,
  useCalculatePayroll,
  usePublishBulk,
  usePublishPayslip,
  useVoidPayslip,
  useDownloadPayslip,
} from '@/hooks/usePayroll';
import { SalaryCalculationModal } from '@/components/payroll/SalaryCalculationModal';
import { PayslipViewer } from '@/components/payroll/PayslipViewer';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { UserAvatar } from '@/components/shared/UserAvatar';
import type { Employee, Payslip } from '@/types';
import { MONTH_NAMES } from '@/lib/constants';
import { formatIndianCurrency } from '@/lib/payroll';
import { cn } from '@/lib/utils';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';

const now   = new Date();
const YEARS = Array.from({ length: 7 }, (_, i) => 2024 + i);

interface PayrollSummaryRow {
  id:              string;
  userId:          string;  // the employee's User.id — used to match against employees list
  employeeId:      string;
  employeeName:    string;
  designation:     string;
  department:      string;
  workingDays:     number;
  paidDays:        number;
  lopDays:         number;
  grossEarnings:   number;
  totalDeductions: number;
  totalNetPay:     number;
  status:          string;
  publishedAt:     string | null;
}

export default function AdminPayrollPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { setPageTitle } = useUIStore();

  const [tab,         setTab]         = useState<'run' | 'history'>('run');
  const [month,       setMonth]       = useState(now.getMonth() + 1);
  const [year,        setYear]        = useState(now.getFullYear());
  const [calcEmp,     setCalcEmp]     = useState<Pick<Employee, 'id' | 'name' | 'designation'> | null>(null);
  const [viewPayslip,  setViewPayslip]  = useState<{ id: string } | Payslip | null>(null);
  const [voidTarget,   setVoidTarget]   = useState<Payslip | null>(null);
  const [showCreditEL,  setShowCreditEL]  = useState(false);
  const [creditingEL,   setCreditingEL]   = useState(false);
  // History filters
  const [hMonth,      setHMonth]      = useState<number | undefined>(undefined);
  const [hYear,       setHYear]       = useState(now.getFullYear());

  useEffect(() => { setPageTitle('Payroll'); }, [setPageTitle]);

  const { data: empData,   isLoading: empLoading }     = useEmployees();
  const { data: summary,   isLoading: summaryLoading } = usePayrollSummary(month, year);
  const { data: history,   isLoading: histLoading }    = useAllPayslips(hMonth, hYear);

  const { mutate: calcAll,   isPending: calcingAll }  = useCalculatePayroll();
  const { mutate: pubAll,    isPending: pubingAll }   = usePublishBulk();
  const { mutate: pubOne }                             = usePublishPayslip();
  const { mutate: voidOne,   isPending: voiding }     = useVoidPayslip();
  const { mutate: download }                           = useDownloadPayslip();

  if (!authLoading && !isAdmin) redirect('/dashboard');

  async function handleCreditEL() {
    setCreditingEL(true);
    try {
      const res  = await fetch('/api/admin/payroll/credit-earned-leave', { method: 'POST' });
      const json = await res.json() as { data: { credited: number; message: string } };
      if (res.ok) { toast.success(json.data.message); }
      else        { toast.error('Failed to credit earned leave'); }
    } catch { toast.error('Failed to credit earned leave'); }
    finally   { setCreditingEL(false); setShowCreditEL(false); }
  }

  const employees: Employee[] = empData?.data ?? [];

  // Build a map: userId → summary row for O(1) lookup per employee row
  const summaryMap = new Map<string, PayrollSummaryRow>(
    ((summary as PayrollSummaryRow[] | undefined) ?? []).map((r) => [r.userId, r]),
  );

  // Summary strip totals
  const rows     = (summary as PayrollSummaryRow[] | undefined) ?? [];
  const totalGross      = rows.reduce((s, r) => s + r.grossEarnings,   0);
  const totalDeductions = rows.reduce((s, r) => s + r.totalDeductions, 0);
  const totalNet        = rows.reduce((s, r) => s + r.totalNetPay,     0);
  const publishedCount  = rows.filter((r) => r.status === 'PUBLISHED').length;
  const allCalculated   = employees.length > 0 && rows.length >= employees.length;

  const selectClass = 'text-sm border border-gray-200 dark:border-violet-900/40 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand dark:bg-surface-dark-3 dark:text-white';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="max-w-screen-xl mx-auto flex flex-col gap-5"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Payroll</h1>
          <p className="text-sm text-gray-500 dark:text-violet-300/55 mt-1">Run payroll, configure salaries, and publish payslips.</p>
        </div>
        <button
          onClick={() => setShowCreditEL(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-gray-600 dark:text-violet-200/70 border border-gray-200 dark:border-violet-900/40 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]"
        >
          <CalendarPlus className="w-4 h-4" /> Credit Monthly EL
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 dark:bg-surface-dark-3 p-1 rounded-lg w-fit">
        {([['run', 'Run Payroll'], ['history', 'Payslip History']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-150',
              tab === t ? 'bg-white dark:bg-surface-dark-3 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-violet-200/70',
            )}
          >{label}</button>
        ))}
      </div>

      {/* ══ RUN PAYROLL TAB ══ */}
      {tab === 'run' && (
        <div className="flex flex-col gap-5">
          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectClass}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectClass}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="flex-1" />
            <button
              onClick={() => calcAll({ month, year })}
              disabled={calcingAll}
              className="flex items-center gap-2 bg-brand text-white hover:bg-brand-hover h-9 px-4 rounded-lg text-sm font-medium transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              <Play className="w-4 h-4" /> {calcingAll ? 'Calculating…' : 'Calculate All'}
            </button>
            <button
              onClick={() => pubAll({ month, year })}
              disabled={pubingAll || !allCalculated}
              className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 h-9 px-4 rounded-lg text-sm font-medium transition-colors duration-150 active:scale-[0.98] disabled:opacity-40"
            >
              <Send className="w-4 h-4" /> {pubingAll ? 'Publishing…' : 'Publish All'}
            </button>
          </div>

          {/* Summary strip */}
          {rows.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { icon: Users,        label: 'Total Employees',  value: String(employees.length),                color: 'text-brand' },
                { icon: TrendingUp,   label: 'Total Gross',      value: formatIndianCurrency(totalGross),        color: 'text-status-present' },
                { icon: TrendingDown, label: 'Total Deductions', value: formatIndianCurrency(totalDeductions),   color: 'text-status-absent' },
                { icon: IndianRupee,  label: 'Total Net Pay',    value: formatIndianCurrency(totalNet),          color: 'text-brand' },
                { icon: CheckCircle,  label: 'Published',        value: `${publishedCount} / ${rows.length}`,   color: 'text-status-present' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn('w-4 h-4', color)} />
                    <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">{label}</p>
                  </div>
                  <p className={cn('text-base font-semibold', color)}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Employee table */}
          <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-surface-dark-3/50 border-b border-gray-200 dark:border-violet-900/40">
                    {['Employee', 'Designation', 'Working Days', 'Leaves', 'LOP Days', 'Paid Days', 'Gross', 'Deductions', 'Net Pay', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-violet-900/25">
                  {empLoading || summaryLoading ? (
                    <tr><td colSpan={11}><div className="p-4"><SkeletonTable rows={5} /></div></td></tr>
                  ) : employees.length === 0 ? (
                    <tr><td colSpan={11}>
                      <EmptyState icon={<Users className="w-10 h-10 text-gray-300" />} title="No employees" description="Onboard employees first." />
                    </td></tr>
                  ) : employees.map((emp) => {
                    const row = summaryMap.get(emp.id);
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-3/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={emp.name} avatarUrl={emp.avatarUrl} size="sm" />
                            <span className="font-medium text-gray-900 dark:text-white truncate max-w-[120px]">{emp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-violet-300/55 whitespace-nowrap">{emp.designation ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-violet-200/70">{row?.workingDays ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-violet-200/70">{row ? row.workingDays - row.paidDays : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {row
                            ? <span className={cn('font-medium', row.lopDays > 0 ? 'text-status-absent' : 'text-gray-700 dark:text-violet-200/70')}>{row.lopDays}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 dark:text-violet-200/70">{row?.paidDays ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-violet-200/70 whitespace-nowrap">{row ? formatIndianCurrency(row.grossEarnings) : '—'}</td>
                        <td className="px-4 py-3 text-right text-status-absent whitespace-nowrap">{row ? formatIndianCurrency(row.totalDeductions) : '—'}</td>
                        <td className="px-4 py-3 text-right text-status-present font-medium whitespace-nowrap">{row ? formatIndianCurrency(row.totalNetPay) : '—'}</td>
                        <td className="px-4 py-3">
                          {row
                            ? <StatusBadge status={row.status.toLowerCase() as 'draft' | 'published' | 'void'} />
                            : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border bg-slate-100 text-slate-500 border-slate-200">Not Calculated</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setCalcEmp({ id: emp.id, name: emp.name, designation: emp.designation })}
                              className="px-2.5 py-1 rounded-md text-xs font-medium text-brand border border-brand/30 hover:bg-brand/5 transition-colors"
                            >Calculate</button>
                            {row && row.status !== 'VOID' && (
                              <>
                                {row.status === 'DRAFT' && (
                                  <button
                                    onClick={() => pubOne(row.id)}
                                    className="px-2.5 py-1 rounded-md text-xs font-medium text-green-700 border border-green-300 hover:bg-green-50 transition-colors"
                                  >Publish</button>
                                )}
                                <button
                                  onClick={() => setViewPayslip({ id: row.id })}
                                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
                                  title="View"
                                ><Eye className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={() => download({ id: row.id, employeeId: row.employeeId, month, year, payPeriod: `${MONTH_NAMES[month-1]} ${year}` })}
                                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
                                  title="Download PDF"
                                ><Download className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ PAYSLIP HISTORY TAB ══ */}
      {tab === 'history' && (
        <div className="flex flex-col gap-5">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={hMonth ?? ''} onChange={(e) => setHMonth(e.target.value ? Number(e.target.value) : undefined)} className={selectClass}>
              <option value="">All Months</option>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={hYear} onChange={(e) => setHYear(Number(e.target.value))} className={selectClass}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-surface-dark-3/50 border-b border-gray-200 dark:border-violet-900/40">
                    {['Employee', 'Pay Period', 'Gross', 'Net Pay', 'LOP Days', 'Status', 'Published Date', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-violet-900/25">
                  {histLoading ? (
                    <tr><td colSpan={8}><div className="p-4"><SkeletonTable rows={5} /></div></td></tr>
                  ) : !history?.length ? (
                    <tr><td colSpan={8}>
                      <EmptyState icon={<IndianRupee className="w-10 h-10 text-gray-300" />} title="No payslips found" description="Run payroll to generate payslips." />
                    </td></tr>
                  ) : (history as Payslip[]).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-3/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{p.employeeName}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-violet-300/55">{p.payPeriod}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-violet-200/70 whitespace-nowrap">{formatIndianCurrency(p.grossEarnings)}</td>
                      <td className="px-4 py-3 text-right text-status-present font-medium whitespace-nowrap">{formatIndianCurrency(p.totalNetPay)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(p.lopDays > 0 ? 'text-status-absent font-medium' : 'text-gray-500')}>{p.lopDays}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={p.status.toLowerCase() as 'draft' | 'published' | 'void'} /></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-violet-300/55 whitespace-nowrap">
                        {p.publishedAt ? format(new Date(p.publishedAt), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setViewPayslip(p)} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => download(p)} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors" title="Download PDF"><Download className="w-3.5 h-3.5" /></button>
                          {p.status !== 'VOID' && (
                            <button onClick={() => setVoidTarget(p)} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-status-absent border border-red-200 hover:bg-red-50 transition-colors">
                              <Ban className="w-3 h-3" /> Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {calcEmp && (
        <SalaryCalculationModal
          employee={calcEmp}
          month={month}
          year={year}
          onClose={() => setCalcEmp(null)}
        />
      )}

      {viewPayslip && <PayslipViewer payslip={viewPayslip} onClose={() => setViewPayslip(null)} />}

      <ConfirmDialog
        open={!!voidTarget}
        title="Void this payslip?"
        description={`This will mark ${voidTarget?.employeeName}'s payslip for ${voidTarget?.payPeriod} as VOID. This cannot be undone.`}
        confirmLabel={voiding ? 'Voiding…' : 'Yes, Void'}
        destructive
        onConfirm={() => { if (voidTarget) voidOne(voidTarget.id, { onSuccess: () => setVoidTarget(null) }); }}
        onCancel={() => setVoidTarget(null)}
      />

      <ConfirmDialog
        open={showCreditEL}
        title="Credit Monthly Earned Leave?"
        description={`Credit 1 earned leave to all ${employees.length} active employees for ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}?`}
        confirmLabel={creditingEL ? 'Crediting…' : 'Yes, Credit EL'}
        onConfirm={handleCreditEL}
        onCancel={() => setShowCreditEL(false)}
      />
    </motion.div>
  );
}
