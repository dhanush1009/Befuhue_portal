'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { updateEmployeeSchema, type UpdateEmployeeInput } from '@/lib/validations/employee';
import { useUpdateEmployee } from '@/hooks/useEmployees';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DEPARTMENTS } from '@/lib/constants';
import type { Employee } from '@/types';

interface WorkInfoTabProps {
  employee: Employee;
  isAdmin:  boolean;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-900 dark:text-white">{value || '—'}</p>
    </div>
  );
}

export function WorkInfoTab({ employee, isAdmin }: WorkInfoTabProps) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateEmployee(employee.id);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateEmployeeInput>({
    resolver: zodResolver(updateEmployeeSchema),
    defaultValues: {
      name:        employee.name,
      phone:       employee.phone       ?? '',
      department:  employee.department  ?? '',
      designation: employee.designation ?? '',
      managerId:   employee.managerId   ?? '',
      role:        employee.role,
    },
  });

  function onSubmit(data: UpdateEmployeeInput) {
    update.mutate(data, { onSuccess: () => setEditing(false) });
  }

  const inputClass = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

  if (!editing) {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <Field label="Designation" value={employee.designation} />
          <Field label="Department"  value={employee.department} />
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">Role</p>
            <StatusBadge status="active" className="capitalize" />
            <span className="ml-2 text-sm text-gray-900 dark:text-white">{employee.role}</span>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">Reports To</p>
            {employee.manager ? (
              <div className="flex items-center gap-2">
                <UserAvatar name={employee.manager.name} avatarUrl={employee.manager.avatarUrl} size="sm" />
                <span className="text-sm text-gray-900 dark:text-white">{employee.manager.name}</span>
              </div>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>
        </div>
        {isAdmin && (
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
          <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Designation</label>
          <input {...register('designation')} className={inputClass} />
          {errors.designation && <p className="text-xs text-status-absent mt-1">{errors.designation.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Department</label>
          <select {...register('department')} className={inputClass}>
            <option value="">Select department</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Role</label>
          <select {...register('role')} className={inputClass}>
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
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
        <button
          type="button"
          onClick={() => { reset(); setEditing(false); }}
          className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
