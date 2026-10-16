'use client';

import { useState, useMemo } from 'react';
import { Search, Building2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ClientCard } from '@/components/clients/ClientCard';
import { AddClientModal } from '@/components/clients/AddClientModal';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useClients } from '@/hooks/useClients';
import { useVault } from '@/hooks/useVault';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function ClientsPage() {
  const { isAdmin } = useAuth();
  const { data: clients = [], isLoading, isError } = useClients();
  const vault = useVault();
  const loginCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of vault.data?.items ?? []) m.set(i.clientId, (m.get(i.clientId) ?? 0) + 1);
    return m;
  }, [vault.data]);
  const [search,        setSearch]        = useState('');
  const [showInactive,  setShowInactive]  = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (!showInactive && c.status === 'INACTIVE') return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.contactName?.toLowerCase().includes(q)
      );
    });
  }, [clients, search, showInactive]);

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Client Directory"
        description={`${filtered.length} client${filtered.length === 1 ? '' : 's'}`}
        actions={
          isAdmin ? (
            <button
              onClick={() => setShowAddClient(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Add Client
            </button>
          ) : undefined
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <input
            type="text"
            placeholder="Search name, industry, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150"
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={showInactive}
            onClick={() => setShowInactive((v) => !v)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
              showInactive ? 'bg-brand' : 'bg-gray-300 dark:bg-surface-dark-3',
            )}
          >
            <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200', showInactive ? 'translate-x-4' : 'translate-x-0')} />
          </button>
          Show inactive
        </label>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : isError ? (
        <EmptyState icon={<Building2 className="w-10 h-10 text-gray-300" />} title="Failed to load clients" description="Please try refreshing the page." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
          title="No clients found"
          description="Try adjusting your search, or add your first client."
          action={isAdmin ? (
            <button onClick={() => setShowAddClient(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150">
              <Plus className="w-4 h-4" /> Add First Client
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} loginCount={loginCounts.get(client.id) ?? 0} />
          ))}
        </div>
      )}

      {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} />}
    </div>
  );
}
