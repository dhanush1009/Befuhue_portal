'use client';

import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronsUpDown, Settings, type LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  CalendarDays,
  Umbrella,
  CheckSquare,
  Users,
  Megaphone,
  ClipboardCheck,
  UsersRound,
  IndianRupee,
  FileText,
  FileBarChart2,
  Building2,
  PartyPopper,
  Cake,
  KeyRound,
  Receipt,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, getInitials } from '@/lib/utils';
import { useUIStore } from '@/store/useUIStore';
import { useAuth } from '@/hooks/useAuth';
import { SidebarItem, isActivePath } from './SidebarItem';

// ── Nav structure ─────────────────────────────────────────────────────────────

interface NavItem { label: string; href: string; icon: LucideIcon; exact?: boolean }
interface NavGroup { key: string; label: string; items: NavItem[]; adminOnly?: boolean }

const NAV_GROUPS: NavGroup[] = [
  { key: 'MAIN', label: 'Overview', items: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  ] },
  { key: 'TIME', label: 'Time & Attendance', items: [
    { label: 'My Time',  href: '/attendance',        icon: CalendarDays, exact: true },
    { label: 'Time Off', href: '/attendance/leaves', icon: Umbrella },
    { label: 'Holidays', href: '/holidays',          icon: PartyPopper },
    { label: 'Payslips', href: '/payslips',          icon: FileText },
  ] },
  { key: 'TASKS', label: 'Tasks', items: [
    { label: 'Task Board', href: '/tasks', icon: CheckSquare },
  ] },
  { key: 'CLIENTS', label: 'Clients', items: [
    { label: 'Client Directory', href: '/clients', icon: Building2 },
    { label: 'Passwords', href: '/vault', icon: KeyRound },
  ] },
  { key: 'PEOPLE', label: 'People', items: [
    { label: 'People Directory', href: '/hr', icon: Users },
  ] },
  { key: 'COMM', label: 'Communication', items: [
    { label: 'Announcements', href: '/communication', icon: Megaphone },
  ] },
  { key: 'BILLING', label: 'Billing', adminOnly: true, items: [
    { label: 'Client & Agency Billing', href: '/billing', icon: Receipt },
  ] },
  { key: 'ADMIN', label: 'Admin', adminOnly: true, items: [
    { label: 'Approvals', href: '/approvals',        icon: ClipboardCheck },
    { label: 'Birthdays', href: '/birthdays',        icon: Cake },
    { label: 'Team Time', href: '/attendance/team',  icon: UsersRound },
    { label: 'Payroll',   href: '/payroll/admin',    icon: IndianRupee },
    { label: 'Reports',   href: '/reports',          icon: FileBarChart2 },
  ] },
];

// ── Pieces shared by the desktop sidebar and the mobile drawer ────────────────

function Brand({ collapsed }: { collapsed: boolean }) {
  const { companyName, companyLogoUrl } = useUIStore();
  const logo = companyLogoUrl || '/branding/befhue-logo.png';
  return (
    <div className={cn('flex items-center gap-3 rounded-xl p-2 transition-colors', collapsed ? 'justify-center' : 'hover:bg-white/[0.06]')}>
      {collapsed ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-xs overflow-hidden border border-white/20">
          <img src={logo} alt={companyName} className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex h-9 max-w-[135px] items-center rounded-lg bg-white px-2 py-1 shadow-xs border border-white/20 shrink-0">
            <img src={logo} alt={companyName} className="h-5 w-auto object-contain" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold text-white tracking-tight">{companyName}</p>
            <p className="truncate text-[11px] text-zinc-400 font-medium">Workspace</p>
          </div>
        </div>
      )}
    </div>
  );
}

function UserCard({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { user } = useAuth();
  const name = (user?.name as string | undefined) ?? 'User';
  const avatarUrl = user?.avatarUrl as string | null | undefined;
  const subtitle = (user?.designation as string | null | undefined) ?? (user?.role as string | undefined)?.toLowerCase() ?? 'employee';
  const pathname = usePathname();
  const active = isActivePath(pathname, '/profile');

  return (
    <Link
      href="/profile"
      onClick={onNavigate}
      title={collapsed ? name : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-2 transition-colors duration-150',
        active ? 'border-brand/40 bg-brand/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]',
        collapsed && 'justify-center border-transparent p-1.5',
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand/20 bg-brand-light text-xs font-semibold text-brand">
        {avatarUrl ? <img src={avatarUrl} alt={name} className="size-full object-cover" /> : getInitials(name)}
      </div>
      {!collapsed && (
        <>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            <p className="truncate text-xs capitalize text-zinc-400">{subtitle}</p>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-zinc-400" />
        </>
      )}
    </Link>
  );
}

function NavList({ groups, collapsed, onNavigate }: { groups: NavGroup[]; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="custom-scrollbar flex-1 overflow-y-auto px-2 py-3">
      {groups.map((group) => (
        <div key={group.key} className="mb-4">
          {!collapsed
            ? <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{group.label}</p>
            : <div className="mx-3 mb-2 h-px bg-white/10" />}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <SidebarItem key={item.href} {...item} collapsed={collapsed} onClick={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { data: session } = useSession();
  // The effective user: while an Admin previews the portal as someone, this is that person.
  const { isAdmin } = useAuth();
  const { sidebarOpen, mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const [hasEmployeeReports, setHasEmployeeReports] = useState(false);

  useEffect(() => {
    if (isAdmin || !session?.user) return;
    let cancelled = false;
    fetch('/api/reports/mine')
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j.data?.count > 0) setHasEmployeeReports(true); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [isAdmin, session]);

  const groups = NAV_GROUPS
    .filter((g) => !g.adminOnly || isAdmin)
    .map((g) => (g.key === 'MAIN' && !isAdmin && hasEmployeeReports
      ? { ...g, items: [...g.items, { label: 'Reports', href: '/reports', icon: FileBarChart2 }] }
      : g));
  // Settings sits at the bottom for everyone
  const settings: NavGroup = { key: 'SETTINGS', label: 'Settings', items: [{ label: 'Settings', href: '/settings', icon: Settings }] };
  const all = [...groups, settings];

  return (
    <>
      {/* Desktop */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? '16rem' : '4.5rem' }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="z-20 hidden h-screen shrink-0 flex-col overflow-hidden lg:flex bg-[#0D0D10] text-[#A1A1AA] border-r border-white/5"
      >
        <div className="px-2 pt-3"><Brand collapsed={!sidebarOpen} /></div>
        <NavList groups={all} collapsed={!sidebarOpen} />
        <div className="px-2 pb-3"><UserCard collapsed={!sidebarOpen} /></div>
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#0D0D10] text-[#A1A1AA] lg:hidden"
            >
              <div className="flex items-center justify-between px-2 pt-3">
                <Brand collapsed={false} />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="mr-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>
              <NavList groups={all} collapsed={false} onNavigate={() => setMobileMenuOpen(false)} />
              <div className="px-2 pb-3"><UserCard collapsed={false} onNavigate={() => setMobileMenuOpen(false)} /></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
