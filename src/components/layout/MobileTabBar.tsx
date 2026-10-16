'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, CheckSquare, Users, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/useUIStore';

const TABS = [
  { label: 'Dashboard', href: '/dashboard',  icon: LayoutDashboard },
  { label: 'My Time',   href: '/attendance', icon: CalendarDays },
  { label: 'Tasks',     href: '/tasks',      icon: CheckSquare },
  { label: 'People',    href: '/hr',         icon: Users },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const { setMobileMenuOpen } = useUIStore();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-violet-900/30 flex items-center safe-area-pb">
      {TABS.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors duration-150',
              isActive ? 'text-brand' : 'text-gray-400 dark:text-violet-300/50',
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
      {/* More button opens sidebar */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] text-gray-400 dark:text-violet-300/50 transition-colors duration-150"
      >
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-[10px] font-medium">More</span>
      </button>
    </nav>
  );
}
