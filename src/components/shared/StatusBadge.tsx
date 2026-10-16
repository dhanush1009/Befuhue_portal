import { cn } from '@/lib/utils';
import { TASK_STATUS_CONFIG } from '@/lib/taskStatusConfig';
import * as LucideIcons from 'lucide-react';
import type { TaskStatus } from '@prisma/client';

// ── Legacy non-task status map (leave, attendance, payroll, etc.) ─────────────

type LegacyStatus =
  | 'approved' | 'pending' | 'rejected' | 'cancelled'
  | 'active'   | 'inactive' | 'closed'
  | 'present'  | 'absent'   | 'late'    | 'wfh' | 'leave' | 'holiday'
  | 'draft'    | 'published' | 'void'
  | 'regularization-pending' | 'regularized' | 'regularization-rejected';

const LEGACY_MAP: Record<LegacyStatus, { label: string; className: string }> = {
  approved:   { label: 'Approved',   className: 'bg-status-present/10 text-status-present border-status-present/20' },
  pending:    { label: 'Pending',    className: 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20' },
  rejected:   { label: 'Rejected',   className: 'bg-status-absent/10 text-status-absent border-status-absent/20' },
  cancelled:  { label: 'Cancelled',  className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-surface-dark-3 dark:text-violet-300/55' },
  active:     { label: 'Active',     className: 'bg-blue-50 text-blue-600 border-blue-200' },
  inactive:   { label: 'Inactive',   className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-surface-dark-3 dark:text-violet-300/55' },
  closed:     { label: 'Closed',     className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-surface-dark-3 dark:text-violet-300/55' },
  present:    { label: 'Present',    className: 'bg-status-present/10 text-status-present border-status-present/20' },
  absent:     { label: 'Absent',     className: 'bg-status-absent/10 text-status-absent border-status-absent/20' },
  late:       { label: 'Late',       className: 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20' },
  wfh:        { label: 'WFH',        className: 'bg-status-wfh/10 text-status-wfh border-status-wfh/20' },
  leave:      { label: 'On Leave',   className: 'bg-status-leave/10 text-status-leave border-status-leave/20' },
  holiday:    { label: 'Holiday',    className: 'bg-status-holiday/10 text-status-holiday border-status-holiday/20' },
  draft:      { label: 'Draft',      className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-surface-dark-3 dark:text-violet-300/55' },
  published:  { label: 'Published',  className: 'bg-status-present/10 text-status-present border-status-present/20' },
  void:       { label: 'Void',       className: 'bg-status-absent/10 text-status-absent border-status-absent/20' },
  'regularization-pending':  { label: 'Reg. Pending',  className: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400' },
  regularized:               { label: 'Regularized',   className: 'bg-status-present/10 text-status-present border-orange-300' },
  'regularization-rejected': { label: 'Reg. Rejected', className: 'bg-status-absent/10 text-status-absent border-status-absent/20' },
};

// ── Task status keys (uppercase) ──────────────────────────────────────────────

const TASK_STATUS_KEYS = new Set<string>(Object.keys(TASK_STATUS_CONFIG));

// ── Props ─────────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status:     TaskStatus | string;
  size?:      'sm' | 'md';
  showIcon?:  boolean;
  className?: string;
}

export function StatusBadge({ status, size = 'md', showIcon = false, className }: StatusBadgeProps) {
  const upper = (status as string).toUpperCase();

  // Task status path
  if (TASK_STATUS_KEYS.has(upper)) {
    const cfg = TASK_STATUS_CONFIG[upper as TaskStatus];
    const IconComponent = LucideIcons[cfg.icon as keyof typeof LucideIcons] as React.FC<{ className?: string }> | undefined;

    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium border',
        cfg.bgColor, cfg.color, cfg.borderColor,
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        className,
      )}>
        {showIcon && IconComponent && (
          <IconComponent className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        )}
        {cfg.label}
      </span>
    );
  }

  // Legacy path
  const key = (status as string).toLowerCase() as LegacyStatus;
  const cfg = LEGACY_MAP[key] ?? { label: status as string, className: 'bg-slate-100 text-slate-600 border-slate-200' };

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border',
      cfg.className,
      className,
    )}>
      {cfg.label}
    </span>
  );
}
