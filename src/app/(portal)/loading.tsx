import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { SkeletonTable } from '@/components/shared/SkeletonTable';

export default function PortalLoading() {
  return (
    <div className="max-w-6xl mx-auto pb-10 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 dark:bg-surface-dark-3 rounded" />
          <div className="h-4 w-72 bg-gray-100 dark:bg-surface-dark-3 rounded" />
        </div>
        <div className="h-9 w-32 bg-gray-200 dark:bg-surface-dark-3 rounded-lg" />
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40">
        <SkeletonTable rows={6} columns={5} />
      </div>
    </div>
  );
}
