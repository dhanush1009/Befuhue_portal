'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, Trash2, Building2, Globe, Mail, Phone, User as UserIcon,
  FolderKanban, AlertTriangle, Loader2, StickyNote, CreditCard,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useClient, useDeleteClient } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { ClientLogoUpload } from '@/components/clients/ClientLogoUpload';
import { EditClientModal } from '@/components/clients/EditClientModal';
import { ClientLogins } from '@/components/clients/ClientLogins';
import { ClientBillingSection } from '@/components/clients/ClientBillingSection';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SkeletonCard } from '@/components/shared/SkeletonCard';

const HEALTH_CONFIG: Record<string, { label: string; className: string }> = {
  on_track: { label: 'On Track', className: 'bg-status-present/10 text-status-present border-status-present/20' },
  at_risk:  { label: 'At Risk',  className: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400' },
  blocked:  { label: 'Blocked',  className: 'bg-status-absent/10 text-status-absent border-status-absent/20' },
};

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteClientDialog({ name, onClose, onConfirm, isPending }: { name: string; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-status-absent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Delete &quot;{name}&quot;?</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">
              This cannot be undone. Clients with projects or tasks cannot be deleted.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-status-absent text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors duration-150"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { data: client, isLoading, isError } = useClient(params.clientId);
  const deleteClient = useDeleteClient();

  const [showEdit,   setShowEdit]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab,  setActiveTab]  = useState<'overview' | 'billing'>('overview');

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto pb-10 space-y-5">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="max-w-4xl mx-auto pb-10 text-center py-16">
        <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-violet-300/55">Client not found.</p>
        <button onClick={() => router.push('/clients')} className="mt-4 text-sm text-brand hover:underline">Back to Directory</button>
      </div>
    );
  }

  const isInactive = client.status === 'INACTIVE';

  return (
    <div className="max-w-4xl mx-auto pb-10">
      {/* Back */}
      <button onClick={() => router.push('/clients')} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white mb-5 transition-colors duration-150">
        <ArrowLeft className="w-4 h-4" /> Client Directory
      </button>

      {/* Hero card */}
      <div className={cn('bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-6 mb-6 shadow-sm', isInactive && 'opacity-75')}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="shrink-0">
            {isAdmin ? (
              <ClientLogoUpload clientId={client.id} currentLogoUrl={client.logoUrl} clientName={client.name} size="lg" />
            ) : (
              <div className="w-[112px] h-[112px] rounded-xl overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-surface-dark-3 border-2 border-white dark:border-white/10 shadow-sm">
                {client.logoUrl ? (
                  <img src={client.logoUrl} alt={client.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-10 h-10 text-gray-400 dark:text-zinc-500" />
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">{client.name}</h1>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-0.5">{client.industry ?? '—'}</p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <StatusBadge status={isInactive ? 'inactive' : 'active'} />
                  {client.accountLead && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-light text-brand dark:bg-brand/10 dark:text-brand">
                      Lead: {client.accountLead.name}
                    </span>
                  )}
                  {client.billingAmount && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
                      {client.billingCurrency === 'USD' ? '$' : '₹'}{client.billingAmount.toLocaleString('en-IN')}/{client.billingCycle === 'MONTHLY' ? 'mo' : client.billingCycle?.toLowerCase()}
                    </span>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowEdit(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border border-gray-300 dark:border-white/10 rounded-lg text-zinc-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setShowDelete(true)}
                    className="p-2 rounded-lg text-zinc-500 hover:text-status-absent hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                    title="Delete client"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors duration-150 whitespace-nowrap',
            activeTab === 'overview'
              ? 'border-brand text-brand'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white',
          )}
        >
          <Building2 className="w-4 h-4" /> Overview
        </button>

        <button
          onClick={() => setActiveTab('billing')}
          className={cn(
            'flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors duration-150 whitespace-nowrap',
            activeTab === 'billing'
              ? 'border-brand text-brand'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white',
          )}
        >
          <CreditCard className="w-4 h-4" /> Billing & Invoices
          {client.invoices && client.invoices.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-brand-light text-brand dark:bg-brand/20">
              {client.invoices.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Billing & Invoices */}
      {activeTab === 'billing' && (
        <ClientBillingSection client={client} isAdmin={isAdmin} />
      )}

      {/* Tab 3: Overview */}
      {activeTab === 'overview' && (
        <>
          {/* Contact info */}
          <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-6 mb-5 shadow-sm">
            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-4">Contact Info</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={<UserIcon className="w-4 h-4" />} label="Contact Person" value={client.contactName} />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={client.contactEmail} href={client.contactEmail ? `mailto:${client.contactEmail}` : undefined} />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={client.contactPhone} href={client.contactPhone ? `tel:${client.contactPhone}` : undefined} />
              <InfoRow
                icon={<Globe className="w-4 h-4" />}
                label="Website"
                value={client.website}
                href={client.website ? (client.website.startsWith('http') ? client.website : `https://${client.website}`) : undefined}
                external
              />
            </div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-4">Client since {formatDate(client.createdAt)}</p>
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-6 mb-5 shadow-sm">
              <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5 text-brand" /> Notes
              </p>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}

          {/* Logins for this brand */}
          <ClientLogins clientId={client.id} clientName={client.name} />

          {/* Projects */}
          <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-6 mt-5 shadow-sm">
            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-brand" /> Projects {client.projects && `(${client.projects.length})`}
            </p>
            {!client.projects || client.projects.length === 0 ? (
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 italic">No projects yet for this client.</p>
            ) : (
              <div className="space-y-2">
                {client.projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-surface-dark-3 rounded-lg border border-gray-200/70 dark:border-white/5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-brand-light text-brand dark:bg-brand/10 dark:text-brand shrink-0">
                        {p.prefix}
                      </span>
                      <span className="text-sm font-bold text-zinc-950 dark:text-white truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.health && (
                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', HEALTH_CONFIG[p.health]?.className)}>
                          {HEALTH_CONFIG[p.health]?.label ?? p.health}
                        </span>
                      )}
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {p._count?.tasks ?? 0} task{(p._count?.tasks ?? 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showEdit && <EditClientModal client={client} onClose={() => setShowEdit(false)} />}
      {showDelete && (
        <DeleteClientDialog
          name={client.name}
          isPending={deleteClient.isPending}
          onClose={() => setShowDelete(false)}
          onConfirm={() => deleteClient.mutate(client.id, { onSuccess: () => router.push('/clients') })}
        />
      )}
    </div>
  );
}

// ── Info row helper ───────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, href, external }: { icon: React.ReactNode; label: string; value: string | null; href?: string; external?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-zinc-500 dark:text-zinc-400 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{label}</p>
        {value ? (
          href ? (
            <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className="text-sm font-semibold text-brand hover:underline truncate block">
              {value}
            </a>
          ) : (
            <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate">{value}</p>
          )
        ) : (
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">—</p>
        )}
      </div>
    </div>
  );
}
