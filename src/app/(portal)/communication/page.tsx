'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnnouncementCard } from '@/components/communication/AnnouncementCard';
import { BirthdayWidget } from '@/components/communication/BirthdayWidget';
import { QuickLinks } from '@/components/communication/QuickLinks';
import { PollCard } from '@/components/communication/PollCard';
import { WikiSection } from '@/components/communication/WikiSection';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAnnouncements } from '@/hooks/useCommunication';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const AnnouncementEditor = dynamic(
  () => import('@/components/communication/AnnouncementEditor').then((m) => m.AnnouncementEditor),
  { ssr: false },
);

type Tab = 'announcements' | 'wiki';

// ── Announcements feed ────────────────────────────────────────────────────────

function AnnouncementsFeed() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAnnouncements(page);

  const announcements = data?.data  ?? [];
  const total         = data?.total ?? 0;
  const limit         = data?.limit ?? 10;
  const hasMore       = page * limit < total;

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>;
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Megaphone className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
        title="Failed to load announcements"
        description="Please try refreshing the page."
      />
    );
  }

  if (announcements.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
        title="No announcements yet"
        description="Company announcements will appear here."
      />
    );
  }

  return (
    <div>
      <div className="space-y-4">
        {announcements.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="w-full mt-4 py-2.5 text-sm font-medium text-brand hover:text-brand-hover border border-gray-200 dark:border-violet-900/40 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
        >
          Load more
        </button>
      )}
    </div>
  );
}

// ── Right sidebar ─────────────────────────────────────────────────────────────

function RightSidebar() {
  return (
    <div className="space-y-4">
      <BirthdayWidget />
      <PollCard />
      <QuickLinks />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommunicationPage() {
  const { isAdmin } = useAuth();
  const [activeTab,  setActiveTab]  = useState<Tab>('announcements');
  const [showEditor, setShowEditor] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'announcements', label: 'Announcements' },
    { id: 'wiki',          label: 'Company Wiki' },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Workspace"
        description="Announcements, updates, and your team's knowledge base."
        actions={
          isAdmin && activeTab === 'announcements' ? (
            <button
              onClick={() => setShowEditor(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              New Announcement
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-violet-900/40">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150',
              activeTab === tab.id
                ? 'border-brand text-brand dark:text-violet-400'
                : 'border-transparent text-gray-500 dark:text-violet-300/55 hover:text-gray-700 dark:hover:text-violet-200/70',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Announcements tab — 65/35 layout */}
      {activeTab === 'announcements' && (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0" style={{ flexBasis: '65%' }}>
            <AnnouncementsFeed />
          </div>
          <div className="shrink-0 hidden lg:block" style={{ flexBasis: '35%', maxWidth: '360px' }}>
            <RightSidebar />
          </div>
        </div>
      )}

      {/* Wiki tab — full width */}
      {activeTab === 'wiki' && <WikiSection />}

      {/* Editor modal */}
      {showEditor && <AnnouncementEditor onClose={() => setShowEditor(false)} />}
    </div>
  );
}
