'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X,
  Loader2,
  Mail,
  Send,
  Copy,
  Check,
  CheckCircle2,
  UserPlus,
  Briefcase,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DEPARTMENTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Employee } from '@/types';

const addPeopleSchema = z.object({
  firstName:      z.string().min(1, 'First name is required').trim(),
  lastName:       z.string().min(1, 'Last name is required').trim(),
  email:          z.string().email('Please enter a valid email address').toLowerCase().trim(),
  role:           z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']),
  department:     z.string().min(1, 'Please select a department'),
  designation:    z.string().min(1, 'Designation is required').trim(),
  phone:          z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']),
  joiningDate:    z.string().optional(),
  managerId:      z.string().optional(),
});

type AddPeopleFormValues = z.infer<typeof addPeopleSchema>;

function useManagers() {
  return useQuery({
    queryKey: ['employees', 'potential-managers'],
    queryFn: async (): Promise<Employee[]> => {
      const res = await fetch('/api/employees?limit=200');
      if (!res.ok) return [];
      const json = await res.json() as { data: Employee[] };
      return json.data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

interface AddPeopleModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddPeopleModal({ onClose, onSuccess }: AddPeopleModalProps) {
  const queryClient = useQueryClient();
  const { data: managers = [] } = useManagers();

  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [copied, setCopied]           = useState(false);
  const [successData, setSuccessData] = useState<{
    inviteUrl:        string;
    email:            string;
    name:             string;
    emailSent?:       boolean;
    emailError?:      string | null;
    emailPreviewUrl?: string | null;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddPeopleFormValues>({
    resolver: zodResolver(addPeopleSchema),
    defaultValues: {
      role:           'EMPLOYEE',
      department:     DEPARTMENTS[0] ?? 'Engineering',
      designation:    '',
      employmentType: 'FULL_TIME',
      joiningDate:    new Date().toISOString().split('T')[0],
      managerId:      '',
    },
  });

  const onSubmit = async (data: AddPeopleFormValues) => {
    setServerError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/invites/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) {
        setServerError(resData.error || 'Failed to send invite.');
        setSubmitting(false);
        return;
      }

      setSuccessData({
        inviteUrl:        resData.inviteUrl,
        email:            resData.email,
        name:             resData.name,
        emailSent:        resData.emailSent,
        emailError:       resData.emailError,
        emailPreviewUrl:  resData.emailPreviewUrl,
      });

      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (resData.emailSent) {
        toast.success(`Invitation email sent to ${resData.email} via Nodemailer`);
      } else {
        toast.warning(
          `Account created, but email failed: ${resData.emailError || 'Check SMTP credentials'}`,
          { duration: 6000 },
        );
      }
      onSuccess?.();
    } catch {
      setServerError('An unexpected network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!successData?.inviteUrl) return;
    navigator.clipboard.writeText(successData.inviteUrl).then(() => {
      setCopied(true);
      toast.success('Invite link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const inputClass =
    'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors';
  const labelClass =
    'text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh] overflow-hidden animate-fade-in-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <UserPlus className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Add People</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/10 text-brand border border-brand/20">
                  Invite Flow
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Send an official invitation email to onboard a new employee
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        {successData ? (
          /* Success Screen with Copy Link */
          <div className="p-6 space-y-5 text-center overflow-y-auto">
            <div className="mx-auto size-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="size-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {successData.emailSent ? 'Invitation Sent Successfully!' : 'Invitation Created!'}
              </h3>
              {successData.emailSent ? (
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                  An invitation email has been sent via Nodemailer to <strong className="text-gray-800 dark:text-zinc-200">{successData.email}</strong> for <strong className="text-gray-800 dark:text-zinc-200">{successData.name}</strong>.
                </p>
              ) : (
                <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 p-2.5 text-xs text-amber-800 dark:text-amber-300 text-left">
                  <p className="font-semibold mb-0.5">⚠️ Email delivery failed</p>
                  <p className="text-[11px] opacity-90">{successData.emailError || 'Invalid SMTP credentials. Please check SMTP_PASS in .env.'}</p>
                </div>
              )}
              {successData.emailPreviewUrl && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand/10 text-brand text-xs">
                  <span>Nodemailer Ethereal Inbox:</span>
                  <a
                    href={successData.emailPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold hover:text-brand-hover inline-flex items-center gap-1"
                  >
                    View Dispatched Email <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Direct Link Box */}
            <div className="bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300">
                  Invitation Link (valid for 7 days)
                </span>
                <span className="text-[11px] text-gray-400">Copy or share directly</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={successData.inviteUrl}
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-zinc-300 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer',
                    copied
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-brand text-white hover:bg-brand-hover shadow-xs',
                  )}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Step sequence reminder */}
            <div className="bg-brand/5 border border-brand/15 rounded-xl p-3 text-xs text-brand text-left flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" />
                <span>
                  <strong>Next Step:</strong> Employee opens email → Accepts invite → Sets password → Logs in.
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setSuccessData(null);
                  reset();
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-surface-dark-3 rounded-lg transition-colors"
              >
                Invite Another Person
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-lg transition-colors shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-4">

              {serverError && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>First Name *</label>
                  <input
                    {...register('firstName')}
                    placeholder="Arjun"
                    className={cn(inputClass, errors.firstName && 'border-rose-400')}
                  />
                  {errors.firstName && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Last Name *</label>
                  <input
                    {...register('lastName')}
                    placeholder="Sharma"
                    className={cn(inputClass, errors.lastName && 'border-rose-400')}
                  />
                  {errors.lastName && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className={labelClass}>Work Email *</label>
                <div className="relative">
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="arjun@company.com"
                    className={cn(inputClass, errors.email && 'border-rose-400')}
                  />
                </div>
                {errors.email ? (
                  <p className="text-[11px] text-rose-500 mt-1">{errors.email.message}</p>
                ) : (
                  <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">
                    An official invitation link with account setup instructions will be sent here.
                  </p>
                )}
              </div>

              {/* Department & Designation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Department *</label>
                  <select {...register('department')} className={inputClass}>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Designation *</label>
                  <input
                    {...register('designation')}
                    list="designation-suggestions"
                    placeholder="e.g. Junior Video Editor"
                    className={cn(inputClass, errors.designation && 'border-rose-400')}
                  />
                  <datalist id="designation-suggestions">
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                  {errors.designation && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.designation.message}</p>
                  )}
                </div>
              </div>

              {/* Role & Employment Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>System Role</label>
                  <select {...register('role')} className={inputClass}>
                    <option value="EMPLOYEE">Employee (Standard)</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Employment Type</label>
                  <select {...register('employmentType')} className={inputClass}>
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </div>
              </div>

              {/* Reporting Manager & Joining Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Reporting Manager</label>
                  <select {...register('managerId')} className={inputClass}>
                    <option value="">No manager assigned</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.department ?? 'Team'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Joining Date</label>
                  <input
                    type="date"
                    {...register('joiningDate')}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Optional Phone */}
              <div>
                <label className={labelClass}>Phone (Optional)</label>
                <input
                  {...register('phone')}
                  placeholder="+91 98765 43210"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-surface-dark-3/50 border-t border-gray-100 dark:border-white/10 shrink-0">
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Send className="size-3 text-brand" /> Sends secure token invitation
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-200/50 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-brand hover:bg-brand-hover active:scale-[0.98] rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Sending Invite...</span>
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      <span>Send Invite</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
