'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Bell, CheckCheck, Calendar, CheckSquare, Megaphone, Info, Vote, BookOpen, Clock, Bug, ShieldCheck, FlaskConical, TestTube2, CheckCircle2, RotateCcw, BellRing, PartyPopper, Hand as HandIcon } from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useAuth } from '@/hooks/useAuth';
import type { Notification } from '@/store/useNotificationStore';

// ── Icon by type ──────────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  const base = 'w-8 h-8 rounded-full flex items-center justify-center shrink-0';
  switch (type) {
    case 'LEAVE_APPLIED':
    case 'LEAVE_APPROVED':
    case 'LEAVE_REJECTED':
      return <div className={cn(base, 'bg-amber-100 dark:bg-amber-900/30')}><Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" /></div>;
    case 'TASK_ASSIGNED':
    case 'TASK_MENTIONED':
      return <div className={cn(base, 'bg-blue-100 dark:bg-blue-900/30')}><CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>;
    case 'TASK_DUE_REMINDER':
      return <div className={cn(base, 'bg-orange-100 dark:bg-orange-900/30')}><Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" /></div>;
    case 'BUG_ASSIGNED':
    case 'BUG_SEVERITY_CHANGED':
      return <div className={cn(base, 'bg-red-100 dark:bg-red-900/30')}><Bug className="w-4 h-4 text-red-600 dark:text-red-400" /></div>;
    case 'TASK_DONE':
      return <div className={cn(base, 'bg-green-100 dark:bg-green-900/30')}><CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" /></div>;
    case 'READY_FOR_QA':
      return <div className={cn(base, 'bg-amber-100 dark:bg-amber-900/30')}><FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400" /></div>;
    case 'TESTING_STARTED':
      return <div className={cn(base, 'bg-teal-100 dark:bg-teal-900/30')}><TestTube2 className="w-4 h-4 text-teal-600 dark:text-teal-400" /></div>;
    case 'BUG_REOPENED_BY_QA':
      return <div className={cn(base, 'bg-red-100 dark:bg-red-900/30')}><RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" /></div>;
    case 'BUG_VERIFIED':
      return <div className={cn(base, 'bg-green-100 dark:bg-green-900/30')}><ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" /></div>;
    case 'ANNOUNCEMENT':
      return <div className={cn(base, 'bg-violet-100 dark:bg-violet-900/30')}><Megaphone className="w-4 h-4 text-violet-600 dark:text-violet-400" /></div>;
    case 'POLL_CREATED':
      return <div className={cn(base, 'bg-green-100 dark:bg-green-900/30')}><Vote className="w-4 h-4 text-green-600 dark:text-green-400" /></div>;
    case 'WIKI_UPDATED':
      return <div className={cn(base, 'bg-teal-100 dark:bg-teal-900/30')}><BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" /></div>;
    case 'REGULARIZATION_REQUEST':
    case 'REGULARIZATION_APPROVED':
    case 'REGULARIZATION_REJECTED':
    case 'REGULARIZATION_APPEAL':
      return <div className={cn(base, 'bg-orange-100 dark:bg-orange-900/30')}><Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" /></div>;
    case 'TASK_OFFERED':
    case 'TASK_OFFER_REMINDER':
      return <div className={cn(base, 'bg-amber-100 dark:bg-amber-900/30')}><HandIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" /></div>;
    case 'TASK_OFFER_TAKEN':
    case 'TASK_PART_DONE':
      return <div className={cn(base, 'bg-green-100 dark:bg-green-900/30')}><CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" /></div>;
    case 'HOLIDAYS_UPDATED':
      return <div className={cn(base, 'bg-rose-100 dark:bg-rose-900/30')}><PartyPopper className="w-4 h-4 text-rose-600 dark:text-rose-400" /></div>;
    case 'ATTENDANCE_NOTICE':
      return <div className={cn(base, 'bg-amber-100 dark:bg-amber-900/30')}><BellRing className="w-4 h-4 text-amber-600 dark:text-amber-400" /></div>;
    default:
      return <div className={cn(base, 'bg-gray-100 dark:bg-surface-dark-3')}><Info className="w-4 h-4 text-gray-500 dark:text-violet-300/60" /></div>;
  }
}

// ── Group by date ─────────────────────────────────────────────────────────────

