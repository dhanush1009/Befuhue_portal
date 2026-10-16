'use client';

import { useState } from 'react';
import { Search, LayoutGrid, List, Users, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmployeeCard } from '@/components/hr/EmployeeCard';
import { EmployeeTable } from '@/components/hr/EmployeeTable';
import { OnboardEmployeeModal } from '@/components/hr/OnboardEmployeeModal';
import { AddPeopleModal } from '@/components/hr/AddPeopleModal';
import { DetailsProgress } from '@/components/hr/DetailsProgress';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { useEmployees } from '@/hooks/useEmployees';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/hooks/useAuth';
import { DEPARTMENTS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function HRPage() {
  const { isAdmin } = useAuth();
  const [search,        setSearch]        = useState('');
  const [department,    setDepartment]    = useState('');
  const [view,          setView]          = useState<'grid' | 'list'>('grid');
  const [page,          setPage]          = useState(1);
  const [showInactive,  setShowInactive]  = useState(false);
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [showOnboard,   setShowOnboard]   = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError } = useEmployees({
    search:       debouncedSearch || undefined,
    department:   department      || undefined,
    page,
    showInactive,
  });

  const employees  = data?.data  ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / (data?.limit ?? 25));

  const selectClass = 'text-sm bg-white dark:bg-surface-dark-2 border border-gray-200/90 dark:border-white/10 rounded-xl px-3 py-2 text-gray-800 dark:text-white font-medium focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 shadow-2xs cursor-pointer';

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <PageHeader
        title="People Directory"
        description={`${total} ${total !== 1 ? 'people' : 'person'} across your organisation`}
        actions={
          isAdmin ? (
            <button
              onClick={() => setShowAddPeople(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-brand text-white rounded-xl hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98] shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Add People
            </button>
          ) : undefined
        }
      />

      {isAdmin && <DetailsProgress />}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, email, designation…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-surface-dark-2 border border-gray-200/90 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 shadow-2xs"
          />
        </div>

        <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">All Departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Show inactive toggle */}
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={showInactive}
              onClick={() => { setShowInactive((v) => !v); setPage(1); }}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer',
                showInactive ? 'bg-brand' : 'bg-gray-200 dark:bg-surface-dark-3',
              )}
            >
              <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200', showInactive ? 'translate-x-4' : 'translate-x-0')} />
            </button>
            Show inactive
          </label>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-dark-2 border border-gray-200/80 dark:border-white/10 rounded-xl p-1 ml-auto">
          <button onClick={() => setView('grid')} className={cn('p-1.5 rounded-lg transition-colors duration-150 cursor-pointer', view === 'grid' ? 'bg-white dark:bg-surface-dark-3 text-brand shadow-xs' : 'text-gray-400 hover:text-gray-700 dark:hover:text-white')}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setView('list')} className={cn('p-1.5 rounded-lg transition-colors duration-150 cursor-pointer', view === 'list' ? 'bg-white dark:bg-surface-dark-3 text-brand shadow-xs' : 'text-gray-400 hover:text-gray-700 dark:hover:text-white')}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40">
            <SkeletonTable rows={8} columns={7} />
          </div>
        )
      ) : isError ? (
        <EmptyState icon={<Users className="w-10 h-10 text-gray-300" />} title="Failed to load employees" description="Please try refreshing the page." />
      ) : view === 'grid' ? (
        employees.length === 0 ? (
          <EmptyState
            icon={<Users className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
            title="No employees found"
            description="Try adjusting your search or filters."
            action={isAdmin ? (
              <button onClick={() => setShowAddPeople(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150">
                <UserPlus className="w-4 h-4" /> Add People
              </button>
            ) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((emp) => (
              <EmployeeCard key={emp.id} employee={emp} />
            ))}
          </div>
        )
      ) : (
        <EmployeeTable employees={employees} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500 dark:text-violet-300/55">Page {page} of {totalPages} · {total} total</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150">Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150">Next</button>
          </div>
        </div>
      )}

      {showAddPeople && <AddPeopleModal onClose={() => setShowAddPeople(false)} />}
      {showOnboard && <OnboardEmployeeModal onClose={() => setShowOnboard(false)} />}
    </div>
  );
}
