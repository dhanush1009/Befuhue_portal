import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn('bg-white dark:bg-surface-dark-2 border border-slate-200 dark:border-violet-900/30 rounded-xl p-5 animate-pulse cursor-wait', className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-surface-dark-3" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-200 dark:bg-surface-dark-3 rounded w-1/3" />
          <div className="h-2 bg-slate-100 dark:bg-surface-dark-3 rounded w-1/2" />
        </div>
      </div>
      <div className="h-7 bg-slate-200 dark:bg-surface-dark-3 rounded w-1/2 mb-2" />
      <div className="h-2 bg-slate-100 dark:bg-surface-dark-3 rounded w-3/4" />
    </div>
  );
}
