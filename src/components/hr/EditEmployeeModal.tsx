'use client';

import { X, Loader2, AlertTriangle, Info, Globe2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateEmployee } from '@/hooks/useEmployees';
import { updateEmployeeSchema, updateOwnProfileSchema, type UpdateEmployeeInput, type UpdateOwnProfileInput } from '@/lib/validations/employee';
import { DEPARTMENTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import type { Employee } from '@/types';

function useAllEmployees(excludeId: string) {
  return useQuery({
    queryKey: ['employees', 'all'],
    queryFn: async (): Promise<Employee[]> => {
      const res = await fetch('/api/employees?limit=200');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json() as { data: Employee[] };
      return json.data.filter((e) => e.id !== excludeId);
    },
    staleTime: 1000 * 60 * 5,
  });
}

interface EditEmployeeModalProps {
  employee: Employee;
  isAdmin:  boolean;
  isSelf:   boolean;
  onClose:  () => void;
}

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';
const LABEL = 'text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block';

export function EditEmployeeModal({ employee, isAdmin, isSelf, onClose }: EditEmployeeModalProps) {
  const update = useUpdateEmployee(employee.id);
  const { data: allEmployees } = useAllEmployees(employee.id);

  // Admin uses full schema; employee uses own-profile schema
  const adminForm = useForm<UpdateEmployeeInput>({
    resolver: zodResolver(updateEmployeeSchema),
    defaultValues: {
      name:           employee.name,
      email:          employee.email,
      phone:          employee.phone ?? '',
      designation:    employee.designation ?? '',
      department:     employee.department ?? '',
      managerId:      employee.managerId ?? '',
      role:           employee.role,
      isActive:       (employee as Employee & { isActive?: boolean }).isActive ?? true,
      employmentType: ((employee as Employee & { employmentType?: string }).employmentType ?? 'FULL_TIME') as 'FULL_TIME' | 'PART_TIME' | 'CONTRACT',
      joiningDate:    employee.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '',
      attendanceMode: employee.attendanceMode ?? 'CLOCK_IN',
    },
  });

  const selfForm = useForm<UpdateOwnProfileInput>({
    resolver: zodResolver(updateOwnProfileSchema),
    defaultValues: {
      name:  employee.name,
      phone: employee.phone ?? '',
    },
  });

  const isActiveWatch = adminForm.watch('isActive');
  const anywhereWatch = adminForm.watch('attendanceMode') === 'ANYWHERE';

  function onAdminSubmit(data: UpdateEmployeeInput) {
    update.mutate(data, { onSuccess: onClose });
  }

  function onSelfSubmit(data: UpdateOwnProfileInput) {
    update.mutate(data, { onSuccess: onClose });
  }

  const EMPLOYMENT_TYPES = [
    { value: 'FULL_TIME', label: 'Full Time' },
    { value: 'PART_TIME', label: 'Part Time' },
    { value: 'CONTRACT',  label: 'Contract' },
  ] as const;

  const empType = adminForm.watch('employmentType');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Edit Employee — {employee.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Non-admin info banner */}
          {!isAdmin && isSelf && (
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-5">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                You can only edit your personal information. Contact HR to update role or department.
              </p>
            </div>
          )}

          {isAdmin ? (
            <form id="edit-form" onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
              {/* Deactivation warning */}
              {!isActiveWatch && (
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This will deactivate the employee&apos;s account. All pending tasks will be unassigned.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Full Name</label>
                  <input {...adminForm.register('name')} className={IC} />
                </div>
                <div>
                  <label className={LABEL}>Work Email</label>
                  <input {...adminForm.register('email')} type="email" className={IC} />
                  {adminForm.formState.errors.email && <p className="text-xs text-status-absent mt-1">{adminForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <label className={LABEL}>Phone</label>
                  <input {...adminForm.register('phone')} className={IC} />
                </div>
                <div>
                  <label className={LABEL}>Designation</label>
                  <input {...adminForm.register('designation')} className={IC} />
                </div>
                <div>
                  <label className={LABEL}>Department</label>
                  <select {...adminForm.register('department')} className={IC}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Role</label>
                  <select {...adminForm.register('role')} className={IC}>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Reports To</label>
                  <select {...adminForm.register('managerId')} className={IC}>
                    <option value="">No one</option>
                    {(allEmployees ?? []).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}{e.designation ? ` — ${e.designation}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Joining Date</label>
                  <input {...adminForm.register('joiningDate')} type="date" className={cn(IC, 'dark:[color-scheme:dark]')} />
                </div>
              </div>

              <div>
                <label className={LABEL}>Employment Type</label>
                <div className="flex rounded-lg border border-gray-200 dark:border-violet-900/40 overflow-hidden">
                  {EMPLOYMENT_TYPES.map((et) => (
                    <label
                      key={et.value}
                      className={cn(
                        'flex-1 text-center py-2 text-sm font-medium cursor-pointer transition-colors duration-150',
                        empType === et.value
                          ? 'bg-brand text-white'
                          : 'text-gray-600 dark:text-violet-300/55 hover:bg-gray-50 dark:hover:bg-surface-dark-3',
                      )}
                    >
                      <input type="radio" {...adminForm.register('employmentType')} value={et.value} className="sr-only" />
                      {et.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Attendance mode */}
              <div className="flex items-center justify-between gap-4 py-3 border-t border-gray-100 dark:border-violet-900/30">
                <div className="flex items-start gap-3">
                  <Globe2 className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Works from anywhere</p>
                    <p className="text-xs text-gray-400 dark:text-violet-300/45">
                      No clock-in needed — never shown as absent. Ideal for founders and leaders on the move.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={anywhereWatch}
                  onClick={() => adminForm.setValue('attendanceMode', anywhereWatch ? 'CLOCK_IN' : 'ANYWHERE', { shouldDirty: true })}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                    anywhereWatch ? 'bg-brand' : 'bg-gray-300 dark:bg-surface-dark-3',
                  )}
                >
                  <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200', anywhereWatch ? 'translate-x-4' : 'translate-x-0')} />
                </button>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-violet-900/30">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Account Status</p>
                  <p className="text-xs text-gray-400 dark:text-violet-300/45">Toggle to activate or deactivate this account</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActiveWatch}
                  onClick={() => adminForm.setValue('isActive', !isActiveWatch)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                    isActiveWatch ? 'bg-status-present' : 'bg-gray-300 dark:bg-surface-dark-3',
                  )}
                >
                  <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200', isActiveWatch ? 'translate-x-4' : 'translate-x-0')} />
                </button>
              </div>
            </form>
          ) : (
            <form id="edit-form" onSubmit={selfForm.handleSubmit(onSelfSubmit)} className="space-y-4">
              <div>
                <label className={LABEL}>Full Name</label>
                <input {...selfForm.register('name')} className={IC} />
              </div>
              <div>
                <label className={LABEL}>Phone</label>
                <input {...selfForm.register('phone')} className={IC} placeholder="+91 98765 43210" />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            Cancel
          </button>
          <button
            type="submit"
            form="edit-form"
            disabled={update.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
          >
            {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
