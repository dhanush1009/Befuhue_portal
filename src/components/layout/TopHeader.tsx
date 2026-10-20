'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Bell, PanelLeft, Search, Settings, LogOut, User, ChevronDown, Sun, Moon, Eye } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useUIStore } from '@/store/useUIStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { NotificationCenter } from '@/components/layout/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useViewAsStore } from '@/store/useViewAsStore';

// ── Route → title map ─────────────────────────────────────────────────────────

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard':         'Dashboard',
  '/profile':           'Profile',
  '/attendance':        'My Time',
  '/attendance/leaves': 'Time Off',
  '/attendance/team':   'Team Time',
  '/attendance/team/timeline': 'Team Timeline',
  '/holidays':          'Holidays',
  '/clients':           'Client Directory',
  '/payslips':          'Payslips',
  '/payroll/admin':     'Payroll',
  '/reports':           'Reports',
  '/tasks':             'Task Board',
  '/projects':          'Projects',
  '/billing':           'Client & Agency Billing',
  '/hr':                'People Directory',
  '/communication':     'Workspace',
  '/approvals':         'Approvals',
  '/birthdays':         'Birthdays',
  '/vault':             'Passwords',
  '/settings':          'Settings',
  '/notifications':     'Notifications',
  '/leaves':            'Time Off',
};

/**
 * Derives the page title directly from the current pathname.
 * Tries exact match first, then longest-prefix match to handle
 * dynamic segments like /hr/[employeeId] → "People Directory".
 */
function resolveTitle(pathname: string): string {
  // 1. Exact match
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];

  // 2. Longest prefix match (avoids /attendance matching /attendance/leaves wrong)
  const match = Object.keys(ROUTE_TITLES)
    .filter((route) => pathname.startsWith(route + '/') || pathname === route)
    .sort((a, b) => b.length - a.length)[0]; // longest wins

  return match ? ROUTE_TITLES[match] : 'Befhue';
}

// ── Notification bell with shake animation ───────────────────────────────────

function NotificationBell() {
  const [open, setOpen]   = useState(false);
  const [shake, setShake] = useState(false);
  const { unreadCount }   = useNotificationStore();
  const prevCount = useRef(unreadCount);

  // Initialise notifications on mount
  useNotifications();

  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 600);
      return () => clearTimeout(t);
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative p-2 rounded-lg text-gray-500 dark:text-violet-300/70 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]',
          shake && 'animate-bell-shake',
        )}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 bg-status-absent text-white text-[9px] font-semibold rounded-full flex items-center justify-center px-0.5 border border-white dark:border-surface-dark">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {typeof document !== 'undefined' && createPortal(
        <NotificationCenter open={open} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  );
}

// ── Theme toggle button ───────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, toggleTheme } = useUIStore();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded-lg text-gray-500 dark:text-violet-300/70 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]"
    >
      {isDark
        ? <Sun  className="w-4 h-4 text-amber-400" />
        : <Moon className="w-4 h-4" />}
    </button>
  );
}

// ── User dropdown ─────────────────────────────────────────────────────────────

interface UserDropdownProps {
  name:      string;
  role:      string;
  avatarUrl: string | null | undefined;
  initials:  string;
  /** A real Admin (even mid-preview) can open the "View as" picker. */
  canPreview: boolean;
}

