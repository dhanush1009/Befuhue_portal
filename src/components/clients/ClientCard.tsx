'use client';

import { useRouter } from 'next/navigation';
import { Building2, Globe, Mail, Phone, FolderKanban, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Client } from '@/types';

function logoColor(name: string): string {
  const colors = [
    'bg-violet-100 text-violet-700',
    'bg-sky-100 text-sky-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-teal-100 text-teal-700',
    'bg-orange-100 text-orange-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

interface ClientCardProps {
  client: Client;
  /** How many logins are stored for this brand in the password vault. */
  loginCount?: number;
}

export function ClientCard({ client, loginCount = 0 }: ClientCardProps) {
  const router     = useRouter();
  const isInactive = client.status === 'INACTIVE';
  const projectCount = client._count?.projects ?? 0;
  const taskCount    = client._count?.tasks ?? 0;

  return (
    <div
      onClick={() => router.push(`/clients/${client.id}`)}
      className={cn(
        'bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-5 cursor-pointer hover:shadow-md hover:border-brand/40 dark:hover:border-brand/40 transition-all duration-150 group',
        isInactive && 'opacity-50 grayscale',
      )}
    >
      {/* Logo + name */}
      <div className="flex flex-col items-center text-center mb-4">
        <div
          className={cn(
            'w-16 h-16 rounded-xl flex items-center justify-center text-lg font-semibold mb-3 overflow-hidden border-2 border-white dark:border-white/10 shadow-sm',
            !client.logoUrl && logoColor(client.name),
          )}
        >
          {client.logoUrl ? (
            <img src={client.logoUrl} alt={client.name} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-6 h-6" />
          )}
        </div>
        <p className="text-base font-bold text-zinc-950 dark:text-white leading-tight truncate w-full">{client.name}</p>
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-0.5 truncate w-full">
          {client.industry ?? '—'}
        </p>
      </div>

      {/* Project count + billing + status */}
      <div className="flex items-center justify-center gap-1.5 mb-4 flex-wrap">
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-light text-brand dark:bg-brand/10 dark:text-brand">
          <FolderKanban className="w-3 h-3" /> {projectCount} project{projectCount === 1 ? '' : 's'}
        </span>
        {client.billingAmount && (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
            {client.billingCurrency === 'USD' ? '$' : '₹'}{client.billingAmount.toLocaleString('en-IN')}/{client.billingCycle === 'MONTHLY' ? 'mo' : client.billingCycle?.toLowerCase()}
          </span>
        )}
        {loginCount > 0 && (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300" title="Logins saved in the password vault">
            <KeyRound className="w-3 h-3" /> {loginCount}
          </span>
        )}
        {isInactive ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-status-absent">
            <span className="w-2 h-2 rounded-full bg-status-absent inline-block" />
            Inactive
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-status-present inline-block" />
            Active
          </span>
        )}
      </div>

      {/* Contact row */}
      <div
        className="flex items-center justify-center gap-3 pt-3 border-t border-gray-100 dark:border-white/10 text-zinc-500 dark:text-zinc-400"
        onClick={(e) => e.stopPropagation()}
      >
        {client.website && (
          <a
            href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:text-brand hover:bg-brand-light dark:hover:bg-brand/10 transition-colors duration-150"
            title={client.website}
          >
            <Globe className="w-4 h-4" />
          </a>
        )}
        {client.contactEmail && (
          <a
            href={`mailto:${client.contactEmail}`}
            className="p-1.5 rounded-lg hover:text-brand hover:bg-brand-light dark:hover:bg-violet-900/30 transition-colors duration-150"
            title={client.contactEmail}
          >
            <Mail className="w-4 h-4" />
          </a>
        )}
        {client.contactPhone && (
          <a
            href={`tel:${client.contactPhone}`}
            className="p-1.5 rounded-lg hover:text-brand hover:bg-brand-light dark:hover:bg-violet-900/30 transition-colors duration-150"
            title={client.contactPhone}
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        {!client.website && !client.contactEmail && !client.contactPhone && (
          <span className="text-xs">{taskCount} task{taskCount === 1 ? '' : 's'}</span>
        )}
      </div>
    </div>
  );
}
