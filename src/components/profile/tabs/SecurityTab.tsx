'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, Eye, EyeOff,
  Monitor, Loader2, X, Info,
} from 'lucide-react';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { toast } from 'sonner';
import { cn, getInitials } from '@/lib/utils';
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter';
import type { MyProfile } from '@/types/profile';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionEntry {
  id:         string;
  device:     string;
  ip:         string;
  lastActive: string;
  isCurrent:  boolean;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword:     z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
});

type PwForm = z.infer<typeof pwSchema>;

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 pr-10';

// ── Password section ──────────────────────────────────────────────────────────

function PasswordSection({ user }: { user: MyProfile }) {
  const [open,        setOpen]        = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentErr,  setCurrentErr]  = useState('');

  const {
    register, handleSubmit, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<PwForm>({ resolver: zodResolver(pwSchema) });

  const newPwd = watch('newPassword') ?? '';

  const selfSet = user.passwordSetBy === 'SELF' || !!user.passwordChangedAt;
  const changedDate = user.passwordChangedAt ? new Date(user.passwordChangedAt) : null;

  async function onSubmit(values: PwForm) {
    setCurrentErr('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        if (json.error?.toLowerCase().includes('current password')) {
          setCurrentErr(json.error);
        } else {
          toast.error(json.error ?? 'Failed to change password.');
        }
        return;
      }
      toast.success('Password changed successfully.');
      reset();
      setOpen(false);
    } catch {
      toast.error('Failed to change password.');
    }
  }

  return (
    <div>
      <div className="pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Password</h3>
      </div>

      {/* Status */}
      <div className="flex items-start gap-3 mb-4">
        {selfSet
          ? <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          : <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
        <div>
          {selfSet && changedDate && isValid(changedDate) ? (
            <>
              <p className="text-sm text-gray-700 dark:text-violet-200/70">
                Last changed {formatDistanceToNow(changedDate, { addSuffix: true })}
              </p>
              <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
                Set by you on {format(changedDate, 'dd MMM yyyy')}
              </p>
            </>
          ) : (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Your password was set by an admin. We recommend changing it to something only you know.
              </p>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setCurrentErr(''); reset(); }}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
      >
        {open ? 'Cancel' : 'Change Password'}
      </button>

      {/* Inline form */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4 max-w-sm">
              {/* Current password */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    {...register('currentPassword')}
                    className={cn(IC, (errors.currentPassword || currentErr) && 'border-status-absent')}
                  />
                  <button type="button" onClick={() => setShowCurrent((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {(errors.currentPassword?.message || currentErr) && (
                  <p className="text-xs text-status-absent mt-1">{currentErr || errors.currentPassword?.message}</p>
                )}
              </div>

              {/* New password */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    {...register('newPassword')}
                    placeholder="Min 8 characters"
                    className={cn(IC, errors.newPassword && 'border-status-absent')}
                  />
                  <button type="button" onClick={() => setShowNew((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthMeter password={newPwd} />
                {errors.newPassword && <p className="text-xs text-status-absent mt-1">{errors.newPassword.message}</p>}
              </div>

              {/* Confirm password */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    {...register('confirmPassword')}
                    className={cn(IC, errors.confirmPassword && 'border-status-absent')}
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-status-absent mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Update Password
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Locked-out info note */}
      <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-violet-300/45 mt-3">
        <Info className="w-3.5 h-3.5 shrink-0" />
        If you&apos;re locked out of your account, contact your administrator to reset your password.
      </p>
    </div>
  );
}

// ── Sessions section ──────────────────────────────────────────────────────────

function SessionsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['activeSessions'],
    queryFn:  async (): Promise<SessionEntry[]> => {
      const res = await fetch('/api/auth/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const json = await res.json() as { data: SessionEntry[] };
      return json.data;
    },
    staleTime: 1000 * 60,
  });

  const hasOthers = (data ?? []).some((s) => !s.isCurrent);

  return (
    <div>
      <div className="pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Active Sessions</h3>
        <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">Devices currently signed in to your account.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 animate-pulse">
              <div className="w-5 h-5 bg-gray-200 dark:bg-surface-dark-3 rounded shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-200 dark:bg-surface-dark-3 rounded w-40" />
                <div className="h-3 bg-gray-200 dark:bg-surface-dark-3 rounded w-56" />
              </div>
              <div className="h-5 bg-gray-200 dark:bg-surface-dark-3 rounded w-20" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-50 dark:divide-violet-900/50">
            {(data ?? []).map((session) => {
              const lastActive = new Date(session.lastActive);
              return (
                <div
                  key={session.id}
                  className={cn(
                    'flex items-center gap-4 py-3',
                    session.isCurrent && 'border-l-2 border-green-400 pl-3 -ml-3',
                  )}
                >
                  <Monitor className="w-5 h-5 text-gray-400 dark:text-violet-300/45 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{session.device}</p>
                    <p className="text-xs text-gray-400 dark:text-violet-300/45">
                      IP: {session.ip} · Last active: {isValid(lastActive) ? formatDistanceToNow(lastActive, { addSuffix: true }) : '—'}
                    </p>
                  </div>
                  {session.isCurrent ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 shrink-0">
                      Current session
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-status-absent hover:text-red-700 underline transition-colors duration-150 shrink-0"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {hasOthers && (
            <div className="flex justify-end mt-2">
              <button type="button" className="text-xs text-status-absent hover:underline transition-colors duration-150">
                Sign out of all other sessions
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Account info section ──────────────────────────────────────────────────────

function AccountSection({ user }: { user: MyProfile }) {
  const [showDialog, setShowDialog] = useState(false);

  const createdDate = user.createdAt ? new Date(user.createdAt) : null;

  const roleMap: Record<string, string> = {
    EMPLOYEE: 'bg-gray-100 text-gray-700 dark:bg-surface-dark-3 dark:text-violet-200/70',
    MANAGER:  'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    ADMIN:    'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  };
  const roleLabel: Record<string, string> = { EMPLOYEE: 'Employee', MANAGER: 'Manager', ADMIN: 'Admin' };

  return (
    <div>
      <div className="pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Account</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 mb-6">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Account Created</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {createdDate && isValid(createdDate) ? format(createdDate, 'd MMM yyyy') : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Role</p>
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', roleMap[user.role] ?? 'bg-gray-100 text-gray-600')}>
            {roleLabel[user.role] ?? user.role}
          </span>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Account Status</p>
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            user.isActive
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-surface-dark-3 dark:text-violet-300/55',
          )}>
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Portal Access</p>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Enabled
          </span>
        </div>
      </div>

      {/* Danger zone */}
      <div className="border border-red-200 dark:border-red-900/40 rounded-xl p-4 bg-red-50 dark:bg-red-950/10">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</p>
        <p className="text-xs text-red-400 dark:text-red-500 mt-1 mb-3">
          Account deactivation must be requested through your HR administrator.
        </p>
        <button
          type="button"
          onClick={() => setShowDialog(true)}
          className="px-3 py-1.5 text-xs font-medium border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors duration-150"
        >
          Request deactivation
        </button>
      </div>

      {/* Deactivation dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDialog(false)} />
          <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Request Account Deactivation</h3>
              <button type="button" onClick={() => setShowDialog(false)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-150">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-violet-300/55">
              To request account deactivation, please contact your HR admin or send an email to{' '}
              <a href="mailto:hr@yourcompany.com" className="text-violet-600 dark:text-violet-400 hover:underline">
                hr@yourcompany.com
              </a>
            </p>
            <button
              type="button"
              onClick={() => setShowDialog(false)}
              className="mt-4 w-full px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-surface-dark-3 text-gray-700 dark:text-violet-200/70 rounded-lg hover:bg-gray-200 dark:hover:bg-surface-dark-3 transition-colors duration-150"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface SecurityTabProps {
  user: MyProfile;
}

export function SecurityTab({ user }: SecurityTabProps) {
  return (
    <div className="space-y-8">
      <PasswordSection user={user} />
      <div className="border-t border-gray-100 dark:border-violet-900/40" />
      <SessionsSection />
      <div className="border-t border-gray-100 dark:border-violet-900/40" />
      <AccountSection user={user} />
    </div>
  );
}
