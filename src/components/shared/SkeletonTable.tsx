interface SkeletonTableProps {
  rows?:    number;
  columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 5 }: SkeletonTableProps) {
  return (
    <div className="animate-pulse cursor-wait">
      {/* Header */}
      <div className="flex gap-4 px-6 py-4 border-b border-slate-100 dark:border-violet-900/30">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-200 dark:bg-surface-dark-3 rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-6 py-4 border-b border-slate-100 dark:border-violet-900/30">
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              className="h-4 bg-slate-100 dark:bg-surface-dark-3 rounded flex-1"
              style={{ opacity: 1 - j * 0.1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
