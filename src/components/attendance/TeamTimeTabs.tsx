'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/attendance/team',          label: 'Daily',    icon: CalendarDays  },
  { href: '/attendance/team/timeline', label: 'Timeline', icon: CalendarRange },
] as const;

/** Switches the admin between the one-day view and the full-month timeline. */
export function TeamTimeTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-surface-dark-3 rounded-lg p-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
              active
                ? 'bg-white dark:bg-surface-dark-2 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-violet-300/55 hover:text-gray-700 dark:hover:text-violet-100/80',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
