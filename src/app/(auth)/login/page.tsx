'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Schema ────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ── Page ──────────────────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') ?? null;
  const paramEmail = searchParams?.get('email') ?? '';
  const isAccepted = searchParams?.get('accepted') === 'true';
  const [showPassword, setShowPassword] = useState(false);
  const [serverError,  setServerError]  = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: paramEmail, password: '' },
  });

  useEffect(() => {
    if (paramEmail) {
      setValue('email', paramEmail);
    }
  }, [paramEmail, setValue]);

  const onSubmit = async (data: LoginFormValues) => {
    setServerError('');
    const result = await signIn('credentials', {
      email:    data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      const msg = result.error;
      if (msg.includes('ACCOUNT_DEACTIVATED')) {
        setServerError('Your account has been deactivated. Contact HR.');
      } else if (msg.includes('NO_PASSWORD_SET')) {
        setServerError('No password set for this account. Contact your administrator.');
      } else {
        setServerError('Incorrect password. Contact your administrator if you need a password reset.');
      }
    } else {
      // Check if user must change password
      const session = await fetch('/api/auth/session').then((r) => r.json()) as { user?: { mustChangePassword?: boolean } };
      if (session?.user?.mustChangePassword) {
        router.push('/change-password');
      } else {
        toast.success('Signed in successfully!');
        let destination = '/dashboard';
        if (callbackUrl) {
          if (callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
            destination = callbackUrl;
          } else {
            try {
              const parsed = new URL(callbackUrl, window.location.origin);
              if (parsed.origin === window.location.origin) {
                destination = `${parsed.pathname}${parsed.search}`;
              }
            } catch {
              // ignore
            }
          }
        }
        router.push(destination);
      }
      router.refresh();
    }
  };

  const isBusy = isSubmitting;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-[0_8px_40px_-12px_rgba(142,81,255,0.18)]">
      {/* Heading */}
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Welcome back!</h2>
        <p className="mt-1 text-sm text-gray-400">Sign in to your employee workspace</p>
      </div>

      {isAccepted && (
        <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-start gap-2.5 shadow-xs">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="font-bold text-emerald-900">Invitation Accepted!</p>
            <p className="mt-0.5 text-emerald-700">Your account is active. Please log in with your new password.</p>
          </div>
        </div>
      )}

      {/* Credentials form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Email address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Mail className="w-4 h-4 text-gray-400" />
            </div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              {...register('email')}
              className={cn(
                'w-full pl-10 pr-4 h-10 text-sm bg-gray-50 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 placeholder:text-gray-400',
                errors.email
                  ? 'border-status-absent focus:ring-status-absent/30'
                  : 'border-gray-200 focus:border-brand',
              )}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-status-absent mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Lock className="w-4 h-4 text-gray-400" />
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              className={cn(
                'w-full pl-10 pr-11 h-10 text-sm bg-gray-50 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 placeholder:text-gray-400',
                errors.password
                  ? 'border-status-absent focus:ring-status-absent/30'
                  : 'border-gray-200 focus:border-brand',
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-status-absent mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Server error */}
        {serverError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-xs text-status-absent font-medium">{serverError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isBusy}
          className="w-full mt-2 flex items-center justify-center gap-2 bg-brand text-white h-10 px-4 rounded-lg text-sm font-medium hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Footer note */}
      <p className="text-center text-xs text-gray-400 mt-8">
        Access is restricted to authorised employees only.
        <br />
        Contact your IT administrator if you need help.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
