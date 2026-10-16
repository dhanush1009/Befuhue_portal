'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, Plus, Pencil, X, Loader2, BookOpen, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { useWiki, useCreateWikiPage, useUpdateWikiPage, type WikiPage } from '@/hooks/useCommunication';
import { useAuth } from '@/hooks/useAuth';

const TiptapViewer = dynamic(() => import('./TiptapViewer').then((m) => m.TiptapViewer), { ssr: false });
const TiptapEditor = dynamic(() => import('./TiptapEditor').then((m) => m.TiptapEditor), { ssr: false });

const CATEGORIES = ['Onboarding', 'Policies', 'Technical', 'Culture', 'General'];

// ── Article editor modal ──────────────────────────────────────────────────────

interface ArticleEditorProps {
  existing?: WikiPage;
  onClose:   () => void;
}

function ArticleEditor({ existing, onClose }: ArticleEditorProps) {
  const [title,    setTitle]    = useState(existing?.title    ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'General');
  const [content,  setContent]  = useState<Record<string, unknown>>(existing?.content ?? {});

  const create = useCreateWikiPage();
  const update = useUpdateWikiPage();
  const isPending = create.isPending || update.isPending;

  const inputClass = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

  function handleSubmit() {
    if (!title.trim()) return;
    if (existing) {
      update.mutate({ id: existing.id, title: title.trim(), content, category }, { onSuccess: onClose });
    } else {
      create.mutate({ title: title.trim(), content, category }, { onSuccess: onClose });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{existing ? 'Edit Article' : 'New Article'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title…" className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Content</label>
            <TiptapEditor content={existing?.content} onChange={setContent} placeholder="Write article content…" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim() || isPending} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]">
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {existing ? 'Save' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Article detail view ───────────────────────────────────────────────────────

interface ArticleViewProps {
  page:    WikiPage;
  onClose: () => void;
  onEdit:  () => void;
  canEdit: boolean;
}

function ArticleView({ page, onClose, onEdit, canEdit }: ArticleViewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{page.title}</h2>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
              {page.category} · Updated {formatDate(page.updatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"><Pencil className="w-4 h-4" /></button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <TiptapViewer content={page.content} />
        </div>
      </div>
    </div>
  );
}

// ── Main WikiSection ──────────────────────────────────────────────────────────

export function WikiSection() {
  const { isAdmin } = useAuth();
  const { data: pages, isLoading } = useWiki();
  const [search,      setSearch]      = useState('');
  const [creating,    setCreating]    = useState(false);
  const [viewing,     setViewing]     = useState<WikiPage | null>(null);
  const [editing,     setEditing]     = useState<WikiPage | null>(null);

  const filtered = (pages ?? []).filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by category
  const grouped = CATEGORIES.reduce<Record<string, WikiPage[]>>((acc, cat) => {
    const items = filtered.filter((p) => p.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  const otherItems = filtered.filter((p) => !CATEGORIES.includes(p.category));
  if (otherItems.length > 0) grouped['Other'] = otherItems;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150"
          />
        </div>
        {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Article
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
          title="No articles found"
          description={search ? 'Try a different search term.' : 'No wiki articles yet.'}
          action={isAdmin ? (
            <button onClick={() => setCreating(true)} className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150">
              Write first article
            </button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">{category}</p>
              <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden divide-y divide-gray-50 dark:divide-violet-900/25">
                {items.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-surface-dark-3/50 transition-colors duration-150 cursor-pointer group"
                    onClick={() => setViewing(page)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-brand transition-colors duration-150">{page.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <UserAvatar name={page.author.name} avatarUrl={page.author.avatarUrl} size="sm" className="w-4 h-4 text-[9px]" />
                        <p className="text-xs text-gray-400 dark:text-violet-300/45">Updated {formatDate(page.updatedAt)}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(page); }}
                        className="p-1.5 rounded-lg text-gray-300 dark:text-violet-400/35 hover:text-brand hover:bg-brand-light dark:hover:bg-violet-900/30 opacity-0 group-hover:opacity-100 transition-all duration-150"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-violet-400/35 group-hover:text-brand transition-colors duration-150" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {creating && <ArticleEditor onClose={() => setCreating(false)} />}
      {editing  && <ArticleEditor existing={editing} onClose={() => setEditing(null)} />}
      {viewing  && !editing && (
        <ArticleView
          page={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
          canEdit={isAdmin}
        />
      )}
    </div>
  );
}
