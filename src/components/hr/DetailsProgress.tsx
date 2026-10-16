'use client';

import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { useDetailsStatus } from '@/hooks/useEmployeeDetails';

/** Admin only: who still has to finish their HR details (bank, IDs, emergency contact...). */
export function DetailsProgress() {
  const { data } = useDetailsStatus(true);
  if (!data) return null;
  const pending = data.filter((d) => d.percent < 100).sort((a, b) => a.percent - b.percent);

  return (
    <div className="mb-6 rounded-2xl border border-gray-200/90 dark:border-white/10 bg-white dark:bg-surface-dark-2 p-4 shadow-xs">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="w-4 h-4 text-brand" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">
          {pending.length === 0 ? 'Everyone has completed their details' : `${pending.length} of ${data.length} people have incomplete details`}
        </p>
      </div>
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {pending.map((p) => (
            <Link key={p.userId} href={`/hr/${p.userId}`} title={`Still needed: ${p.missing.join(', ')}`}
              className="flex items-center gap-2 rounded-full border border-gray-200/90 dark:border-white/10 bg-gray-50/80 dark:bg-surface-dark-3 px-3 py-1 text-xs text-gray-700 dark:text-zinc-300 hover:border-brand/40 dark:hover:border-white/20 transition-colors shadow-2xs">
              {p.name}
              <span className="font-bold tabular-nums text-brand">{p.percent}%</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
