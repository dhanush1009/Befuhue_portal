'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Calendar, CheckSquare, Megaphone, Info, Vote, BookOpen, Clock, BellRing, PartyPopper, Hand as HandIcon, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationStore } from '@/store/useNotificationStore';
import type { Notification } from '@/store/useNotificationStore';

// ── Icon by type ──────────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  const base = 'w-10 h-10 rounded-full flex items-center justify-center shrink-0';
  switch (type) {
    case 'LEAVE_APPLIED':
    case 'LEAVE_APPROVED':
    case 'LEAVE_REJECTED':
      return <div className={cn(base, 'bg-amber-100 dark:bg-amber-900/30')}><Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>;
    case 'TASK_ASSIGNED':
    case 'TASK_MENTIONED':
      return <div className={cn(base, 'bg-blue-100 dark:bg-blue-900/30')}><CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>;
    case 'TASK_DUE_REMINDER':
      return <div className={cn(base, 'bg-orange-100 dark:bg-orange-900/30')}><Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" /></div>;
    case 'ANNOUNCEMENT':
      return <div className={cn(base, 'bg-violet-100 dark:bg-violet-900/30')}><Megaphone className="w-5 h-5 text-violet-600 dark:text-violet-400" /></div>;
    case 'POLL_CREATED':
      return <div className={cn(base, 'bg-green-100 dark:bg-green-900/30')}><Vote className="w-5 h-5 text-green-600 dark:text-green-400" /></div>;
    case 'WIKI_UPDATED':
      return <div className={cn(base, 'bg-teal-100 dark:bg-teal-900/30')}><BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" /></div>;
    case 'TASK_OFFERED':
    case 'TASK_OFFER_REMINDER':
      return <div className={cn(base, 'bg-amber-100 dark:bg-amber-900/30')}><HandIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>;
    case 'TASK_OFFER_TAKEN':
    case 'TASK_PART_DONE':
      return <div className={cn(base, 'bg-green-100 dark:bg-green-900/30')}><CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" /></div>;
    case 'HOLIDAYS_UPDATED':
      return <div className={cn(base, 'bg-rose-100 dark:bg-rose-900/30')}><PartyPopper className="w-5 h-5 text-rose-600 dark:text-rose-400" /></div>;
    case 'ATTENDANCE_NOTICE':
      return <div className={cn(base, 'bg-amber-100 dark:bg-amber-900/30')}><BellRing className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>;
    default:
      return <div className={cn(base, 'bg-gray-100 dark:bg-surface-dark-3')}><Info className="w-5 h-5 text-gray-500 dark:text-violet-300/55" /></div>;
  }
}

// ── Single row ────────────────────────────────────────────────────────────────

function NotifRow({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const router = useRouter();

  function handleClick() {
    if (!notif.isRead) onRead(notif.id);
    if (notif.linkUrl) router.push(notif.linkUrl);
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-surface-dark-3/50 transition-colors duration-150 border-l-2',
        !notif.isRead
          ? 'border-brand bg-brand-light/20 dark:bg-violet-900/10'
          : 'border-transparent',
      )}
    >
      <NotifIcon type={notif.type} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !notif.isRead ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-violet-200/70')}>
          {notif.title}
        </p>
        <p className="text-sm text-gray-500 dark:text-violet-300/55 mt-0.5 line-clamp-2">{notif.body}</p>
        <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
        </p>
      </div>
      {!notif.isRead && <span className="w-2 h-2 rounded-full bg-brand shrink-0 mt-2" />}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { query, readOne, readAll } = useNotifications(page);
  const { markAsRead, markAllRead, unreadCount } = useNotificationStore();

  const notifications = query.data?.data ?? [];
  const total         = query.data?.total ?? 0;
  const totalPages    = Math.ceil(total / (query.data?.limit ?? 20));

  function handleReadOne(id: string) {
    markAsRead(id);
    readOne.mutate(id);
  }

  function handleReadAll() {
    markAllRead();
    readAll.mutate();
  }

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Notifications"
          description="Your recent alerts, approvals, and system messages."
        />
        {unreadCount > 0 && (
          <button
            onClick={handleReadAll}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand hover:text-brand-hover border border-brand/30 hover:bg-brand/5 rounded-lg transition-colors duration-150"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
        {query.isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-16" />)}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
            title="You're all caught up!"
            description="No notifications yet. We'll let you know when something happens."
          />
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-violet-900/25">
            {notifications.map((n) => (
              <NotifRow key={n.id} notif={n} onRead={handleReadOne} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500 dark:text-violet-300/55">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
