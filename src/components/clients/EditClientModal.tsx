'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateClient } from '@/hooks/useClients';
import { useEmployeeList } from '@/hooks/useTasks';
import type { Client } from '@/types';

const schema = z.object({
  name:         z.string().min(1, 'Name is required').max(150),
  industry:     z.string().max(100).optional(),
  website:      z.string().max(300).optional(),
  contactName:  z.string().max(150).optional(),
  contactEmail: z.string().email('Enter a valid email').max(200).optional().or(z.literal('')),
  contactPhone: z.string().max(30).optional(),
  notes:        z.string().max(2000).optional(),
  accountLeadId: z.string().optional(),
  status:       z.enum(['ACTIVE', 'INACTIVE']),
});

type FormValues = z.infer<typeof schema>;

interface EditClientModalProps {
  client:  Client;
  onClose: () => void;
}

export function EditClientModal({ client, onClose }: EditClientModalProps) {
  const updateClient = useUpdateClient();
  const { data: employees = [] } = useEmployeeList();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:          client.name,
      industry:      client.industry ?? '',
      website:       client.website ?? '',
      contactName:   client.contactName ?? '',
      contactEmail:  client.contactEmail ?? '',
      contactPhone:  client.contactPhone ?? '',
      notes:         client.notes ?? '',
      accountLeadId: client.accountLeadId ?? '',
      status:        client.status,
    },
  });

  const fieldClass = (hasError: boolean) => cn(
    'w-full px-3 py-2.5 text-sm bg-white dark:bg-surface-dark-2 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 text-zinc-950 dark:text-white',
    hasError ? 'border-status-absent focus:ring-status-absent/30' : 'border-gray-300 dark:border-white/10',
  );

  function onSubmit(data: FormValues) {
    updateClient.mutate(
      { id: client.id, ...data, accountLeadId: data.accountLeadId || undefined },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
            <h2 className="text-base font-bold text-zinc-950 dark:text-white">Edit Client</h2>
            <button onClick={onClose} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">
                Client Name <span className="text-status-absent">*</span>
              </label>
              <input {...register('name')} autoFocus className={fieldClass(!!errors.name)} />
              {errors.name && <p className="text-xs text-status-absent mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Industry</label>
                <input {...register('industry')} className={fieldClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Website</label>
                <input {...register('website')} className={fieldClass(false)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Contact Person</label>
                <input {...register('contactName')} className={fieldClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Contact Email</label>
                <input {...register('contactEmail')} className={fieldClass(!!errors.contactEmail)} />
                {errors.contactEmail && <p className="text-xs text-status-absent mt-1">{errors.contactEmail.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Contact Phone</label>
                <input {...register('contactPhone')} className={fieldClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Account Lead</label>
                <select {...register('accountLeadId')} className={fieldClass(false)}>
                  <option value="">Unassigned</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Status</label>
              <div className="flex gap-4">
                {(['ACTIVE', 'INACTIVE'] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer select-none">
                    <input type="radio" value={s} {...register('status')} className="text-brand focus:ring-brand" />
                    {s === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Notes</label>
              <textarea {...register('notes')} rows={3} className={cn(fieldClass(false), 'resize-none')} placeholder="Internal notes about this client..." />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-150 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateClient.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 shadow-sm"
              >
                {updateClient.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
