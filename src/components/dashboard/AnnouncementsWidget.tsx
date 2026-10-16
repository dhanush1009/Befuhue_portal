'use client';

import Link from 'next/link';
import { ArrowRight, Megaphone } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';

export interface Announcement {
  id:        string;
  title:     string;
  preview:   string;
  author:    string;
  createdAt: string;
}

export function AnnouncementsWidgetSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 animate-pulse">
      <div className="w-32 h-4 bg-gray-200 dark:bg-surface-dark-3 rounded mb-4" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="py-3 border-b border-gray-50 dark:border-violet-900/40 last:border-0 space-y-2">
          <div className="w-3/4 h-3 bg-gray-200 dark:bg-surface-dark-3 rounded" />
          <div className="w-full h-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          <div className="w-1/2 h-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          <div className="w-24 h-2 bg-gray-100 dark:bg-surface-dark-3 rounded" />
        </div>
      ))}
    </div>
  );
}

interface AnnouncementsWidgetProps { announcements: Announcement[]; }

export function AnnouncementsWidget({ announcements }: AnnouncementsWidgetProps) {
  const visible = announcements.slice(0, 2);

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 hover:border-violet-300 dark:hover:border-violet-500 transition-colors duration-150">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Announcements</p>
        <Link href="/communication" className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover transition-colors duration-150">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="w-8 h-8 text-gray-300 dark:text-violet-400/35" />}
          title="No announcements"
          description="Company updates will appear here."
        />
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-violet-900/25 px-5 pb-4">
          {visible.map((item) => (
            <li key={item.id} className="py-3">
              <Link href="/communication" className="group block">
                <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-brand transition-colors duration-150 line-clamp-1">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-0.5 line-clamp-2">{item.preview}</p>
                <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1.5">{item.author} · {formatDate(item.createdAt, 'MMM d, yyyy')}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
