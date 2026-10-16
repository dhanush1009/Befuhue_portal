'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateClient } from '@/hooks/useClients';
import { useEmployeeList } from '@/hooks/useTasks';

const schema = z.object({
  name:         z.string().min(1, 'Name is required').max(150),
  industry:     z.string().max(100).optional(),
  website:      z.string().max(300).optional(),
  contactName:  z.string().max(150).optional(),
  contactEmail: z.string().email('Enter a valid email').max(200).optional().or(z.literal('')),
  contactPhone: z.string().max(30).optional(),
  accountLeadId: z.string().optional(),
  billingType:   z.string().optional(),
  billingAmount: z.string().optional(),
  billingCurrency: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddClientModalProps {
  onClose: () => void;
}

export function AddClientModal({ onClose }: AddClientModalProps) {
  const router = useRouter();
  const createClient = useCreateClient();
  const { data: employees = [] } = useEmployeeList();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      industry: '',
      website: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      accountLeadId: '',
      billingType: 'RETAINER',
      billingAmount: '',
      billingCurrency: 'INR',
    },
  });

  const fieldClass = (hasError: boolean) => cn(
    'w-full px-3 py-2.5 text-sm bg-white dark:bg-surface-dark-2 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 text-zinc-950 dark:text-white',
    hasError ? 'border-status-absent focus:ring-status-absent/30' : 'border-gray-300 dark:border-white/10',
  );

  function onSubmit(data: FormValues) {
    createClient.mutate(
      {
        ...data,
        accountLeadId: data.accountLeadId || undefined,
        billingAmount: data.billingAmount ? parseFloat(data.billingAmount) : undefined,
      },
      { onSuccess: (client) => { onClose(); router.push(`/clients/${client.id}`); } },
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
            <h2 className="text-base font-bold text-zinc-950 dark:text-white">New Client</h2>
            <button onClick={onClose} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">
                Client Name <span className="text-status-absent">*</span>
              </label>
              <input {...register('name')} placeholder="e.g. Acme Corp" autoFocus className={fieldClass(!!errors.name)} />
              {errors.name && <p className="text-xs text-status-absent mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Industry</label>
                <input {...register('industry')} placeholder="e.g. E-commerce" className={fieldClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Website</label>
                <input {...register('website')} placeholder="e.g. acme.com" className={fieldClass(false)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Contact Person</label>
                <input {...register('contactName')} placeholder="e.g. Jane Doe" className={fieldClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Contact Email</label>
                <input {...register('contactEmail')} placeholder="jane@acme.com" className={fieldClass(!!errors.contactEmail)} />
                {errors.contactEmail && <p className="text-xs text-status-absent mt-1">{errors.contactEmail.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Contact Phone</label>
                <input {...register('contactPhone')} placeholder="+91…" className={fieldClass(false)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-1.5">Account Lead</label>
                <select {...register('accountLeadId')} className={fieldClass(false)}>
                  <option value="">Unassigned</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            </div>

            {/* Optional Billing Details */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-surface-dark-3/60 border border-gray-200 dark:border-white/5 space-y-3">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-200">Billing Setup (Optional)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Model</label>
                  <select {...register('billingType')} className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-surface-dark-2 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white">
                    <option value="RETAINER">Retainer</option>
                    <option value="HOURLY">Hourly</option>
                    <option value="FIXED">Fixed</option>
                    <option value="MILESTONE">Milestone</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Currency</label>
                  <select {...register('billingCurrency')} className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-surface-dark-2 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white">
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Fee / Amount</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    {...register('billingAmount')}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-surface-dark-2 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Full billing terms, payment cycles, and invoices can be managed from the client page.
            </p>

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
                disabled={createClient.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 shadow-sm"
              >
                {createClient.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Client
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
