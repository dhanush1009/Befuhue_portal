'use client';

import { Suspense, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, User, Shield, Bell, Palette, Building2, Plug, Bot, Check, ImagePlus, X, Eye, EyeOff, Quote as QuoteIcon, Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { ConnectLLMTab } from '@/components/settings/ConnectLLMTab';
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useEmployee, useUpdateEmployee } from '@/hooks/useEmployees';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { getInitials, cn } from '@/lib/utils';
import { updateOwnProfileSchema, type UpdateOwnProfileInput } from '@/lib/validations/employee';
import { useUIStore, type Theme } from '@/store/useUIStore';
import { LEAVE_TYPES, LEAVE_ALLOWANCES } from '@/lib/constants';
import { useCompanySettings, useUpdateCompanySettings } from '@/hooks/useCompanySettings';
import { SlackCard, SlackMyToggle } from '@/components/settings/SlackCard';
import { useSession } from 'next-auth/react';

// ── Types ─────────────────────────────────────────────────────────────────────

type SettingsTab = 'profile' | 'security' | 'notifications' | 'appearance' | 'company' | 'integrations' | 'connectLLM';

const securitySchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword:     z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

type SecurityInput = z.infer<typeof securitySchema>;

// ── Shared input class ────────────────────────────────────────────────────────

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1',
        checked ? 'bg-brand' : 'bg-gray-200 dark:bg-surface-dark-3',
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
        checked ? 'translate-x-4' : 'translate-x-0',
      )} />
    </button>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuth();
  const { update: updateSession } = useSession();
  const { data: employee, isLoading } = useEmployee(user?.id ?? null);
  const update = useUpdateEmployee(user?.id ?? '');
  const queryClient = useQueryClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(undefined);

  const { register, handleSubmit, setValue, formState: { errors, isDirty } } = useForm<UpdateOwnProfileInput>({
    resolver: zodResolver(updateOwnProfileSchema),
    values: { name: employee?.name ?? '', phone: employee?.phone ?? '', avatarUrl: employee?.avatarUrl ?? '' },
  });

  if (isLoading || !employee) return <SkeletonCard className="h-64" />;

  const displayAvatarUrl = avatarUrl !== undefined ? avatarUrl : employee.avatarUrl;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h2>
        {/* Avatar */}
        <div className="flex items-center gap-6 mb-6 pb-6 border-b border-gray-100 dark:border-violet-900/40">
          <AvatarUpload
            currentAvatarUrl={displayAvatarUrl ?? null}
            userName={employee.name}
            size="lg"
            onUploadComplete={(url) => {
              setAvatarUrl(url);
              setValue('avatarUrl', url ?? '', { shouldDirty: false });
              queryClient.invalidateQueries({ queryKey: ['employees', user?.id] });
              queryClient.invalidateQueries({ queryKey: ['employees'] });
              queryClient.invalidateQueries({ queryKey: ['myProfile'] });
              void updateSession({ avatarUrl: url });
            }}
          />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{employee.name}</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">{employee.designation ?? employee.department ?? ''}</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-2">JPG, PNG or WebP · Max 10 MB</p>
          </div>
        </div>
        {/* Form */}
        <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Full Name</label>
              <input {...register('name')} className={IC} />
              {errors.name && <p className="text-xs text-status-absent mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Work Email</label>
              <input value={employee.email} disabled className={`${IC} opacity-50 cursor-not-allowed`} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Phone</label>
              <input {...register('phone')} className={IC} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Designation</label>
              <input value={employee.designation ?? ''} disabled className={`${IC} opacity-50 cursor-not-allowed`} />
            </div>
          </div>
          <button type="submit" disabled={update.isPending || !isDirty} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]">
            {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Security tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const { user } = useAuth();
  const { data: employee } = useEmployee(user?.id ?? null);
  const [saving,      setSaving]      = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<SecurityInput>({
    resolver: zodResolver(securitySchema),
  });

  const newPwd = watch('newPassword') ?? '';

  async function onSubmit(data: SecurityInput) {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
      toast.success('Password changed successfully.');
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  const pwdIC = (hasErr: boolean) => cn(IC, 'pr-11', hasErr ? 'border-status-absent' : '');

  const lastChanged = (employee as (typeof employee & { passwordChangedAt?: string | null }) | null)?.passwordChangedAt;
  const setBy       = (employee as (typeof employee & { passwordSetBy?: string | null }) | null)?.passwordSetBy;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Change Password</h2>
        <p className="text-xs text-gray-400 dark:text-violet-300/45 mb-5">Only applies if you signed in with email and password.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
          {/* Current password */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Current Password</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} {...register('currentPassword')} className={pwdIC(!!errors.currentPassword)} />
              <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && <p className="text-xs text-status-absent mt-1">{errors.currentPassword.message}</p>}
          </div>

          {/* New password */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} {...register('newPassword')} className={pwdIC(!!errors.newPassword)} placeholder="Min 8 characters" />
              <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={newPwd} />
            {errors.newPassword && <p className="text-xs text-status-absent mt-1">{errors.newPassword.message}</p>}
          </div>

          {/* Confirm password */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Confirm New Password</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} {...register('confirmPassword')} className={pwdIC(!!errors.confirmPassword)} placeholder="Re-enter password" />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors duration-150">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-status-absent mt-1">{errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Update Password
          </button>
        </form>

        {(lastChanged ?? setBy) && (
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-4">
            {lastChanged && <>Last changed: {new Date(lastChanged).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
            {lastChanged && setBy && ' · '}
            {setBy && <>Set by: {setBy === 'ADMIN' ? 'Admin' : 'You'}</>}
          </p>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-violet-900/40 pt-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Two-Factor Authentication</h2>
        <p className="text-xs text-gray-400 dark:text-violet-300/45">Two-factor authentication coming soon.</p>
      </div>
    </div>
  );
}

// ── Notifications tab ─────────────────────────────────────────────────────────

const NOTIF_GROUPS = [
  {
    label: 'Leave',
    items: [
      { key: 'leave_approved',    label: 'My leave approved or rejected',       desc: 'Get notified when your leave request is actioned.' },
      { key: 'team_leave_apply',  label: 'Team member applies leave',           desc: 'Managers only — when a direct report applies leave.', managerOnly: true },
    ],
  },
  {
    label: 'Tasks',
    items: [
      { key: 'task_assigned',     label: 'Task assigned to me',                 desc: 'When a task is assigned to you.' },
      { key: 'task_mentioned',    label: 'Task mentioned me',                   desc: 'When you are mentioned in a task comment.' },
      { key: 'task_due_reminder', label: 'Task due tomorrow reminder',          desc: 'Daily reminder for tasks due the next day.' },
    ],
  },
  {
    label: 'Announcements',
    items: [
      { key: 'new_announcement',  label: 'New announcement posted',             desc: 'When a company announcement is published.' },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'system_alerts',     label: 'System maintenance alerts',           desc: 'Scheduled downtime and maintenance notices.' },
    ],
  },
];

function NotificationsTab() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    leave_approved: true, task_assigned: true,
    task_mentioned: true, task_due_reminder: true, new_announcement: true, system_alerts: false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success('Notification preferences saved.');
  }

  return (
    <div className="space-y-6">
      <SlackMyToggle />
      {NOTIF_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-3">{group.label}</p>
          <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 divide-y divide-gray-50 dark:divide-violet-900/25">
            {group.items.filter((i) => !i.managerOnly).map((item) => (
              <div key={item.key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">{item.desc}</p>
                </div>
                <Toggle checked={prefs[item.key] ?? false} onChange={(v) => setPrefs((p) => ({ ...p, [item.key]: v }))} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]">
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Preferences
      </button>
    </div>
  );
}

// ── Appearance tab ────────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme } = useUIStore();

  const themes: { value: Theme; label: string; bg: string; preview: string }[] = [
    { value: 'light',  label: 'Light',  bg: 'bg-white',        preview: 'bg-gray-100' },
    { value: 'dark',   label: 'Dark',   bg: 'bg-canvas-dark',  preview: 'bg-surface-dark-3' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Theme</h2>
        <div className="flex gap-4">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                'flex flex-col items-center gap-2 p-1 rounded-xl border-2 transition-colors duration-150',
                theme === t.value ? 'border-brand' : 'border-gray-200 dark:border-violet-900/40 hover:border-gray-300 dark:hover:border-violet-800/40',
              )}
            >
              {/* Preview thumbnail */}
              <div className={cn('w-28 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-violet-900/40', t.bg)}>
                <div className="flex h-full">
                  <div className={cn('w-8 h-full', t.value === 'dark' ? 'bg-sidebar-bg' : 'bg-gray-200')} />
                  <div className="flex-1 p-2 space-y-1.5">
                    <div className={cn('h-2 rounded', t.preview)} />
                    <div className={cn('h-2 rounded w-3/4', t.preview)} />
                    <div className={cn('h-2 rounded w-1/2', t.preview)} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {theme === t.value && <Check className="w-3 h-3 text-brand" />}
                <span className="text-xs font-medium text-gray-700 dark:text-violet-200/70">{t.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Motivational Quotes section (inside CompanyTab) ─────────────────────────

interface AdminQuote {
  id:        string;
  text:      string;
  author:    string | null;
  isSystem:  boolean;
  isActive:  boolean;
  addedBy:   { id: string; name: string; avatarUrl: string | null } | null;
  createdAt: string;
}

const quoteFormSchema = z.object({
  text:   z.string().min(10, 'At least 10 characters.').max(300, 'Max 300 characters.'),
  author: z.string().max(100).optional(),
});
type QuoteFormInput = z.infer<typeof quoteFormSchema>;

function QuoteFormModal({
  open, onClose, initial,
}: {
  open:     boolean;
  onClose:  () => void;
  initial?: AdminQuote;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<QuoteFormInput>({
    resolver: zodResolver(quoteFormSchema),
    values: { text: initial?.text ?? '', author: initial?.author ?? '' },
  });

  const textLen = watch('text')?.length ?? 0;

  const save = useMutation({
    mutationFn: async (data: QuoteFormInput) => {
      const url    = isEdit ? `/api/admin/quotes/${initial!.id}` : '/api/admin/quotes';
      const method = isEdit ? 'PATCH' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.text, author: data.author || null }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to save quote');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-quotes'] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
      toast.success(isEdit ? 'Quote updated.' : 'Quote added.');
      reset();
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save quote'),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Quote' : 'Add Quote'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">
              Quote Text <span className="normal-case text-gray-400">({textLen}/300)</span>
            </label>
            <textarea
              {...register('text')}
              rows={4}
              placeholder="Enter an inspiring quote..."
              className={`${IC} resize-none`}
            />
            {errors.text && <p className="text-xs text-status-absent mt-1">{errors.text.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">
              Author <span className="normal-case text-gray-400">(optional)</span>
            </label>
            <input
              {...register('author')}
              placeholder="e.g. Steve Jobs"
              className={IC}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-violet-200/70 border border-gray-200 dark:border-violet-900/40 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
              Cancel
            </button>
            <button type="submit" disabled={save.isPending} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]">
              {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuotesSection() {
  const qc = useQueryClient();
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTarget,   setEditTarget]   = useState<AdminQuote | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AdminQuote | null>(null);

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['admin-quotes'],
    queryFn: async () => {
      const res = await fetch('/api/admin/quotes');
      if (!res.ok) throw new Error('Failed to fetch quotes');
      const json = await res.json() as { data: AdminQuote[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update quote');
    },
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: ['admin-quotes'] });
      const prev = qc.getQueryData<AdminQuote[]>(['admin-quotes']);
      qc.setQueryData<AdminQuote[]>(['admin-quotes'], (old) =>
        old?.map((q) => q.id === id ? { ...q, isActive } : q) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin-quotes'], ctx.prev);
      toast.error('Failed to update quote.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin-quotes'] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/quotes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete quote');
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-quotes'] });
      const prev = qc.getQueryData<AdminQuote[]>(['admin-quotes']);
      qc.setQueryData<AdminQuote[]>(['admin-quotes'], (old) =>
        old?.filter((q) => q.id !== id) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin-quotes'], ctx.prev);
      toast.error('Failed to delete quote.');
    },
    onSuccess: () => {
      toast.success('Quote deleted.');
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin-quotes'] }),
  });

  const systemQuotes = quotes?.filter((q) => q.isSystem)  ?? [];
  const customQuotes = quotes?.filter((q) => !q.isSystem) ?? [];
  const totalActive  = quotes?.filter((q) => q.isActive).length ?? 0;

  function QuoteRow({ quote }: { quote: AdminQuote }) {
    return (
      <div className="flex items-start gap-3 border-b border-gray-50 dark:border-violet-900/50 last:border-0 py-3 px-2 rounded-lg hover:bg-gray-50/50 dark:hover:bg-surface-dark-3/20 transition-colors duration-150">
        {/* Active toggle */}
        <div className="pt-0.5 shrink-0">
          <Toggle
            checked={quote.isActive}
            onChange={(v) => toggleActive.mutate({ id: quote.id, isActive: v })}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm leading-snug line-clamp-2',
            quote.isActive
              ? 'text-gray-800 dark:text-violet-100/80 italic'
              : 'text-gray-400 dark:text-violet-300/45 line-through',
          )}>
            {quote.text}
          </p>
          {quote.author && (
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5 not-italic">— {quote.author}</p>
          )}
          {/* Tag pills */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {quote.isSystem && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-violet-300/55">
                <Lock className="w-2.5 h-2.5" /> System
              </span>
            )}
            {!quote.isActive && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                Inactive
              </span>
            )}
            {!quote.isSystem && quote.addedBy && (
              <span className="text-[10px] text-gray-400 dark:text-violet-300/45">
                Added by {quote.addedBy.name}
              </span>
            )}
          </div>
        </div>

        {/* Actions — custom quotes only */}
        {!quote.isSystem && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { setEditTarget(quote); setModalOpen(true); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-violet-200/70 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"
              title="Edit quote"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeleteTarget(quote)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-150"
              title="Delete quote"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 dark:border-violet-900/40 pt-6">
      {/* Section header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Motivational Quotes</h2>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">Quotes shown to all employees on their dashboard.</p>
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setModalOpen(true); }}
          className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98] shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Quote
        </button>
      </div>

      {/* Stats strip */}
      {quotes && (
        <p className="text-xs text-gray-400 dark:text-violet-300/45 mb-4">
          {quotes.length} total
          <span className="mx-1.5">·</span>
          {totalActive} active
          <span className="mx-1.5">·</span>
          {systemQuotes.length} system defaults
        </p>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 py-3 px-2">
              <div className="w-9 h-5 bg-gray-200 dark:bg-surface-dark-3 rounded-full animate-pulse shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-surface-dark-3 rounded animate-pulse w-full" />
                <div className="h-3 bg-gray-200 dark:bg-surface-dark-3 rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quote list */}
      {!isLoading && quotes && (
        <div>
          {/* Custom quotes */}
          {customQuotes.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1 px-2">
                Custom Quotes ({customQuotes.length})
              </p>
              {customQuotes.map((q) => <QuoteRow key={q.id} quote={q} />)}
            </div>
          )}

          {/* Empty state — no custom quotes */}
          {customQuotes.length === 0 && (
            <div className="flex flex-col items-center py-6 text-center">
              <QuoteIcon className="w-8 h-8 text-gray-200 dark:text-violet-400/35 mb-2" />
              <p className="text-sm font-medium text-gray-500 dark:text-violet-300/55">No custom quotes yet.</p>
              <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">Add your own inspiring quotes to motivate your team.</p>
              <button
                onClick={() => { setEditTarget(undefined); setModalOpen(true); }}
                className="mt-3 text-xs font-medium text-brand hover:underline"
              >
                + Add your first quote
              </button>
            </div>
          )}

          {/* System quotes */}
          {systemQuotes.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1 px-2">
                System Defaults ({systemQuotes.length})
              </p>
              {systemQuotes.map((q) => <QuoteRow key={q.id} quote={q} />)}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit modal */}
      <QuoteFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined); }}
        initial={editTarget}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this quote?"
        description={deleteTarget ? `"${deleteTarget.text.slice(0, 60)}${deleteTarget.text.length > 60 ? '…' : ''}"` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteTarget) deleteQuote.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ── Company Settings tab (ADMIN only) ─────────────────────────────────────────

function CompanyTab() {
  const { data: settings, isLoading } = useCompanySettings();
  const update = useUpdateCompanySettings();
  const logoRef = useRef<HTMLInputElement>(null);

  const [name,           setName]           = useState('');
  const [address,        setAddress]        = useState('');
  const [payslipFooter,  setPayslipFooter]  = useState('');
  const [logoPreview,    setLogoPreview]    = useState<string | null>(null);
  const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null | undefined>(undefined);
  const [uploadingLogo,  setUploadingLogo]  = useState(false);

  // Seed local state once settings load
  useEffect(() => {
    if (settings && name === '') {
      setName(settings.name);
      setAddress(settings.address ?? '');
      setPayslipFooter(settings.payslipFooter ?? `Powered by ${settings.name} Payroll`);
    }
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Only JPG, PNG, or WebP allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5 MB.'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append('file',    file);
      form.append('purpose', 'company-logo');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) { const err = await res.json() as { error: string }; throw new Error(err.error); }
      const json = await res.json() as { data: { url: string } };
      setPendingLogoUrl(json.data.url);
      toast.success('Logo uploaded — click Save to apply.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
      setLogoPreview(null);
      setPendingLogoUrl(undefined);
    } finally {
      setUploadingLogo(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  }

  function handleRemoveLogo() {
    setLogoPreview(null);
    setPendingLogoUrl(null); // null = explicitly clear
  }

  function handleSave() {
    const payload: { name?: string; logoUrl?: string | null; address?: string | null; payslipFooter?: string | null } = {};
    if (name !== settings?.name)                                     payload.name          = name;
    if (address !== (settings?.address ?? ''))                       payload.address       = address || null;
    if (payslipFooter !== (settings?.payslipFooter ?? ''))           payload.payslipFooter = payslipFooter || null;
    if (pendingLogoUrl !== undefined)                                payload.logoUrl       = pendingLogoUrl;
    if (Object.keys(payload).length === 0) { toast.info('No changes to save.'); return; }
    update.mutate(payload, {
      onSuccess: () => {
        setPendingLogoUrl(undefined);
        setLogoPreview(null);
      },
    });
  }

  if (isLoading || !settings) return <SkeletonCard className="h-48" />;

  const displayLogo = logoPreview ?? settings.logoUrl;
  const isDirty     = name !== settings.name
    || pendingLogoUrl !== undefined
    || address !== (settings.address ?? '')
    || payslipFooter !== (settings.payslipFooter ?? '');

  const leavePolicies = LEAVE_TYPES.map((lt) => ({
    type:      lt.label,
    value:     lt.value,
    allowance: LEAVE_ALLOWANCES[lt.value] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Company Information</h2>
        <div className="max-w-sm space-y-5">
          {/* Logo upload */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2 block">Company Logo</label>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-violet-900/40 bg-gray-50 dark:bg-surface-dark-3 flex items-center justify-center overflow-hidden shrink-0">
                {displayLogo
                  ? <img src={displayLogo} alt="Company logo" className="w-full h-full object-contain p-1" />
                  : <ImagePlus className="w-6 h-6 text-gray-300 dark:text-violet-400/35" />}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => logoRef.current?.click()} disabled={uploadingLogo} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-60 transition-colors duration-150">
                  <ImagePlus className="w-4 h-4" /> {displayLogo ? 'Change logo' : 'Upload logo'}
                </button>
                {displayLogo && (
                  <button type="button" onClick={handleRemoveLogo} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-status-absent hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors duration-150">
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
              <input ref={logoRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleLogoChange} />
            </div>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-2">JPG, PNG or WebP · Max 5 MB · Stored on AWS S3</p>
          </div>

          {/* Company name */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Company Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={IC} />
          </div>
        </div>
      </div>

      {/* ── Payroll Settings ── */}
      <div className="border-t border-gray-100 dark:border-violet-900/40 pt-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Payroll Settings</h2>
        <p className="text-xs text-gray-400 dark:text-violet-300/45 mb-4">These details appear on employee payslips.</p>
        <div className="max-w-md space-y-4">
          {/* Company address */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Company Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="6/162 periyar nagar, karur, Tamil Nadu 639005"
              className={`${IC} resize-none`}
            />
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">Shown in the payslip header.</p>
          </div>

          {/* Payslip footer */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Payslip Footer Text</label>
            <input
              value={payslipFooter}
              onChange={(e) => setPayslipFooter(e.target.value)}
              placeholder={`Powered by ${name || 'Deep Impression'} Payroll`}
              className={IC}
            />
          </div>

          {/* Working days — display only */}
          <div className="bg-gray-50 dark:bg-surface-dark-3/50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Business Rules (Fixed)</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-violet-200/70">Working Days</span>
              <span className="font-medium text-gray-900 dark:text-white">Monday to Saturday</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-violet-200/70">Holiday</span>
              <span className="font-medium text-gray-900 dark:text-white">Sunday only</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-violet-200/70">Earned Leave Policy</span>
              <span className="font-medium text-gray-900 dark:text-white">1 EL per month per employee</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-violet-900/40 pt-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Leave Policy</h2>
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider bg-gray-50 dark:bg-surface-dark-3/50 border-b border-gray-100 dark:border-violet-900/40">
              <tr>
                <th className="px-5 py-3 text-left">Leave Type</th>
                <th className="px-5 py-3 text-left">Annual Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-violet-900/25">
              {leavePolicies.map((p) => (
                <tr key={p.value}>
                  <td className="px-5 py-3 text-gray-900 dark:text-white">{p.type}</td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      defaultValue={p.allowance}
                      min={0}
                      className="w-20 px-2 py-1 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button onClick={handleSave} disabled={update.isPending || !isDirty} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]">
        {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Settings
      </button>

      {/* ── Motivational Quotes ── */}
      <QuotesSection />
    </div>
  );
}

// ── Integrations tab (ADMIN only) ─────────────────────────────────────────────

function IntegrationsTab() {
  return (
    <div className="space-y-4">
      <SlackCard />
      {[
        { name: 'Supabase',      desc: 'File storage for documents and avatars.',  status: 'Connected' },
        { name: 'Resend',        desc: 'Transactional email for notifications.',   status: 'Configured' },
      ].map((integration) => (
        <div key={integration.name} className="flex items-center justify-between bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{integration.name}</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">{integration.desc}</p>
          </div>
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            integration.status === 'Connected' || integration.status === 'Configured'
              ? 'bg-green-50 text-status-present dark:bg-green-900/20'
              : 'bg-gray-100 text-gray-500 dark:bg-surface-dark-3 dark:text-violet-300/55',
          )}>
            {integration.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Settings page ────────────────────────────────────────────────────────

const NAV_ITEMS: { id: SettingsTab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: 'profile',       label: 'Profile',            icon: User },
  { id: 'security',      label: 'Account & Security', icon: Shield },
  { id: 'notifications', label: 'Notifications',      icon: Bell },
  { id: 'appearance',    label: 'Appearance',          icon: Palette },
  { id: 'connectLLM',    label: 'Connect LLM',        icon: Bot,       adminOnly: true },
  { id: 'company',       label: 'Company Settings',   icon: Building2, adminOnly: true },
  { id: 'integrations',  label: 'Integrations',       icon: Plug,      adminOnly: true },
];

function SettingsInner() {
  const { isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams?.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabFromUrl ?? 'profile');

  const visibleNav = NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageHeader title="Settings" description="Manage your account and company preferences." />

      <div className="flex gap-6">
        {/* Left sub-nav */}
        <nav className="hidden sm:flex flex-col gap-0.5 w-48 shrink-0">
          {visibleNav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 text-left w-full',
                activeTab === id
                  ? 'bg-brand-light text-brand dark:bg-violet-900/30 dark:text-violet-300'
                  : 'text-gray-600 dark:text-violet-300/55 hover:bg-gray-100 dark:hover:bg-surface-dark-3 hover:text-gray-900 dark:hover:text-white',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Mobile tab select */}
        <div className="sm:hidden w-full mb-4">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as SettingsTab)}
            className={IC}
          >
            {visibleNav.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-6">
          {activeTab === 'profile'       && <ProfileTab />}
          {activeTab === 'security'      && <SecurityTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'appearance'    && <AppearanceTab />}
          {activeTab === 'connectLLM'    && isAdmin && <ConnectLLMTab />}
          {activeTab === 'company'       && isAdmin && <CompanyTab />}
          {activeTab === 'integrations'  && isAdmin && <IntegrationsTab />}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsInner />
    </Suspense>
  );
}
