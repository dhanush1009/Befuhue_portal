import { cn } from '@/lib/utils';

function Bone({ className }: { className?: string }) {
  return <div className={cn('bg-gray-200 dark:bg-surface-dark-3 rounded animate-pulse', className)} />;
}

export default function ProfileLoading() {
  return (
    <div className="max-w-6xl mx-auto pb-10 flex flex-col md:flex-row gap-6">
      {/* Left column */}
      <div className="w-full md:w-80 shrink-0">
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <Bone className="w-[120px] h-[120px] rounded-full" />
            {/* Completeness bar */}
            <Bone className="h-2 w-full rounded-full" />
            <Bone className="h-3 w-32" />
            {/* Name / designation */}
            <Bone className="h-5 w-40" />
            <Bone className="h-4 w-28" />
            <Bone className="h-6 w-24 rounded-full" />
          </div>

          <div className="border-t border-gray-100 dark:border-violet-900/40" />

          {/* Quick info */}
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Bone className="w-4 h-4 rounded shrink-0" />
                <Bone className="h-3 flex-1" />
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-violet-900/40" />

          {/* Leave balances */}
          <div className="space-y-2">
            <Bone className="h-3 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Bone className="h-3 w-28" />
                <Bone className="h-3 w-12" />
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-violet-900/40" />

          {/* Attendance chips */}
          <div className="space-y-2">
            <Bone className="h-3 w-20" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Bone key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="flex-1 min-w-0 space-y-0">
        {/* Tab bar */}
        <div className="bg-white dark:bg-surface-dark-3 rounded-t-xl border border-gray-200 dark:border-violet-900/40 border-b-0 px-5 py-0 flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-10 w-24 my-2" />
          ))}
        </div>
        {/* Form */}
        <div className="bg-white dark:bg-surface-dark-3 rounded-b-xl border border-gray-200 dark:border-violet-900/40 p-6 space-y-6">
          <Bone className="h-4 w-32" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Bone className="h-3 w-20" />
                <Bone className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
          <Bone className="h-9 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
