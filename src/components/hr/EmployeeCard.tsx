'use client';

import { useRouter } from 'next/navigation';
import { Mail, Phone, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn, getInitials } from '@/lib/utils';
import type { Employee } from '@/types';

function avatarColor(name: string): string {
  const colors = [
    'bg-violet-100 text-violet-700',
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

function copyToClipboard(value: string, label: string) {
  navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`));
}

type EmployeeWithActive = Employee & { isActive?: boolean; tempPassword?: string | null };

interface EmployeeCardProps {
  employee: EmployeeWithActive;
}

export function EmployeeCard({ employee }: EmployeeCardProps) {
  const router   = useRouter();
  const isActive = employee.isActive !== false; // default true if field absent
  const isPendingInvite = !isActive && !!employee.tempPassword?.startsWith('INVITE:');

  return (
    <div
      onClick={() => router.push(`/hr/${employee.id}`)}
      className={cn(
        'bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200/90 dark:border-white/10 p-5 cursor-pointer shadow-xs hover:shadow-md hover:border-brand/40 dark:hover:border-white/20 transition-all duration-200 group',
        !isActive && !isPendingInvite && 'opacity-50 grayscale',
        isPendingInvite && 'border-amber-400/50 dark:border-amber-500/30',
      )}
    >
      {/* Avatar + name */}
      <div className="flex flex-col items-center text-center mb-4">
        <div
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold mb-3 overflow-hidden border-2 border-white dark:border-white/10 shadow-xs',
            !employee.avatarUrl && avatarColor(employee.name),
          )}
        >
          {employee.avatarUrl ? (
            <img src={employee.avatarUrl} alt={employee.name} className="w-full h-full object-cover" />
          ) : (
            getInitials(employee.name)
          )}
        </div>
        <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">{employee.name}</p>
        <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mt-1 truncate w-full">
          {employee.designation ?? '—'}
        </p>
      </div>

      {/* Department pill + status dot */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {employee.department && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand/10 text-brand border border-brand/20">
            {employee.department}
          </span>
        )}
        {isActive ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
            Active
          </span>
        ) : isPendingInvite ? (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <span className="size-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
            Pending Invite
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
            <span className="size-1.5 rounded-full bg-rose-500 inline-block" />
            Inactive
          </span>
        )}
      </div>

      {/* Contact icons */}
      <div
        className="flex items-center justify-center gap-3 pt-3 border-t border-gray-100 dark:border-violet-900/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative group/tip">
          <button
            onClick={() => copyToClipboard(employee.email, 'Email')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand hover:bg-brand-light dark:hover:bg-violet-900/30 transition-colors duration-150"
          >
            <Mail className="w-4 h-4" />
          </button>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs bg-gray-900 text-white rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-10">
            {employee.email}
          </span>
        </div>

        {employee.phone && (
          <div className="relative group/tip">
            <button
              onClick={() => copyToClipboard(employee.phone!, 'Phone')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-brand hover:bg-brand-light dark:hover:bg-violet-900/30 transition-colors duration-150"
            >
              <Phone className="w-4 h-4" />
            </button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs bg-gray-900 text-white rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-10">
              {employee.phone}
            </span>
          </div>
        )}

        <button
          onClick={() => copyToClipboard(employee.email, 'Email')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-brand hover:bg-brand-light dark:hover:bg-violet-900/30 transition-colors duration-150"
          title="Copy email"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
