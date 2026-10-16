'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Loader2, Info, Eye, EyeOff, RefreshCw, Copy, Check } from 'lucide-react';
import { useCreateEmployee } from '@/hooks/useEmployees';
import { createEmployeeSchema, type CreateEmployeeInput } from '@/lib/validations/employee';
import { DEPARTMENTS } from '@/lib/constants';
import { getInitials, cn } from '@/lib/utils';
import { generateStrongPassword, checkPasswordStrength } from '@/lib/passwordUtils';
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter';
import { useQuery } from '@tanstack/react-query';
import type { Employee } from '@/types';

// Base form schema — only the RHF-controlled fields (password fields managed as plain state)
const baseFormSchema = createEmployeeSchema.omit({
  consoleAccess: true,
  passwordType: true,
  customPassword: true,
  mustChangePasswordOnLogin: true,
});
type BaseFormInput = import('zod').infer<typeof baseFormSchema>;

// ── Manager picker ────────────────────────────────────────────────────────────

function useAllEmployees() {
  return useQuery({
    queryKey: ['employees', 'all'],
    queryFn: async (): Promise<Employee[]> => {
      const res = await fetch('/api/employees?limit=200');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json() as { data: Employee[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── Preview card ──────────────────────────────────────────────────────────────

interface PreviewCardProps {
  firstName:   string;
  lastName:    string;
  designation: string;
  department:  string;
}

function PreviewCard({ firstName, lastName, designation, department }: PreviewCardProps) {
  const name = `${firstName} ${lastName}`.trim() || 'Full Name';
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 max-w-xs">
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-brand-light text-brand flex items-center justify-center text-lg font-semibold mb-3">
          {getInitials(name)}
        </div>
        <p className="text-base font-semibold text-gray-900 dark:text-white">{name}</p>
        <p className="text-sm text-gray-400 dark:text-violet-300/55 mt-0.5">{designation || 'Designation'}</p>
        <div className="flex items-center gap-2 mt-2">
          {department && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-light text-brand dark:bg-violet-900/30 dark:text-violet-300">
              {department}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-status-present">
            <span className="w-1.5 h-1.5 rounded-full bg-status-present" /> Active
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface OnboardEmployeeModalProps {
  onClose: () => void;
}

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';
const LABEL = 'text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block';

export function OnboardEmployeeModal({ onClose }: OnboardEmployeeModalProps) {
  const create = useCreateEmployee();
  const { data: allEmployees } = useAllEmployees();
  const [emailError, setEmailError] = useState('');

  // Password section state
  const [consoleAccess,    setConsoleAccess]    = useState(true);
  const [passwordType,     setPasswordType]     = useState<'AUTO' | 'CUSTOM'>('AUTO');
  const [autoPassword,     setAutoPassword]     = useState(() => generateStrongPassword());
  const [showCustomPwd,    setShowCustomPwd]    = useState(false);
  const [showConfirmPwd,   setShowConfirmPwd]   = useState(false);
  const [customPwd,        setCustomPwd]        = useState('');
  const [confirmPwd,       setConfirmPwd]       = useState('');
  const [mustChange,       setMustChange]       = useState(true);
  const [copied,           setCopied]           = useState(false);
  const [pwdError,         setPwdError]         = useState('');

  // Regenerate auto password when switching to AUTO
  useEffect(() => {
    if (passwordType === 'AUTO') setAutoPassword(generateStrongPassword());
  }, [passwordType]);

  function handleCopy() {
    navigator.clipboard.writeText(autoPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const { register, handleSubmit, watch, formState: { errors } } = useForm<BaseFormInput>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: {
      role:           'EMPLOYEE',
      employmentType: 'FULL_TIME',
      joiningDate:    new Date().toISOString().split('T')[0],
    },
  });

  const [firstName, lastName, designation, department] = watch(['firstName', 'lastName', 'designation', 'department']);

  async function onSubmit(data: BaseFormInput) {
    setPwdError('');
    setEmailError('');

    // Client-side password validation
    if (consoleAccess && passwordType === 'CUSTOM') {
      if (customPwd !== confirmPwd) { setPwdError('Passwords do not match.'); return; }
      const { score } = checkPasswordStrength(customPwd);
      if (score < 2) { setPwdError('Password is too weak. Add uppercase, numbers, or symbols.'); return; }
    }

    const payload = {
      ...data,
      consoleAccess,
      passwordType,
      customPassword:            passwordType === 'CUSTOM' ? customPwd : undefined,
      mustChangePasswordOnLogin: mustChange,
    };

    create.mutate(payload as CreateEmployeeInput, {
      onSuccess: onClose,
      onError: (err) => {
        if (err.message.includes('already registered')) setEmailError('This email is already registered.');
      },
    });
  }

  const EMPLOYMENT_TYPES = [
    { value: 'FULL_TIME', label: 'Full Time' },
    { value: 'PART_TIME', label: 'Part Time' },
    { value: 'CONTRACT',  label: 'Contract' },
  ] as const;

  const employmentType = watch('employmentType');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Onboard New Employee</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-6">

            {/* Section 1 — Personal Details */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-4">Personal Details</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>First Name *</label>
                    <input {...register('firstName')} className={IC} placeholder="Arjun" />
                    {errors.firstName && <p className="text-xs text-status-absent mt-1">{errors.firstName.message}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Last Name *</label>
                    <input {...register('lastName')} className={IC} placeholder="Sharma" />
                    {errors.lastName && <p className="text-xs text-status-absent mt-1">{errors.lastName.message}</p>}
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Work Email *</label>
                  <input {...register('email')} type="email" className={IC} placeholder="arjun@company.com" />
                  {(errors.email || emailError) && (
                    <p className="text-xs text-status-absent mt-1">{emailError || errors.email?.message}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" /> A welcome email with login credentials will be sent here.
                  </p>
                </div>
                <div>
                  <label className={LABEL}>Phone</label>
                  <input {...register('phone')} className={IC} placeholder="+91 98765 43210" />
                </div>
              </div>
            </div>

            {/* Section 2 — Role & Position */}
            <div className="border-t border-gray-100 dark:border-violet-900/30 pt-5">
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-4">Role & Position</p>
              <div className="space-y-4">
                <div>
                  <label className={LABEL}>Designation *</label>
                  <input {...register('designation')} className={IC} placeholder="Software Engineer" />
                  {errors.designation && <p className="text-xs text-status-absent mt-1">{errors.designation.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Department *</label>
                    <select {...register('department')} className={IC}>
                      <option value="">Select department</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {errors.department && <p className="text-xs text-status-absent mt-1">{errors.department.message}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Role</label>
                    <select {...register('role')} className={IC}>
                      <option value="EMPLOYEE">Employee</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Reports To</label>
                  <select {...register('managerId')} className={IC}>
                    <option value="">No one</option>
                    {(allEmployees ?? []).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}{e.designation ? ` — ${e.designation}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Employment Type</label>
                  <div className="flex rounded-lg border border-gray-200 dark:border-violet-900/40 overflow-hidden">
                    {EMPLOYMENT_TYPES.map((et) => (
                      <label
                        key={et.value}
                        className={cn(
                          'flex-1 text-center py-2 text-sm font-medium cursor-pointer transition-colors duration-150',
                          employmentType === et.value
                            ? 'bg-brand text-white'
                            : 'text-gray-600 dark:text-violet-300/55 hover:bg-gray-50 dark:hover:bg-surface-dark-3',
                        )}
                      >
                        <input type="radio" {...register('employmentType')} value={et.value} className="sr-only" />
                        {et.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Joining Date *</label>
                  <input {...register('joiningDate')} type="date" className={IC} />
                  {errors.joiningDate && <p className="text-xs text-status-absent mt-1">{errors.joiningDate.message}</p>}
                </div>
              </div>
            </div>

            {/* Section 3 — Preview */}
            <div className="border-t border-gray-100 dark:border-violet-900/30 pt-5">
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-4">Preview</p>
              <PreviewCard
                firstName={firstName ?? ''}
                lastName={lastName ?? ''}
                designation={designation ?? ''}
                department={department ?? ''}
              />
            </div>

            {/* Section 4 — Console Access & Password */}
            <div className="border-t border-gray-100 dark:border-violet-900/30 pt-5 space-y-5">
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Console Access &amp; Password</p>

              {/* Enable portal access toggle */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-surface-dark-3/50 rounded-xl border border-gray-200 dark:border-violet-900/40 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Enable portal access</p>
                  <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">Allow this employee to sign in to Deep Impression.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={consoleAccess}
                  onClick={() => setConsoleAccess((v) => !v)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                    consoleAccess ? 'bg-brand' : 'bg-gray-300 dark:bg-surface-dark-3',
                  )}
                >
                  <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200', consoleAccess ? 'translate-x-4' : 'translate-x-0')} />
                </button>
              </div>

              {consoleAccess && (
                <div className="space-y-4">
                  {/* Password type selector */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">Console password</p>
                    <div className="space-y-2">
                      {(['AUTO', 'CUSTOM'] as const).map((type) => (
                        <label key={type} className="flex items-center gap-3 cursor-pointer group">
                          <div className={cn(
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-150',
                            passwordType === type ? 'border-brand' : 'border-gray-300 dark:border-white/10',
                          )}>
                            {passwordType === type && <div className="w-2 h-2 rounded-full bg-brand" />}
                          </div>
                          <input type="radio" className="sr-only" checked={passwordType === type} onChange={() => setPasswordType(type)} />
                          <span className="text-sm text-gray-700 dark:text-violet-200/70">
                            {type === 'AUTO' ? 'Autogenerated password' : 'Custom password'}
                          </span>
                        </label>
                      ))}
                    </div>
                    {/* Admin-only reset note */}
                    <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-violet-300/45 mt-3">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      The employee cannot reset their own password. Only an admin can reset it from the employee&apos;s profile.
                    </p>
                  </div>

                  {/* Autogenerated password display */}
                  {passwordType === 'AUTO' && (
                    <div>
                      <label className={LABEL}>Generated password</label>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={autoPassword}
                          className={cn(IC, 'font-mono tracking-wider flex-1')}
                        />
                        <button
                          type="button"
                          onClick={() => setAutoPassword(generateStrongPassword())}
                          title="Regenerate"
                          className="p-2 rounded-lg border border-gray-200 dark:border-violet-900/40 text-gray-500 dark:text-violet-300/55 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCopy}
                          title={copied ? 'Copied!' : 'Copy password'}
                          className={cn(
                            'p-2 rounded-lg border transition-colors duration-150',
                            copied
                              ? 'border-status-present text-status-present bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-violet-900/40 text-gray-500 dark:text-violet-300/55 hover:bg-gray-50 dark:hover:bg-surface-dark-3',
                          )}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom password inputs */}
                  {passwordType === 'CUSTOM' && (
                    <div className="space-y-3">
                      <div>
                        <label className={LABEL}>Password</label>
                        <div className="relative">
                          <input
                            type={showCustomPwd ? 'text' : 'password'}
                            value={customPwd}
                            onChange={(e) => { setCustomPwd(e.target.value); setPwdError(''); }}
                            className={cn(IC, 'pr-10')}
                            placeholder="Min 8 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCustomPwd((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150"
                          >
                            {showCustomPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <PasswordStrengthMeter password={customPwd} />
                      </div>
                      <div>
                        <label className={LABEL}>Confirm password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPwd ? 'text' : 'password'}
                            value={confirmPwd}
                            onChange={(e) => { setConfirmPwd(e.target.value); setPwdError(''); }}
                            className={cn(IC, 'pr-10')}
                            placeholder="Re-enter password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPwd((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150"
                          >
                            {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      {pwdError && <p className="text-xs text-status-absent">{pwdError}</p>}
                    </div>
                  )}

                  {/* Must change password */}
                  <div className="border-t border-gray-100 dark:border-violet-900/30 pt-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-3">Password reset required</p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mustChange}
                        onChange={(e) => setMustChange(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                      />
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">User must create a new password when they sign in for the first time</p>
                        <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">
                          The user will be required to choose a new password when they first sign in to the portal.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
            >
              {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Send Invite & Onboard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
