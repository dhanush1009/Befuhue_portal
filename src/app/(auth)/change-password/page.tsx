'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { checkPasswordStrength } from '@/lib/passwordUtils';
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter';

const schema = z.object({
  newPassword:     z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine((d) => checkPasswordStrength(d.newPassword).score >= 2, {
  message: 'Password is too weak. Add uppercase, numbers, or symbols.',
  path: ['newPassword'],
});

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const router  = useRouter();
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const update  = sessionResult?.update;
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register, handleSubmit, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Redirect if not in force-change state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mustChange = (session?.user as any)?.mustChangePassword;
  if (session && !mustChange) {
    router.replace('/dashboard');
    return null;
  }

  const newPassword = watch('newPassword') ?? '';

  const onSubmit = async (data: FormValues) => {
    const res = await fetch('/api/auth/change-password', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ newPassword: data.newPassword }),
    });

    const json = await res.json() as { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? 'Failed to update password.');
      return;
    }

    // Sign out so the user re-authenticates with their new password
    toast.success('Password set! Please sign in with your new password.');
    await signOut({ redirect: false });
    router.replace('/login');
  };

  const IC = (hasError: boolean) => cn(
    'w-full pl-10 pr-11 h-10 text-sm bg-gray-50 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 placeholder:text-gray-400',
    hasError ? 'border-status-absent focus:ring-status-absent/30' : 'border-gray-200 focus:border-brand',
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-brand" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Create your new password</h2>
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-8 ml-[52px]">
        For security, you must set a new password before continuing.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* New password */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Lock className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type={showNew ? 'text' : 'password'}
              placeholder="Min 8 characters"
              {...register('newPassword')}
              className={IC(!!errors.newPassword)}
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrengthMeter password={newPassword} />
          {errors.newPassword && (
            <p className="text-xs text-status-absent mt-1">{errors.newPassword.message}</p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Confirm New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Lock className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter password"
              {...register('confirmPassword')}
              className={IC(!!errors.confirmPassword)}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-status-absent mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 flex items-center justify-center gap-2 bg-brand text-white h-10 px-4 rounded-lg text-sm font-medium hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Setting password…</>
          ) : (
            'Set Password & Continue'
          )}
        </button>
      </form>
    </div>
  );
}
