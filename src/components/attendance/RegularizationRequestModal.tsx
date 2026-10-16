'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  format, subDays, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday,
} from 'date-fns';
import { X, Clock, AlertTriangle, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSubmitRegularization } from '@/hooks/useRegularizations';

// Defined locally until `prisma generate` runs after migration
type RegularizationType = 'FORGOT_CLOCK_IN' | 'FORGOT_CLOCK_OUT' | 'WRONG_TIME' | 'SYSTEM_ERROR' | 'ON_FIELD_WORK' | 'OTHER';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  date:               z.string().min(1, 'Date is required'),
  regularizationType: z.enum(['FORGOT_CLOCK_IN','FORGOT_CLOCK_OUT','WRONG_TIME','SYSTEM_ERROR','ON_FIELD_WORK','OTHER']),
  clockInTime:        z.string().min(1, 'Clock in time is required'),
  clockOutTime:       z.string().optional(),
  reason:             z.string().min(10, 'Min 10 characters').max(300, 'Max 300 characters'),
}).refine((d) => {
  if (d.clockOutTime && d.clockInTime) {
    return d.clockOutTime > d.clockInTime;
  }
  return true;
}, { message: 'Clock out must be after clock in', path: ['clockOutTime'] });

type FormValues = z.infer<typeof schema>;

// ── Type options ──────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: RegularizationType; label: string; desc: string }[] = [
  { value: 'FORGOT_CLOCK_IN',  label: 'Forgot to Clock In',    desc: 'I was present but forgot to punch in' },
  { value: 'FORGOT_CLOCK_OUT', label: 'Forgot to Clock Out',   desc: 'I clocked in but forgot to punch out' },
  { value: 'WRONG_TIME',       label: 'Wrong Time Recorded',   desc: 'I clocked wrong times' },
  { value: 'SYSTEM_ERROR',     label: 'System / Portal Error', desc: 'Portal was not working' },
  { value: 'ON_FIELD_WORK',    label: 'On-Field / Client Work',desc: 'Working at client site' },
  { value: 'OTHER',            label: 'Other',                 desc: 'Other reason (explain below)' },
];

// ── Custom date picker (disables Sundays + out-of-window dates) ──────────────

interface DatePickerProps {
  value:    string; // yyyy-MM-dd or ''
  onChange: (v: string) => void;
  minDate:  Date;
  maxDate:  Date;
}

