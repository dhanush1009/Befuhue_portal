import { cn } from '@/lib/utils';
import type { LeaveBalanceItem } from '@/hooks/useLeaves';

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  EARNED:   { label: 'Earned Leave',    color: 'text-brand',          bg: 'bg-brand/10',          bar: 'bg-brand' },
  CASUAL:   { label: 'Casual Leave',    color: 'text-teal-600',       bg: 'bg-teal-50 dark:bg-teal-900/20',  bar: 'bg-teal-500' },
  SICK:     { label: 'Sick Leave',      color: 'text-status-wfh',     bg: 'bg-status-wfh/10',     bar: 'bg-status-wfh' },
  LOP:      { label: 'Loss of Pay',     color: 'text-status-absent',  bg: 'bg-status-absent/10',  bar: 'bg-status-absent' },
  COMP_OFF: { label: 'Comp Off',        color: 'text-status-leave',   bg: 'bg-status-leave/10',   bar: 'bg-status-leave' },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function LeaveBalanceCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4 animate-pulse">
          <div className="w-20 h-3 bg-gray-200 dark:bg-surface-dark-3 rounded mb-3" />
          <div className="w-10 h-8 bg-gray-200 dark:bg-surface-dark-3 rounded mb-2" />
          <div className="w-full h-1.5 bg-gray-100 dark:bg-surface-dark-3 rounded-full" />
          <div className="w-24 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LeaveBalanceCardsProps {
  balances: LeaveBalanceItem[];
}

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {balances.map((b) => {
        const cfg = TYPE_CONFIG[b.type] ?? {
          label: b.type, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-surface-dark-3', bar: 'bg-gray-400',
        };
        const pct = b.allowance > 0 ? Math.min((b.used / b.allowance) * 100, 100) : 0;

        return (
          <div
            key={b.type}
            className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4 hover:border-violet-200 dark:hover:border-violet-500 transition-colors duration-150"
          >
            <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">
              {cfg.label}
            </p>
            <p className={cn('text-2xl font-semibold tabular-nums', cfg.color)}>
              {b.remaining}
            </p>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-surface-dark-3 rounded-full overflow-hidden mt-2 mb-1.5">
              <div
                className={cn('h-full rounded-full transition-all duration-500', cfg.bar)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-violet-300/45">
              used {b.used} / {b.allowance} days
            </p>
          </div>
        );
      })}
    </div>
  );
}
