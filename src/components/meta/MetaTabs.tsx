'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/meta-ads',          label: 'Performance', icon: BarChart3 },
  { href: '/meta-ads/accounts', label: 'Accounts',    icon: Settings2 },
] as const;

export function MetaTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-black/[0.05] p-1 dark:bg-white/[0.07]">
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}
          className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            pathname === href ? 'bg-white text-zinc-900 shadow-sm dark:bg-surface-dark-2 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')}>
          <Icon className="size-3.5" /> {label}
        </Link>
      ))}
    </div>
  );
}
