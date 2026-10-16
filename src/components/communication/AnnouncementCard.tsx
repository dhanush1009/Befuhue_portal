'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Pin, Paperclip, Download, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useReactToAnnouncement, type Announcement } from '@/hooks/useCommunication';
import { useAuth } from '@/hooks/useAuth';

const TiptapViewer = dynamic(
  () => import('./TiptapViewer').then((m) => m.TiptapViewer),
  { ssr: false, loading: () => <div className="h-12 animate-pulse bg-gray-100 dark:bg-surface-dark-3 rounded" /> },
);

const REACTIONS = [
  { key: 'thumbsup' as const, emoji: '👍' },
  { key: 'clap'     as const, emoji: '👏' },
  { key: 'heart'    as const, emoji: '❤️' },
];

interface AnnouncementCardProps {
  announcement: Announcement;
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuth();
  const react = useReactToAnnouncement();

  const reactions = announcement.reactions ?? {};

  return (
    <div className={cn(
      'bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 hover:border-violet-200 dark:hover:border-violet-500 transition-colors duration-150',
      announcement.isPinned && 'border-l-4 border-l-amber-400',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <UserAvatar name={announcement.author.name} avatarUrl={announcement.author.avatarUrl} size="md" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{announcement.author.name}</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 capitalize">
              {announcement.author.designation ?? announcement.author.role.toLowerCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {announcement.isPinned && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Pin className="w-3 h-3" /> Pinned
            </span>
          )}
          <span
            className="text-xs text-gray-400 dark:text-violet-300/45 cursor-default"
            title={format(new Date(announcement.createdAt), 'PPpp')}
          >
            {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{announcement.title}</h3>

      {/* Body */}
      <div className={cn('relative overflow-hidden', !expanded && 'max-h-[4.5rem]')}>
        <TiptapViewer content={announcement.body} />
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-surface-dark-3 to-transparent" />
        )}
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-medium text-brand hover:text-brand-hover mt-1 transition-colors duration-150"
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>

      {/* Attachment */}
      {announcement.attachmentUrl && (
        <a
          href={announcement.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-violet-900/40 text-sm text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150 w-fit"
        >
          <Paperclip className="w-4 h-4 text-gray-400" />
          <span className="truncate max-w-[200px]">Attachment</span>
          <Download className="w-3.5 h-3.5 text-gray-400 ml-auto" />
        </a>
      )}

      {/* Reactions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-violet-900/40">
        {REACTIONS.map(({ key, emoji }) => {
          const users   = reactions[key] ?? [];
          const reacted = user?.id ? users.includes(user.id) : false;
          return (
            <button
              key={key}
              onClick={() => react.mutate({ id: announcement.id, reaction: key })}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition-colors duration-150',
                reacted
                  ? 'bg-brand-light border-brand/30 text-brand dark:bg-violet-900/30 dark:border-violet-500/30 dark:text-violet-300'
                  : 'border-gray-200 dark:border-violet-900/40 text-gray-500 dark:text-violet-300/55 hover:bg-gray-50 dark:hover:bg-surface-dark-3',
              )}
            >
              <span>{emoji}</span>
              {users.length > 0 && <span className="text-xs font-medium">{users.length}</span>}
            </button>
          );
        })}
        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-violet-300/45 ml-auto">
          <MessageSquare className="w-3.5 h-3.5" />
          0
        </span>
      </div>
    </div>
  );
}
