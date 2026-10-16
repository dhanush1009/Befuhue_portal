import { cn } from '@/lib/utils';

function Bone({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 dark:bg-surface-dark-3 rounded animate-pulse', className)} />;
}

export function ProfileCardSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 sticky top-6">

      {/* Avatar + completeness + name */}
      <div className="flex flex-col items-center pt-1 gap-3">
        <Bone className="w-[120px] h-[120px] rounded-full" />
        {/* Completeness bar */}
        <div className="w-full space-y-1.5">
          <div className="flex justify-between">
            <Bone className="h-3 w-32" />
            <Bone className="h-3 w-8" />
          </div>
          <Bone className="h-2 w-full rounded-full" />
          <Bone className="h-3 w-40" />
        </div>
        <Bone className="h-5 w-36" />
        <Bone className="h-4 w-24" />
        <Bone className="h-6 w-20 rounded-full" />
        {/* Status */}
        <div className="flex items-center gap-2">
          <Bone className="w-2 h-2 rounded-full" />
          <Bone className="h-3 w-28" />
          <Bone className="h-5 w-16 rounded-full" />
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-violet-900/40 my-4" />

      {/* Quick info rows */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Bone className="w-4 h-4 rounded shrink-0" />
            <Bone className="h-3 flex-1" />
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 dark:border-violet-900/40 my-4" />

      {/* Leave balances */}
      <div className="space-y-2">
        <Bone className="h-3 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bone className="w-2 h-2 rounded-full" />
              <Bone className="h-3 w-24" />
            </div>
            <Bone className="h-3 w-12" />
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 dark:border-violet-900/40 my-4" />

      {/* Attendance chips */}
      <div className="space-y-2">
        <Bone className="h-3 w-20" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Bone key={i} className="flex-1 h-14 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
