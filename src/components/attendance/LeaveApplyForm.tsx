'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { cn, calculateWorkingDays } from '@/lib/utils';
import { LEAVE_TYPES } from '@/lib/constants';
import { useApplyLeave, useLeaveBalance } from '@/hooks/useLeaves';
import { useHolidays } from '@/hooks/useHolidays';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  leaveType: z.enum(['EARNED', 'SICK', 'CASUAL', 'LOP', 'COMP_OFF', 'MATERNITY', 'PATERNITY']),
  fromDate:  z.string().min(1, 'Start date is required'),
  toDate:    z.string().min(1, 'End date is required'),
  reason:    z.string().min(10, 'Reason must be at least 10 characters'),
}).refine((d) => new Date(d.fromDate) <= new Date(d.toDate), {
  message: 'End date must be on or after start date',
  path:    ['toDate'],
});

type FormValues = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

interface LeaveApplyFormProps {
  onSuccess?: () => void;
}

export function LeaveApplyForm({ onSuccess }: LeaveApplyFormProps) {
  const applyMutation = useApplyLeave();
  const { data: balances = [] } = useLeaveBalance();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { leaveType: 'EARNED', fromDate: '', toDate: '', reason: '' },
  });

  const selectedType = watch('leaveType');
  const fromDate     = watch('fromDate');
  const toDate       = watch('toDate');

  // Company holidays inside the range aren't leave days (the server applies the same rule).
  const holidaysFrom = useHolidays(fromDate ? Number(fromDate.slice(0, 4)) : new Date().getFullYear()).data?.holidays ?? [];
  const holidaysTo   = useHolidays(toDate   ? Number(toDate.slice(0, 4))   : new Date().getFullYear()).data?.holidays ?? [];
  const holidayKeys  = new Set([...holidaysFrom, ...holidaysTo].map((h) => h.date));

  const rangeValid  = !!fromDate && !!toDate && new Date(fromDate) <= new Date(toDate);
  const workingDays = rangeValid ? calculateWorkingDays(new Date(fromDate), new Date(toDate), holidayKeys) : 0;
  const withoutHolidays = rangeValid ? calculateWorkingDays(new Date(fromDate), new Date(toDate)) : 0;
  const holidaysInRange = withoutHolidays - workingDays;

  const selectedBalance = balances.find((b) => b.type === selectedType);

  const onSubmit = async (data: FormValues) => {
    await applyMutation.mutateAsync({
      leaveType:   data.leaveType,
      fromDate:    data.fromDate,
      toDate:      data.toDate,
      reason:      data.reason,
    });
    reset();
    onSuccess?.();
  };

  const fieldClass = (hasError: boolean) => cn(
    'w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-surface-dark-2 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150',
    hasError
      ? 'border-status-absent focus:ring-status-absent/30'
      : 'border-gray-200 dark:border-violet-900/40 text-gray-900 dark:text-white',
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">

      {/* Leave type */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
          Leave Type
        </label>
        <select {...register('leaveType')} className={fieldClass(!!errors.leaveType)}>
          {LEAVE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {selectedBalance && (
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">
            {selectedBalance.remaining} days remaining of {selectedBalance.allowance}
          </p>
        )}
        {errors.leaveType && <p className="text-xs text-status-absent mt-1">{errors.leaveType.message}</p>}
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
            From Date
          </label>
          <input
            type="date"
            {...register('fromDate')}
            className={cn(fieldClass(!!errors.fromDate), 'dark:[color-scheme:dark]')}
          />
          {errors.fromDate && <p className="text-xs text-status-absent mt-1">{errors.fromDate.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
            To Date
          </label>
          <input
            type="date"
            {...register('toDate')}
            className={cn(fieldClass(!!errors.toDate), 'dark:[color-scheme:dark]')}
          />
          {errors.toDate && <p className="text-xs text-status-absent mt-1">{errors.toDate.message}</p>}
        </div>
      </div>

      {/* Working days indicator */}
      {(workingDays > 0 || holidaysInRange > 0) && (
        <p className="text-xs font-medium text-brand bg-brand/5 px-3 py-2 rounded-lg">
          {workingDays} working day{workingDays !== 1 ? 's' : ''}
          {holidaysInRange > 0 && (
            <span className="font-normal text-gray-500 dark:text-violet-300/55">
              {' '}· {holidaysInRange} company holiday{holidaysInRange !== 1 ? 's' : ''} in this range {holidaysInRange !== 1 ? 'are' : 'is'} not counted
            </span>
          )}
        </p>
      )}

      {/* Reason */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5">
          Reason
        </label>
        <textarea
          {...register('reason')}
          rows={4}
          placeholder="Please provide details for your leave request..."
          className={cn(fieldClass(!!errors.reason), 'resize-none')}
        />
        {errors.reason && <p className="text-xs text-status-absent mt-1">{errors.reason.message}</p>}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-violet-200/70 bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={isSubmitting || applyMutation.isPending}
          className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 shadow-sm"
        >
          {(isSubmitting || applyMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit Request
        </button>
      </div>
    </form>
  );
}
