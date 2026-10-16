'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X, KeyRound, AlertTriangle, RefreshCw, Copy, Check,
  Eye, EyeOff, Loader2, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateStrongPassword, checkPasswordStrength } from '@/lib/passwordUtils';
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.discriminatedUnion('passwordType', [
  z.object({
    passwordType:              z.literal('AUTO'),
    mustChangePasswordOnLogin: z.boolean(),
  }),
  z.object({
    passwordType:              z.literal('CUSTOM'),
    customPassword:            z.string().min(8, 'Min 8 characters'),
    confirmPassword:           z.string(),
    mustChangePasswordOnLogin: z.boolean(),
  }).refine((d) => d.customPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path:    ['confirmPassword'],
  }),
]);

type FormValues = z.infer<typeof schema>;

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 pr-10';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ResetPasswordModalProps {
  employeeId:    string;
  employeeName:  string;
  employeeEmail: string;
  onClose:       () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ResetPasswordModal({ employeeId, employeeName, employeeEmail, onClose }: ResetPasswordModalProps) {
  const [autoPassword,  setAutoPassword]  = useState(() => generateStrongPassword());
  const [showCustom,    setShowCustom]    = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [copiedAuto,    setCopiedAuto]    = useState(false);
  const [copiedResult,  setCopiedResult]  = useState(false);
  const [submitError,   setSubmitError]   = useState('');
  const [resultPassword, setResultPassword] = useState<string | null>(null);

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver:      zodResolver(schema),
    defaultValues: { passwordType: 'AUTO', mustChangePasswordOnLogin: true },
  });

  const passwordType = watch('passwordType');
  const customPwd    = watch('passwordType') === 'CUSTOM' ? (watch as (k: string) => string)('customPassword') ?? '' : '';

  // Keep mustChangePasswordOnLogin registered when switching types
  useEffect(() => {
    setValue('passwordType', passwordType);
  }, [passwordType, setValue]);

  function handleCopyAuto() {
    void navigator.clipboard.writeText(autoPassword).then(() => {
      setCopiedAuto(true);
      setTimeout(() => setCopiedAuto(false), 2000);
    });
  }

  function handleCopyResult() {
    if (!resultPassword) return;
    void navigator.clipboard.writeText(resultPassword).then(() => {
      setCopiedResult(true);
      setTimeout(() => setCopiedResult(false), 2000);
    });
  }

  async function onSubmit(values: FormValues) {
    setSubmitError('');
    const payload = {
      passwordType:              values.passwordType,
      customPassword:            values.passwordType === 'CUSTOM' ? values.customPassword : undefined,
      mustChangePasswordOnLogin: values.mustChangePasswordOnLogin,
    };

    // For AUTO, include the displayed password so the API uses it
    const body = values.passwordType === 'AUTO'
      ? { ...payload, customPassword: autoPassword, passwordType: 'CUSTOM' as const }
      : payload;

    try {
      const res  = await fetch(`/api/admin/employees/${employeeId}/reset-password`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const json = await res.json() as { plainPassword?: string; error?: string; message?: string };
      if (!res.ok) {
        setSubmitError(json.error ?? 'Failed to reset password.');
        return;
      }
      setResultPassword(json.plainPassword ?? autoPassword);
    } catch {
      setSubmitError('Failed to reset password. Please try again.');
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (resultPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
          <div className="flex flex-col items-center text-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Password Reset Successfully</h3>
            <p className="text-sm text-gray-500 dark:text-violet-300/55">
              A new password has been sent to <span className="font-medium text-gray-700 dark:text-violet-200/70">{employeeEmail}</span>
            </p>
          </div>

          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">New password (shown once)</p>
            <div className="flex items-center gap-2 bg-gray-950 rounded-lg p-3">
              <code className="flex-1 font-mono text-sm text-green-400 tracking-wider break-all">{resultPassword}</code>
              <button
                type="button"
                onClick={handleCopyResult}
                className="shrink-0 p-1.5 rounded text-gray-400 hover:text-green-400 transition-colors duration-150"
                title="Copy password"
              >
                {copiedResult ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-xs text-amber-600 dark:text-amber-400 italic mb-5">
            ⚠ This password will not be shown again. Share it securely if needed.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Reset Password — <span className="text-gray-500 dark:text-violet-300/55 font-normal">{employeeName}</span>
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5">

            {/* Info banner */}
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                A new password will be generated and sent to <strong>{employeeEmail}</strong>. The employee will receive an email with their new credentials.
              </p>
            </div>

            {/* Password type */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-3">New Password</p>
              <div className="space-y-2 mb-4">
                {(['AUTO', 'CUSTOM'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-3 cursor-pointer">
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-150 shrink-0',
                      passwordType === type ? 'border-brand' : 'border-gray-300 dark:border-white/10',
                    )}>
                      {passwordType === type && <div className="w-2 h-2 rounded-full bg-brand" />}
                    </div>
                    <input type="radio" className="sr-only" {...register('passwordType')} value={type} />
                    <span className="text-sm text-gray-700 dark:text-violet-200/70">
                      {type === 'AUTO' ? 'Autogenerated password' : 'Custom password'}
                    </span>
                  </label>
                ))}
              </div>

              {/* Auto password display */}
              {passwordType === 'AUTO' && (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={autoPassword}
                    className="flex-1 px-3 py-2 text-sm font-mono tracking-wider bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white"
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
                    onClick={handleCopyAuto}
                    title={copiedAuto ? 'Copied!' : 'Copy'}
                    className={cn(
                      'p-2 rounded-lg border transition-colors duration-150',
                      copiedAuto
                        ? 'border-green-400 text-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-violet-900/40 text-gray-500 dark:text-violet-300/55 hover:bg-gray-50 dark:hover:bg-surface-dark-3',
                    )}
                  >
                    {copiedAuto ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {/* Custom password inputs */}
              {passwordType === 'CUSTOM' && (
                <div className="space-y-3">
                  <div>
                    <div className="relative">
                      <input
                        type={showCustom ? 'text' : 'password'}
                        placeholder="Min 8 characters"
                        {...register('customPassword' as never)}
                        className={cn(IC, (errors as Record<string, { message?: string }>).customPassword && 'border-status-absent')}
                      />
                      <button type="button" onClick={() => setShowCustom((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150">
                        {showCustom ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrengthMeter password={customPwd} />
                    {(errors as Record<string, { message?: string }>).customPassword && (
                      <p className="text-xs text-status-absent mt-1">{(errors as Record<string, { message?: string }>).customPassword?.message}</p>
                    )}
                  </div>
                  <div>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Confirm password"
                        {...register('confirmPassword' as never)}
                        className={cn(IC, (errors as Record<string, { message?: string }>).confirmPassword && 'border-status-absent')}
                      />
                      <button type="button" onClick={() => setShowConfirm((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {(errors as Record<string, { message?: string }>).confirmPassword && (
                      <p className="text-xs text-status-absent mt-1">{(errors as Record<string, { message?: string }>).confirmPassword?.message}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Must change checkbox */}
            <div className="border-t border-gray-100 dark:border-violet-900/30 pt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('mustChangePasswordOnLogin')}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                />
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">Require employee to change password on next sign in</p>
                  <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
                    The employee will be prompted to set a new password when they next sign in.
                  </p>
                </div>
              </label>
            </div>

            {/* Submit error */}
            {submitError && (
              <p className="text-xs text-status-absent bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Reset Password &amp; Notify Employee
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