function groupNotifications(notifications: Notification[]) {
  const today: Notification[] = [], yesterday: Notification[] = [], earlier: Notification[] = [];
  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (isToday(d))          today.push(n);
    else if (isYesterday(d)) yesterday.push(n);
    else                     earlier.push(n);
  }
  return { today, yesterday, earlier };
}

// ── Single item ───────────────────────────────────────────────────────────────

function NotifItem({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const router = useRouter();

  function handleClick() {
    if (!notif.isRead) onRead(notif.id);
    if (notif.linkUrl) router.push(notif.linkUrl);
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-surface-dark-3/60 transition-colors duration-150 border-l-2',
        !notif.isRead
          ? 'border-brand bg-brand-light/30 dark:bg-violet-900/10'
          : 'border-transparent',
      )}
    >
      <NotifIcon type={notif.type} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', notif.isRead ? 'text-gray-700 dark:text-violet-100/70' : 'font-semibold text-gray-900 dark:text-white')}>
          {notif.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-violet-300/60 mt-0.5 line-clamp-2">{notif.body}</p>
        <p className="text-[11px] text-gray-400 dark:text-violet-400/40 mt-1">
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
        </p>
      </div>
      {!notif.isRead && <span className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1.5" />}
    </button>
  );
}

// ── Group section ─────────────────────────────────────────────────────────────

function GroupSection({ label, items, onRead }: { label: string; items: Notification[]; onRead: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="px-4 py-2 text-[11px] font-medium text-gray-400 dark:text-violet-400/50 uppercase tracking-wider bg-gray-50/80 dark:bg-surface-dark/50 border-b border-gray-100 dark:border-violet-900/25">
        {label}
      </p>
      {items.map((n) => <NotifItem key={n.id} notif={n} onRead={onRead} />)}
    </div>
  );
}

// ── NotificationCenter ────────────────────────────────────────────────────────

interface NotificationCenterProps {
  open:    boolean;
  onClose: () => void;
}

export function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const { user } = useAuth();
  const { notifications, unreadCount, prependNotification, markAsRead, markAllRead } = useNotificationStore();
  const { query, readOne, readAll } = useNotifications();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  // Supabase Realtime — push new notifications instantly without polling
  useEffect(() => {
    if (!user?.id) return;

    async function subscribe() {
      try {
        const { getSupabaseClient } = await import('@/lib/supabase');
        const supabase = getSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channelRef.current = (supabase as any)
          .channel(`notifications:${user!.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'Notification', filter: `userId=eq.${user!.id}` },
            (payload: { new: Record<string, unknown> }) => {
              const raw = payload.new;
              const n: Notification = {
                id:        raw.id        as string,
                type:      raw.type      as string,
                title:     raw.title     as string,
                body:      raw.body      as string,
                linkUrl:   raw.linkUrl   as string | null,
                isRead:    false,
                createdAt: raw.createdAt as string,
              };
              prependNotification(n);
              toast.info(n.title, { description: n.body });
            },
          )
          .subscribe();
      } catch {
        // Supabase realtime is optional — silently skip if not configured
      }
    }

    void subscribe();
    return () => { channelRef.current?.unsubscribe?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function handleReadOne(id: string) {
    markAsRead(id);
    readOne.mutate(id);
  }

  function handleReadAll() {
    markAllRead();
    readAll.mutate();
  }

  const groups = groupNotifications(notifications);
  const hasAny = notifications.length > 0;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[380px] bg-white dark:bg-surface-dark-2 border-l border-gray-200 dark:border-violet-900/30 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h2>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 bg-brand text-white text-[11px] font-semibold rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleReadAll}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover transition-colors duration-150"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 dark:text-violet-300/60 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {query.isLoading ? (
            <div className="space-y-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-surface-dark-3 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-surface-dark-3 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-100 dark:bg-surface-dark rounded w-full" />
                    <div className="h-2 bg-gray-100 dark:bg-surface-dark rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasAny ? (
            <EmptyState
              icon={<Bell className="w-10 h-10 text-gray-300 dark:text-violet-800/60" />}
              title="You're all caught up!"
              description="No notifications yet. We'll let you know when something happens."
            />
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-violet-900/20">
              <GroupSection label="Today"     items={groups.today}     onRead={handleReadOne} />
              <GroupSection label="Yesterday" items={groups.yesterday} onRead={handleReadOne} />
              <GroupSection label="Earlier"   items={groups.earlier}   onRead={handleReadOne} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
