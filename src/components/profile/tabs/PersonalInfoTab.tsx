'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, AlertCircle, Check, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMyProfile } from '@/hooks/useMyProfile';
import type { MyProfile } from '@/types/profile';

const schema = z.object({
  firstName:               z.string().min(1, 'Required').max(50),
  lastName:                z.string().max(50).optional(),
  phone:                   z.string().max(20).nullable().optional(),
  fatherName:              z.string().max(100).nullable().optional(),
  motherName:              z.string().max(100).nullable().optional(),
  parentsPhone:            z.string().max(20).nullable().optional(),
  bondCertificateSubmitted: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

interface PersonalInfoTabProps {
  user:          MyProfile;
  onDirtyChange: (dirty: boolean) => void;
  formRef?:      React.RefObject<HTMLFormElement | null>;
}

export function PersonalInfoTab({ user, onDirtyChange, formRef }: PersonalInfoTabProps) {
  const { updateProfile } = useMyProfile();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const nameParts = user.name.trim().split(' ');
  const defaultValues: FormValues = {
    firstName:               nameParts[0] ?? '',
    lastName:                nameParts.slice(1).join(' '),
    phone:                   user.phone         ?? '',
    fatherName:              user.fatherName    ?? '',
    motherName:              user.motherName    ?? '',
    parentsPhone:            user.parentsPhone  ?? '',
    bondCertificateSubmitted: user.bondCertificateSubmitted ?? false,
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  const bondValue = watch('bondCertificateSubmitted');

  useEffect(() => { onDirtyChange(isDirty); }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const parts = user.name.trim().split(' ');
    reset({
      firstName:               parts[0] ?? '',
      lastName:                parts.slice(1).join(' '),
      phone:                   user.phone         ?? '',
      fatherName:              user.fatherName    ?? '',
      motherName:              user.motherName    ?? '',
      parentsPhone:            user.parentsPhone  ?? '',
      bondCertificateSubmitted: user.bondCertificateSubmitted ?? false,
    });
  }, [user, reset]);

  async function onSubmit(values: FormValues) {
    const payload: Parameters<typeof updateProfile.mutateAsync>[0] = {};

    if (dirtyFields.firstName || dirtyFields.lastName) {
      payload.name = [values.firstName, values.lastName].filter(Boolean).join(' ').trim();
    }
    if (dirtyFields.phone)                   payload.phone                   = values.phone                   || null;
    if (dirtyFields.fatherName)              payload.fatherName              = values.fatherName              || null;
    if (dirtyFields.motherName)              payload.motherName              = values.motherName              || null;
    if (dirtyFields.parentsPhone)            payload.parentsPhone            = values.parentsPhone            || null;
    if (dirtyFields.bondCertificateSubmitted !== undefined) {
      payload.bondCertificateSubmitted = values.bondCertificateSubmitted;
    }

    if (!Object.keys(payload).length) return;
    await updateProfile.mutateAsync(payload);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 3000);
  }

  const showSaved = !isDirty && savedAt !== null;

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-8">

      {/* ── Basic Details ──────────────────────────────────────────────────── */}
      <div>
        <div className="pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Basic Details</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">
              First Name <span className="text-status-absent">*</span>
            </label>
            <input {...register('firstName')} className={cn(IC, errors.firstName && 'border-status-absent')} />
            {errors.firstName && <p className="text-xs text-status-absent mt-1">{errors.firstName.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Last Name</label>
            <input {...register('lastName')} className={IC} />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Work Email</label>
            <div className="relative">
              <input
                value={user.email}
                readOnly
                className={cn(IC, 'bg-gray-50 dark:bg-surface-dark-3/50 cursor-default text-gray-500 dark:text-violet-300/55 pr-10')}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3" title="Contact your admin to change your work email.">
                <Lock className="w-3.5 h-3.5 text-gray-400 dark:text-violet-300/45" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">Contact your admin to change your work email.</p>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Phone Number</label>
            <input {...register('phone')} placeholder="+91 98765 43210" className={cn(IC, errors.phone && 'border-status-absent')} />
            {errors.phone && <p className="text-xs text-status-absent mt-1">{errors.phone.message}</p>}
          </div>

        </div>
      </div>

      {/* ── Personal Documents & Family ────────────────────────────────────── */}
      <div>
        <div className="pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Family</h3>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">Bank, PAN, Aadhaar and other details are now in the My Details tab.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Father's Name</label>
            <input {...register('fatherName')} placeholder="Enter father's full name" className={IC} />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Mother's Name</label>
            <input {...register('motherName')} placeholder="Enter mother's full name" className={IC} />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Parents' Contact Number</label>
            <input {...register('parentsPhone')} placeholder="+91 98765 43210" className={IC} />
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">Emergency contact — parent or guardian phone number.</p>
          </div>

          {/* Bond Certificate toggle */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2 block">Bond Certificate</label>
            <button
              type="button"
              onClick={() => setValue('bondCertificateSubmitted', !bondValue, { shouldDirty: true })}
              className={cn(
                'flex items-center gap-3 w-full px-4 py-3 rounded-lg border transition-colors duration-150 text-left',
                bondValue
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                  : 'bg-gray-50 dark:bg-surface-dark-3/40 border-gray-200 dark:border-white/10',
              )}
            >
              {bondValue
                ? <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                : <ShieldOff   className="w-5 h-5 text-gray-400 dark:text-violet-300/45 shrink-0" />}
              <div>
                <p className={cn('text-sm font-medium', bondValue ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-violet-200/70')}>
                  {bondValue ? 'Certificate Submitted' : 'Certificate Not Submitted'}
                </p>
                <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
                  {bondValue
                    ? 'Bond certificate has been submitted to HR.'
                    : 'Click to mark bond certificate as submitted.'}
                </p>
              </div>
              {/* Hidden checkbox for RHF registration */}
              <input type="checkbox" {...register('bondCertificateSubmitted')} className="sr-only" />
            </button>
          </div>

        </div>
      </div>

      {/* Phone nudge */}
      {!user.phone && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">
            Please add a phone number so your team can reach you in case of emergencies.
          </p>
        </div>
      )}

      {/* Desktop save row */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100 dark:border-violet-900/40">
        <div className="flex items-center gap-2 min-h-[20px]">
          {isDirty && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs text-amber-600 dark:text-amber-400">You have unsaved changes</span>
            </>
          )}
          {showSaved && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Check className="w-3 h-3" /> All changes saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <button
              type="button"
              onClick={() => reset(defaultValues)}
              className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-violet-300/55 hover:text-gray-700 dark:hover:text-violet-100/80 transition-colors duration-150"
            >
              Discard changes
            </button>
          )}
          <button
            type="submit"
            disabled={!isDirty || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </form>
  );
}
