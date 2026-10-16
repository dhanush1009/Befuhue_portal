'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Building2, User, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { checkPasswordStrength } from '@/lib/passwordUtils';
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter';
import { cn } from '@/lib/utils';

interface InviteDetails {
  name:        string;
  email:       string;
  role:        string;
  department:  string | null;
  designation: string | null;
  expiresAt:   string;
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [loading, setLoading]         = useState(true);
  const [errorMsg, setErrorMsg]       = useState('');
  const [invite, setInvite]           = useState<InviteDetails | null>(null);

  const [password, setPassword]       = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [formError, setFormError]     = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [accepted, setAccepted]       = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setErrorMsg('Invalid or missing invitation token.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function verify() {
      try {
        const res = await fetch(`/api/invites/${token}`);
        const data = await res.json();

        if (!isMounted) return;

        if (!res.ok) {
          setErrorMsg(data.error || 'This invitation is invalid or has expired.');
        } else {
          setInvite(data);
        }
      } catch {
        if (isMounted) setErrorMsg('Failed to verify invitation. Please check your network connection.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verify();
    return () => { isMounted = false; };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPwd) {
      setFormError('Passwords do not match. Please verify.');
      return;
    }

    const { score } = checkPasswordStrength(password);
    if (score < 2) {
      setFormError('Password is too weak. Please add uppercase letters, numbers, or symbols.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to accept invitation. Please try again.');
        setSubmitting(false);
        return;
      }

      setAccepted(true);
      toast.success('Invitation accepted! Redirecting to sign in...');

      // Redirect to login with email pre-filled and accepted banner
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(invite?.email ?? '')}&accepted=true`);
      }, 1500);
    } catch {
      setFormError('An unexpected network error occurred.');
      setSubmitting(false);
    }
  }

  // 1. Loading state
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-lg">
        <Loader2 className="mx-auto size-8 animate-spin text-brand" />
        <p className="mt-4 text-sm font-semibold text-gray-800">Verifying your invitation...</p>
        <p className="mt-1 text-xs text-gray-500">Connecting to Befhue Workspace</p>
      </div>
    );
  }

  // 2. Error state (expired / already accepted / invalid)
  if (errorMsg || !invite) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-500 mb-4">
          <AlertCircle className="size-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Invitation Not Available</h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          {errorMsg || 'We could not find an active invitation matching this link.'}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full h-11 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors shadow-sm"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // 3. Accepted success transition
  if (accepted) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 mb-4 animate-bounce">
          <CheckCircle2 className="size-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Welcome to the Team!</h2>
        <p className="mt-2 text-sm text-gray-600">
          Your account is activated and your password has been set. Redirecting to login...
        </p>
        <div className="mt-6 flex justify-center">
          <Loader2 className="size-5 animate-spin text-brand" />
        </div>
      </div>
    );
  }

  // 4. Invitation acceptance form
  const { score } = checkPasswordStrength(password);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
      {/* Header */}
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand/10 text-brand mb-3 border border-brand/20">
          🎉 Welcome to Befhue
        </span>
        <h2 className="text-2xl font-bold text-gray-900">Accept Invitation</h2>
        <p className="mt-1 text-sm text-gray-500">
          Hi <strong className="text-gray-800">{invite.name}</strong>, create your password to get started.
        </p>
      </div>

      {/* Profile Summary Badge */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 mb-6 text-xs text-gray-600 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Work Email</span>
          <span className="font-semibold text-gray-800">{invite.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Role / Designation</span>
          <span className="font-medium text-gray-800">
            {invite.designation ?? invite.role} {invite.department ? `· ${invite.department}` : ''}
          </span>
        </div>
      </div>

      {formError && (
        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* Password Setup Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            Create Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter strong password (min 6 chars)"
              className="w-full pl-3 pr-10 h-10 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-2">
              <PasswordStrengthMeter password={password} />
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
            Confirm Password *
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="Re-type password"
              className={cn(
                'w-full pl-3 pr-10 h-10 text-sm bg-white border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition-colors',
                confirmPwd && confirmPwd !== password
                  ? 'border-rose-400 focus:ring-rose-400/30'
                  : 'border-gray-200',
              )}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {confirmPwd && confirmPwd === password && (
            <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1 font-medium">
              <CheckCircle2 className="size-3" /> Passwords match
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !password || !confirmPwd}
          className="w-full mt-2 h-11 rounded-xl bg-brand text-white text-sm font-bold tracking-wide hover:bg-brand-hover active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand/20"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Activating Account...</span>
            </>
          ) : (
            <>
              <span>Accept & Join Workspace</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