function UserDropdown({ name, role, avatarUrl, initials, canPreview }: UserDropdownProps) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const setPickerOpen = useViewAsStore((s) => s.setPickerOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-3 border-l border-gray-200 dark:border-violet-900/30 hover:opacity-80 transition-opacity duration-150 active:scale-[0.98]"
      >
        <div className="hidden md:flex flex-col items-end">
          <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{name}</span>
          <span className="text-xs text-gray-400 dark:text-violet-300/60 leading-tight capitalize">{role.toLowerCase()}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-brand-light dark:bg-brand/20 text-brand flex items-center justify-center text-xs font-semibold overflow-hidden border border-brand/20 shrink-0">
          {avatarUrl && !imgError
            ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
            : initials}
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 dark:text-violet-300/50 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-xl shadow-lg shadow-black/5 dark:shadow-black/40 py-1 z-50">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-violet-900/30">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/60 truncate capitalize">{role.toLowerCase()}</p>
          </div>

          <a
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-violet-100/90 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
          >
            <User className="w-4 h-4 text-gray-400 dark:text-violet-300/60" />
            Profile
          </a>
          <a
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-violet-100/90 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
          >
            <Settings className="w-4 h-4 text-gray-400 dark:text-violet-300/60" />
            Settings
          </a>

          {canPreview && (
            <button
              onClick={() => { setOpen(false); setPickerOpen(true); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-violet-100/90 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
            >
              <Eye className="w-4 h-4 text-gray-400 dark:text-violet-300/60" />
              View as employee…
            </button>
          )}

          <div className="border-t border-gray-100 dark:border-violet-900/30 mt-1 pt-1">
            <button
              onClick={async () => {
                setOpen(false);
                try {
                  await signOut({ redirect: false });
                } catch {
                  // Ignore network errors on session clear
                }
                window.location.href = '/login';
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-status-absent hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors duration-150"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TopHeader ─────────────────────────────────────────────────────────────────

export function TopHeader() {
  // The effective user: while an Admin previews the portal as someone, this is that person.
  const { user: effectiveUser, realIsAdmin } = useAuth();
  const su = (effectiveUser ?? undefined) as Record<string, unknown> | undefined;

  const pathname    = usePathname();
  const { setMobileMenuOpen, toggleSidebar } = useUIStore();

  // Always derive title from pathname — never rely on Zustand currentPageTitle
  // which is never updated by pages and defaults to 'Dashboard'.
  const pageTitle = resolveTitle(pathname ?? '/dashboard');

  const name      = (su?.name      as string | undefined) ?? 'User';
  const role      = (su?.role      as string | undefined) ?? 'EMPLOYEE';
  const avatarUrl = (su?.avatarUrl as string | null | undefined) ?? null;
  const initials  = getInitials(name);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-gray-200/80 bg-white/95 px-4 backdrop-blur-md dark:border-white/10 dark:bg-surface-dark/80 lg:px-5">

      {/* Sidebar toggle: opens the drawer on a phone, collapses the sidebar on a desktop */}
      <button
        onClick={() => {
          if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) toggleSidebar();
          else setMobileMenuOpen(true);
        }}
        className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-black/5 hover:text-zinc-900 active:scale-[0.97] dark:hover:bg-white/10 dark:hover:text-white"
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="size-[18px]" />
      </button>
      <div className="hidden h-5 w-px bg-gray-200 dark:bg-white/10 md:block" />

      {/* Page title */}
      <h1 className="hidden shrink-0 truncate text-sm font-bold text-gray-900 dark:text-white md:block">
        {pageTitle}
      </h1>

      {/* Search — grows to fill center */}
      <div className="flex-1 flex justify-center px-2">
        <div className="relative w-full max-w-sm hidden md:block">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
            <Search className="w-4 h-4 text-gray-400 dark:text-violet-300/50" />
          </div>
          <input
            type="text"
            className="h-9 w-full rounded-lg border border-gray-200/90 bg-gray-50/80 pl-9 pr-14 text-sm text-gray-900 transition-all duration-150 placeholder:text-gray-400 focus:bg-white focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-white/10 dark:bg-transparent dark:text-white"
            placeholder="Search employees, tasks, leaves..."
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <kbd className="text-[11px] text-gray-400 dark:text-violet-300/50 bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-white/10 rounded px-1.5 py-0.5 font-mono leading-none shadow-2xs">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 shrink-0">

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <NotificationBell />

        {/* User dropdown */}
        <UserDropdown name={name} role={role} avatarUrl={avatarUrl} initials={initials} canPreview={realIsAdmin} />
      </div>
    </header>
  );
}
