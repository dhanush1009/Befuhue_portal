'use client';

import { useQuery } from '@tanstack/react-query';
import { differenceInDays, format } from 'date-fns';
import { Gift } from 'lucide-react';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Employee } from '@/types';

// We derive upcoming events from the employee list using createdAt as join date
// and a hypothetical dateOfBirth field. Since the schema doesn't have DOB yet,
// we use createdAt (work anniversary) as the only real data source.

interface UpcomingEvent {
  employee:  Employee;
  type:      'anniversary';
  daysUntil: number;
  date:      Date;
}

function getUpcomingAnniversaries(employees: Employee[]): UpcomingEvent[] {
  const today  = new Date();
  const events: UpcomingEvent[] = [];

  for (const emp of employees) {
    const joined    = new Date(emp.createdAt);
    const thisYear  = new Date(today.getFullYear(), joined.getMonth(), joined.getDate());
    const nextYear  = new Date(today.getFullYear() + 1, joined.getMonth(), joined.getDate());
    const candidate = thisYear >= today ? thisYear : nextYear;
    const days      = differenceInDays(candidate, today);

    if (days <= 14) {
      events.push({ employee: emp, type: 'anniversary', daysUntil: days, date: candidate });
    }
  }

  return events.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function BirthdayWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'all-for-birthdays'],
    queryFn: async (): Promise<Employee[]> => {
      const res = await fetch('/api/employees?limit=100');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json() as { data: Employee[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 60,
  });

  const events = data ? getUpcomingAnniversaries(data) : [];

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4 animate-pulse">
        <div className="h-3 bg-gray-200 dark:bg-surface-dark-3 rounded w-1/2 mb-3" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-surface-dark-3" />
            <div className="flex-1 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-3">
        Upcoming Anniversaries
      </p>

      {events.length === 0 ? (
        <EmptyState
          icon={<Gift className="w-8 h-8 text-gray-300 dark:text-violet-400/35" />}
          title="None in next 14 days"
        />
      ) : (
        <div className="space-y-1">
          {events.map(({ employee, daysUntil, date }) => {
            const isToday = daysUntil === 0;
            return (
              <div
                key={employee.id}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${isToday ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-gray-50 dark:hover:bg-surface-dark-3/50'} transition-colors duration-150`}
              >
                <UserAvatar name={employee.name} avatarUrl={employee.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{employee.name}</p>
                  <p className="text-xs text-gray-400 dark:text-violet-300/45">{format(date, 'MMM d')}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  isToday
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-violet-300/55'
                }`}>
                  {isToday ? 'Today! 🎉' : `in ${daysUntil}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