function RegDatePicker({ value, onChange, minDate, maxDate }: DatePickerProps) {
  const selected    = value ? parseISO(value) : null;
  const [month, setMonth] = useState(() => selected ?? maxDate);

  const monthStart = startOfMonth(month);
  const monthEnd   = endOfMonth(month);
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  // Pad start: Mon=0 … Sun=6
  const startPad   = (getDay(monthStart) + 6) % 7;

  const canPrev = subMonths(monthStart, 1) >= startOfMonth(minDate);
  const canNext = addMonths(monthStart, 1) <= startOfMonth(maxDate);

  function isDisabled(d: Date) {
    return getDay(d) === 0 || d < minDate || d > maxDate;
  }

  return (
    <div className="border border-gray-200 dark:border-violet-900/40 rounded-lg overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-surface-dark-3/60 border-b border-gray-100 dark:border-violet-900/40">
        <button
          type="button"
          onClick={() => canPrev && setMonth((m) => subMonths(m, 1))}
          disabled={!canPrev}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-surface-dark-3 disabled:opacity-30 transition-colors duration-150"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-gray-500 dark:text-violet-300/55" />
        </button>
        <span className="text-xs font-medium text-gray-700 dark:text-violet-200/70">
          {format(month, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={() => canNext && setMonth((m) => addMonths(m, 1))}
          disabled={!canNext}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-surface-dark-3 disabled:opacity-30 transition-colors duration-150"
        >
          <ChevronRight className="w-3.5 h-3.5 text-gray-500 dark:text-violet-300/55" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-violet-900/40">
        {['Mo','Tu','We','Th','Fr','Sa','Su'].map((d, i) => (
          <div
            key={d}
            className={cn(
              'py-1.5 text-center text-[10px] font-medium uppercase tracking-wide',
              i === 6 ? 'text-red-400 dark:text-red-500' : 'text-gray-400 dark:text-violet-300/45',
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 p-1 gap-0.5">
        {Array.from({ length: startPad }).map((_, i) => <div key={`e-${i}`} />)}
        {days.map((d) => {
          const disabled  = isDisabled(d);
          const isSelected = selected && isSameDay(d, selected);
          const today     = isToday(d);
          const isSunday  = getDay(d) === 0;
          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => onChange(format(d, 'yyyy-MM-dd'))}
              title={isSunday ? 'Sunday — cannot regularize' : undefined}
              className={cn(
                'h-7 w-full rounded text-xs font-medium transition-colors duration-150',
                isSelected
                  ? 'bg-brand text-white'
                  : today && !disabled
                    ? 'ring-1 ring-brand text-brand dark:text-violet-400 hover:bg-brand/10'
                    : !disabled
                      ? 'text-gray-700 dark:text-violet-200/70 hover:bg-gray-100 dark:hover:bg-surface-dark-3'
                      : isSunday
                        ? 'text-red-300 dark:text-red-700 cursor-not-allowed line-through'
                        : 'text-gray-300 dark:text-violet-400/35 cursor-not-allowed',
              )}
            >
              {format(d, 'd')}
            </button>
          );
        })}
      </div>

      {/* Sunday hint */}
      <div className="px-3 py-1.5 border-t border-gray-100 dark:border-violet-900/40 bg-gray-50 dark:bg-surface-dark-3/40">
        <p className="text-[10px] text-gray-400 dark:text-violet-300/45">
          <span className="text-red-400">Su</span> = Sunday (holiday, cannot regularize)
        </p>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialDate?: string; // yyyy-MM-dd
  onClose:      () => void;
  onSuccess?:   () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildIso(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00`;
}

function calcWorkedHours(ciTime: string, coTime: string): { hours: number; mins: number } | null {
  if (!ciTime || !coTime) return null;
  const ci = parseISO(`2000-01-01T${ciTime}:00`);
  const co = parseISO(`2000-01-01T${coTime}:00`);
  const diff = co.getTime() - ci.getTime();
  if (diff <= 0) return null;
  const totalMins = Math.floor(diff / 60000);
  return { hours: Math.floor(totalMins / 60), mins: totalMins % 60 };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RegularizationRequestModal({ initialDate, onClose, onSuccess }: Props) {
  const submit = useSubmitRegularization();
  const [reviewerInfo,    setReviewerInfo]    = useState<{ name: string; designation: string | null } | null>(null);
  const [existingAtt,     setExistingAtt]     = useState<{ sessionCount: number; totalWorkedDisplay: string } | null | undefined>(undefined);
  const [loadingAtt,      setLoadingAtt]      = useState(false);

  const today     = new Date();
  const minDateObj = subDays(today, 30);
  const maxDateObj = subDays(today, 1);

  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<FormValues>({
    resolver:      zodResolver(schema),
    defaultValues: {
      date:               initialDate ?? '',
      regularizationType: 'FORGOT_CLOCK_IN',
      clockInTime:        '',
      clockOutTime:       '',
      reason:             '',
    },
  });

  const watchDate    = watch('date');
  const watchCI      = watch('clockInTime');
  const watchCO      = watch('clockOutTime');
  const watchReason  = watch('reason');

  // Fetch reviewer info once
  useEffect(() => {
    fetch('/api/employees/me').then((r) => r.json()).then((json: { data?: { manager?: { name: string; designation: string | null } | null } }) => {
      setReviewerInfo(json.data?.manager ?? null);
    }).catch(() => {});
  }, []);

  // Fetch existing attendance when date changes
  useEffect(() => {
    if (!watchDate) { setExistingAtt(undefined); return; }
    setLoadingAtt(true);
    const [y, m, d] = watchDate.split('-').map(Number);
    const year = y; const month = m - 1;
    fetch(`/api/attendance/me?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((json: { data?: { date: string; sessions: unknown[]; totalWorkedDisplay: string }[] }) => {
        const rec = json.data?.find((r) => r.date.startsWith(watchDate));
        setExistingAtt(rec ? { sessionCount: rec.sessions.length, totalWorkedDisplay: rec.totalWorkedDisplay } : null);
      })
      .catch(() => setExistingAtt(null))
      .finally(() => setLoadingAtt(false));
  }, [watchDate]);

  const workedHours  = watchCI && watchCO ? calcWorkedHours(watchCI, watchCO) : null;
  const exceeds16h   = workedHours && workedHours.hours >= 16;

  function onSubmit(values: FormValues) {
    if (exceeds16h) return;
    submit.mutate({
      date:               values.date,
      requestedClockIn:   buildIso(values.date, values.clockInTime),
      requestedClockOut:  values.clockOutTime ? buildIso(values.date, values.clockOutTime ?? '') : undefined,
      regularizationType: values.regularizationType as string,
      reason:             values.reason,
    }, {
      onSuccess: () => {
        toast.success(`Regularization request submitted for ${format(parseISO(values.date), 'dd MMM yyyy')}. You'll be notified once it's reviewed.`);
        onSuccess?.();
        onClose();
      },
    });
  }

  const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-surface-dark-2 rounded-xl border border-gray-200 dark:border-violet-900/40 w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Raise Attendance Regularization Request</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 text-gray-400 transition-colors duration-150">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">

          {/* Warning banner */}
          <div className="flex gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Regularization is for genuine cases where you worked but could not clock in/out. False requests may be rejected and flagged.
            </p>
          </div>

          <form id="reg-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">Date *</label>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <RegDatePicker
                    value={field.value}
                    onChange={field.onChange}
                    minDate={minDateObj}
                    maxDate={maxDateObj}
                  />
                )}
              />
              {errors.date && <p className="text-xs text-status-absent mt-1">{errors.date.message}</p>}
              {watchDate && (
                <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">
                  {format(parseISO(watchDate), 'EEEE, dd MMM yyyy')}
                </p>
              )}
              {/* Existing attendance info */}
              {watchDate && loadingAtt && (
                <p className="text-xs text-gray-400 mt-1">Checking attendance…</p>
              )}
              {watchDate && !loadingAtt && existingAtt === null && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  No attendance record found for this date.
                </span>
              )}
              {watchDate && !loadingAtt && existingAtt && (
                <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-1">
                  You have <span className="font-medium">{existingAtt.sessionCount}</span> clock-in session{existingAtt.sessionCount !== 1 ? 's' : ''} on this date. Total: <span className="font-medium">{existingAtt.totalWorkedDisplay}</span>
                </p>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">Regularization Type *</label>
              <select {...register('regularizationType')} className={IC}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                ))}
              </select>
              {errors.regularizationType && <p className="text-xs text-status-absent mt-1">{errors.regularizationType.message}</p>}
            </div>

            {/* Clock-in time */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">
                I started working at *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input type="time" {...register('clockInTime')} className={`${IC} pl-9`} />
              </div>
              {errors.clockInTime && <p className="text-xs text-status-absent mt-1">{errors.clockInTime.message}</p>}
            </div>

            {/* Clock-out time */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">
                I stopped working at <span className="normal-case font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input type="time" {...register('clockOutTime')} className={`${IC} pl-9`} />
              </div>
              {errors.clockOutTime && <p className="text-xs text-status-absent mt-1">{errors.clockOutTime.message}</p>}

              {/* Live hours calculation */}
              {workedHours && !exceeds16h && (
                <p className={cn(
                  'text-xs mt-1 font-medium',
                  workedHours.hours >= 4 ? 'text-status-present' : 'text-status-wfh',
                )}>
                  Claimed working hours: {workedHours.hours}h {workedHours.mins}m
                  {workedHours.hours < 4 && ' (partial day)'}
                </p>
              )}
              {exceeds16h && (
                <p className="text-xs text-status-absent mt-1">Claimed hours exceed 16 hours. Please check the times.</p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">Reason *</label>
              <textarea
                {...register('reason')}
                rows={3}
                placeholder="I was in a client meeting from 9 AM and forgot to clock in. My manager can verify..."
                className={`${IC} resize-none`}
              />
              <div className="flex justify-between mt-1">
                {errors.reason
                  ? <p className="text-xs text-status-absent">{errors.reason.message}</p>
                  : <span />}
                <p className="text-xs text-gray-400 dark:text-violet-300/45">{(watchReason ?? '').length}/300</p>
              </div>
            </div>

          </form>

          {/* Reviewer info */}
          <div className="bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">Your request will be sent to:</p>
            {reviewerInfo ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-light text-brand text-[10px] font-semibold flex items-center justify-center shrink-0">
                  <User className="w-3 h-3" />
                </div>
                <p className="text-sm text-gray-700 dark:text-violet-200/70">
                  <span className="font-medium">{reviewerInfo.name}</span>
                  {reviewerInfo.designation && <span className="text-gray-400 dark:text-violet-300/45"> · {reviewerInfo.designation}</span>}
                  <span className="text-gray-400 dark:text-violet-300/45"> · and all Admins</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-violet-300/55">All Admins</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0">
          <button onClick={onClose} className="px-4 h-9 text-sm font-medium text-gray-600 dark:text-violet-200/70 hover:bg-gray-100 dark:hover:bg-surface-dark-3 rounded-lg transition-colors duration-150">
            Cancel
          </button>
          <button
            type="submit"
            form="reg-form"
            disabled={submit.isPending || !!exceeds16h}
            className="flex items-center gap-2 bg-brand text-white hover:bg-brand-hover h-9 px-5 rounded-lg text-sm font-medium transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
          >
            {submit.isPending && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}
