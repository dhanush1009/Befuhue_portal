'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { salarySchema, type SalaryInput } from '@/lib/validations/payroll';
import { useEmployeeSalary, useSaveSalary } from '@/hooks/usePayroll';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { formatIndianCurrency } from '@/lib/payroll';

interface Props { employeeId: string; }

const EARNINGS: { key: keyof SalaryInput; label: string }[] = [
  { key: 'basic',            label: 'Basic Salary' },
  { key: 'hra',              label: 'House Rent Allowance' },
  { key: 'conveyance',       label: 'Conveyance' },
  { key: 'medicalAllowance', label: 'Medical Allowance' },
  { key: 'specialAllowance', label: 'Special Allowance' },
  { key: 'bonus',            label: 'Bonus' },
  { key: 'incentive',        label: 'Incentive' },
];

const DEDUCTIONS: { key: keyof SalaryInput; label: string }[] = [
  { key: 'incomeTax',       label: 'Income Tax' },
  { key: 'providentFund',   label: 'Provident Fund' },
  { key: 'esi',             label: 'ESI' },
  { key: 'professionalTax', label: 'Professional Tax' },
  { key: 'otherDeductions', label: 'Other Deductions' },
];

// ── Currency input ─────────────────────────────────────────────────────────────
// - While focused: shows raw digits the user is typing (no formatting interference)
// - On blur: formats with Indian locale commas
// - Never remounts (no key prop changes), so focus is never lost mid-type

interface CurrencyInputProps {
  label:    string;
  value:    number;
  onChange: (val: number) => void;
  error?:   string;
}

function CurrencyInput({ label, value, onChange, error }: CurrencyInputProps) {
  const [focused,      setFocused]      = useState(false);
  const [displayValue, setDisplayValue] = useState(value > 0 ? String(value) : '');

  // Sync displayValue when form resets (e.g. salary loads from API)
  // Only update when NOT focused so we don't interrupt typing
  useEffect(() => {
    if (!focused) {
      setDisplayValue(value > 0 ? value.toLocaleString('en-IN') : '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(true);
    // Show raw number when focused so user can freely edit
    const raw = value > 0 ? String(value) : '';
    setDisplayValue(raw);
    // Select all after paint so cursor lands at end naturally
    requestAnimationFrame(() => e.target.select());
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Only allow digits and a single decimal point
    const cleaned = raw.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*$/, '$1');
    setDisplayValue(cleaned);
    const num = parseFloat(cleaned);
    onChange(isNaN(num) ? 0 : num);
  }

  function handleBlur() {
    setFocused(false);
    // Format with commas on blur
    setDisplayValue(value > 0 ? value.toLocaleString('en-IN') : '');
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 mb-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-violet-300/45 text-sm pointer-events-none select-none">
          ₹
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          placeholder="0"
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-surface-dark-3 text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-violet-400/35 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors duration-150"
        />
      </div>
      {error && <p className="text-xs text-status-absent mt-0.5">{error}</p>}
    </div>
  );
}

// ── Field group ────────────────────────────────────────────────────────────────

function FieldGroup({
  fields, control, errors, total, totalLabel, totalColor, title,
}: {
  fields:      { key: keyof SalaryInput; label: string }[];
  control:     Control<SalaryInput>;
  errors:      FieldErrors<SalaryInput>;
  total:       number;
  totalLabel:  string;
  totalColor:  string;
  title:       string;
}) {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5">
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-4">
        {title}
      </p>
      <div className="space-y-3">
        {fields.map((f) => (
          <Controller
            key={f.key}
            name={f.key}
            control={control}
            render={({ field }) => (
              <CurrencyInput
                label={f.label}
                value={field.value as number}
                onChange={field.onChange}
                error={errors[f.key]?.message as string | undefined}
              />
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-violet-900/40">
        <span className="text-sm font-medium text-gray-700 dark:text-violet-200/70">{totalLabel}</span>
        <span className={`text-sm font-semibold ${totalColor}`}>{formatIndianCurrency(total)}</span>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function SalaryTab({ employeeId }: Props) {
  const { data: salary, isLoading } = useEmployeeSalary(employeeId);
  const { mutate: save, isPending } = useSaveSalary(employeeId);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<SalaryInput>({
    resolver:      zodResolver(salarySchema),
    defaultValues: {
      basic: 0, hra: 0, conveyance: 0, medicalAllowance: 0, specialAllowance: 0,
      bonus: 0, incentive: 0, incomeTax: 0, providentFund: 0, esi: 0,
      professionalTax: 0, otherDeductions: 0,
    },
  });

  useEffect(() => {
    if (salary) {
      reset({
        basic:            salary.basic,
        hra:              salary.hra,
        conveyance:       salary.conveyance,
        medicalAllowance: salary.medicalAllowance,
        specialAllowance: salary.specialAllowance,
        bonus:            salary.bonus,
        incentive:        salary.incentive,
        incomeTax:        salary.incomeTax,
        providentFund:    salary.providentFund,
        esi:              salary.esi,
        professionalTax:  salary.professionalTax,
        otherDeductions:  salary.otherDeductions,
      });
    }
  }, [salary, reset]);

  const values          = watch();
  const grossCTC        = EARNINGS.reduce((s, f)   => s + (Number(values[f.key]) || 0), 0);
  const totalDeductions = DEDUCTIONS.reduce((s, f)  => s + (Number(values[f.key]) || 0), 0);
  const netSalary       = grossCTC - totalDeductions;

  function onSubmit(data: SalaryInput) {
    save(data, {
      onSuccess: () => toast.success('Salary configuration saved. Will reflect from next payroll run.'),
    });
  }

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Salary Configuration</h3>
          {salary?.effectiveFrom && (
            <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-0.5">
              Effective from: {format(new Date(salary.effectiveFrom), 'dd MMM yyyy')}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FieldGroup
          title="Earnings"
          fields={EARNINGS}
          control={control}
          errors={errors}
          total={grossCTC}
          totalLabel="Gross CTC"
          totalColor="text-brand"
        />
        <FieldGroup
          title="Deductions"
          fields={DEDUCTIONS}
          control={control}
          errors={errors}
          total={totalDeductions}
          totalLabel="Total Deductions"
          totalColor="text-status-absent"
        />
      </div>

      {/* Net preview */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-surface-dark-3/50 border border-gray-200 dark:border-violet-900/40 rounded-xl px-5 py-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Estimated Net Salary</p>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
            Without LOP deductions. Actual varies by month.
          </p>
        </div>
        <p className="text-lg font-semibold text-green-700 dark:text-green-400">
          {formatIndianCurrency(netSalary)}
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-brand text-white hover:bg-brand-hover h-9 px-6 rounded-lg text-sm font-medium transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save Salary Configuration'}
      </button>
    </form>
  );
}
