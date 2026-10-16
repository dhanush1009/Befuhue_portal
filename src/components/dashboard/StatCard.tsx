import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label:          string;
  value:          number | string;
  sub?:           string;
  subLabel?:      string;
  subLabelColor?: string;
  pulse?:         boolean;
  icon:           LucideIcon;
  accent:         string;
  trend?: { value: number; label: string };
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-surface-dark-3" />
        <div className="w-16 h-4 bg-gray-100 dark:bg-surface-dark-3 rounded" />
      </div>
      <div className="w-16 h-8 bg-gray-200 dark:bg-surface-dark-3 rounded mb-1" />
      <div className="w-24 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
    </div>
  );
}

export function StatCard({ label, value, sub, subLabel, subLabelColor, pulse, icon: Icon, accent, trend }: StatCardProps) {
  const isPositive = (trend?.value ?? 0) >= 0;

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 hover:border-violet-300 dark:hover:border-violet-500 transition-colors duration-150">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', accent)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            isPositive ? 'bg-green-50 dark:bg-green-900/20 text-status-present' : 'bg-red-50 dark:bg-red-900/20 text-status-absent',
          )}>
            {isPositive ? '+' : ''}{trend.value} {trend.label}
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-gray-600 dark:text-violet-300/55 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-violet-300/45 mt-0.5">{sub}</p>}
      {subLabel && (
        <div className="flex items-center gap-1 mt-1">
          {pulse && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
          <p className={cn('text-xs font-medium', subLabelColor ?? 'text-gray-500 dark:text-violet-300/45')}>{subLabel}</p>
        </div>
      )}
    </div>
  );
}
