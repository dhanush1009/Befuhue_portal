'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  href:      string;
  label:     string;
  icon:      LucideIcon;
  collapsed: boolean;
  onClick?:  () => void;
  /** Longer matches win, so /attendance/team does not also light up /attendance. */
  exact?:    boolean;
}

/** Whether `href` is the section the user is in (the most specific nav item wins). */
export function isActivePath(pathname: string | null, href: string, exact = false): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return !exact && href !== '/dashboard' && pathname.startsWith(href + '/');
}

export function SidebarItem({ href, label, icon: Icon, collapsed, onClick, exact }: SidebarItemProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href, exact);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors duration-150 active:scale-[0.99]',
        active
          ? 'bg-white/10 font-semibold text-white ring-1 ring-white/10 shadow-xs'
          : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white font-medium',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className={cn('size-[18px] shrink-0 transition-colors', active ? 'text-brand' : 'text-zinc-400 group-hover:text-zinc-200')} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
