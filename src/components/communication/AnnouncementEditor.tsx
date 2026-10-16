'use client';

import { useState } from 'react';
import { X, Pin, Loader2 } from 'lucide-react';
import { TiptapEditor } from './TiptapEditor';
import { useCreateAnnouncement } from '@/hooks/useCommunication';
import { cn } from '@/lib/utils';

interface AnnouncementEditorProps {
  onClose: () => void;
}

export function AnnouncementEditor({ onClose }: AnnouncementEditorProps) {
  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState<Record<string, unknown>>({});
  const [isPinned, setIsPinned] = useState(false);
  const create = useCreateAnnouncement();

  const inputClass = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

  function handleSubmit() {
    if (!title.trim()) return;
    create.mutate({ title: title.trim(), body, isPinned }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">New Announcement</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title…"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Content</label>
            <TiptapEditor onChange={setBody} placeholder="Write your announcement…" />
          </div>

          {/* Pin toggle */}
          <button
            type="button"
            onClick={() => setIsPinned((v) => !v)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors duration-150',
              isPinned
                ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-500/30 dark:text-amber-400'
                : 'border-gray-200 dark:border-violet-900/40 text-gray-500 dark:text-violet-300/55 hover:bg-gray-50 dark:hover:bg-surface-dark-3',
            )}
          >
            <Pin className="w-4 h-4" />
            {isPinned ? 'Pinned' : 'Pin this announcement'}
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || create.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
          >
            {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
