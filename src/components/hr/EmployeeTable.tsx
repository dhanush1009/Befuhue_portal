'use client';

import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Employee } from '@/types';

interface EmployeeTableProps {
  employees: Employee[];
}

export function EmployeeTable({ employees }: EmployeeTableProps) {
  const router = useRouter();

  if (employees.length === 0) {
    return (
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40">
        <EmptyState
          icon={<Users className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
          title="No employees found"
          description="Try adjusting your search or filters."
        />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider bg-gray-50 dark:bg-surface-dark-3/50 border-b border-gray-100 dark:border-violet-900/40">
            <tr>
              <th className="px-5 py-3 text-left">Employee</th>
              <th className="px-5 py-3 text-left">Designation</th>
              <th className="px-5 py-3 text-left">Department</th>
              <th className="px-5 py-3 text-left">Email</th>
              <th className="px-5 py-3 text-left">Phone</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Joined</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-violet-900/25">
            {employees.map((emp) => (
              <tr
                key={emp.id}
                className="hover:bg-gray-50 dark:hover:bg-surface-dark-3/50 transition-colors duration-150"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={emp.name} avatarUrl={emp.avatarUrl} size="sm" />
                    <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{emp.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-gray-500 dark:text-violet-300/55 whitespace-nowrap">
                  {emp.designation ?? '—'}
                </td>
                <td className="px-5 py-3.5">
                  {emp.department ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-light text-brand dark:bg-violet-900/30 dark:text-violet-300">
                      {emp.department}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-5 py-3.5 text-gray-500 dark:text-violet-300/55 max-w-[180px] truncate">
                  {emp.email}
                </td>
                <td className="px-5 py-3.5 text-gray-500 dark:text-violet-300/55 whitespace-nowrap">
                  {emp.phone ?? '—'}
                </td>
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-status-present">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-present" />
                    Active
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 dark:text-violet-300/45 whitespace-nowrap text-xs">
                  {formatDate(emp.joiningDate ?? emp.createdAt)}
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => router.push(`/hr/${emp.id}`)}
                    className="text-xs font-medium text-brand hover:text-brand-hover hover:bg-brand-light dark:hover:bg-violet-900/30 px-3 py-1.5 rounded-lg transition-colors duration-150"
                  >
                    View Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
