'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { updateOwnProfileSchema, type UpdateOwnProfileInput } from '@/lib/validations/employee';
import { useUpdateEmployee } from '@/hooks/useEmployees';
import type { Employee } from '@/types';

interface PersonalInfoTabProps {
  employee:  Employee;
  canEdit:   boolean;
  alwaysEdit?: boolean;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-900 dark:text-white">{value || '—'}</p>
    </div>
  );
}

export function PersonalInfoTab({ employee, canEdit, alwaysEdit = false }: PersonalInfoTabProps) {
  const [editing, setEditing] = useState(alwaysEdit);
  const update = useUpdateEmployee(employee.id);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateOwnProfileInput>({
    resolver: zodResolver(updateOwnProfileSchema),
    defaultValues: {
      name:      employee.name,
      phone:     employee.phone ?? '',
      avatarUrl: employee.avatarUrl ?? '',
    },
  });

  function onSubmit(data: UpdateOwnProfileInput) {
    update.mutate(data, {
      onSuccess: () => { if (!alwaysEdit) setEditing(false); },
    });
  }

  const inputClass = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

  if (!editing) {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <Field label="Full Name"   value={employee.name} />
          <Field label="Work Email"  value={employee.email} />
          <Field label="Phone"       value={employee.phone} />
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]"
          >
            Edit
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Full Name</label>
          <input {...register('name')} className={inputClass} />
          {errors.name && <p className="text-xs text-status-absent mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Work Email</label>
          <input value={employee.email} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Phone</label>
          <input {...register('phone')} className={inputClass} placeholder="+91 98765 43210" />
          {errors.phone && <p className="text-xs text-status-absent mt-1">{errors.phone.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Avatar URL</label>
          <input {...register('avatarUrl')} className={inputClass} placeholder="https://…" />
          {errors.avatarUrl && <p className="text-xs text-status-absent mt-1">{errors.avatarUrl.message}</p>}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={update.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
        >
          {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Changes
        </button>
        {!alwaysEdit && (
          <button
            type="button"
            onClick={() => { reset(); setEditing(false); }}
            className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
