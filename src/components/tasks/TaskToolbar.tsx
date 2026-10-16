'use client';

import { LayoutGrid, List, Search, Plus, ChevronDown, X, CheckSquare, AlertTriangle } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useEmployeeList } from '@/hooks/useTasks';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/hooks/useAuth';
import { PRIORITY_LEVELS } from '@/lib/constants';
import { useState, useEffect } from 'react';
import type { TaskFilters, GroupBy } from '@/hooks/useTasks';
import type { Priority, ItemType } from '@prisma/client';

export type ViewMode = 'board' | 'list';

interface TaskToolbarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  filters: TaskFilters;
  onFilters: (f: TaskFilters) => void;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  onNewItem: () => void;
  onNewProject?: () => void;
}

// ── Reusable filter dropdown ──────────────────────────────────────────────────

interface FilterDropdownProps {
  label: string;
  active: boolean;
  children: React.ReactNode;
}

function FilterDropdown({ label, active, children }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition-colors duration-150 active:scale-[0.98]',
          active
            ? 'bg-brand/10 border-brand/30 text-brand dark:bg-violet-900/30 dark:border-violet-500/40 dark:text-violet-300'
            : 'bg-white dark:bg-[#131317] border-gray-200 dark:border-violet-900/40 text-gray-700 dark:text-violet-200 hover:border-violet-200 dark:hover:border-violet-500',
        )}
      >
        <span>{label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 min-w-[200px] bg-white dark:bg-[#101014] border border-gray-200 dark:border-violet-900/40 rounded-xl shadow-lg py-1 z-20"
            onClick={() => setOpen(false)}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TaskToolbar({ view, onViewChange, filters, onFilters, groupBy, onGroupByChange, onNewItem, onNewProject }: TaskToolbarProps) {
  const { isAdmin } = useAuth();
  const { data: employees = [] } = useEmployeeList();
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects(filters.clientId);

  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    onFilters({ ...filters, search: debouncedSearch || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const selectedProject = projects.find((p) => p.id === filters.projectId);
  const selectedEmployee = employees.find((e) => e.id === filters.assigneeId);
  const selectedClient = clients.find((c) => c.id === filters.clientId);

  const DUE_RANGES: { value: 'overdue' | 'this_week'; label: string }[] = [
    { value: 'overdue', label: 'Overdue' },
    { value: 'this_week', label: 'Due this week' },
  ];
  const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'client', label: 'Client' },
    { value: 'project', label: 'Project' },
    { value: 'team', label: 'Team' },
    { value: 'assignee', label: 'Assignee' },
  ];

  // Count active filters (excluding search + myTasks which have their own UI)
  const activeFilterCount = [
    filters.projectId, filters.assigneeId, filters.priority, filters.itemType,
    filters.clientId, filters.dueRange,
    filters.blocked ? 'blocked' : undefined,
  ].filter(Boolean).length;

  function clearAllFilters() {
    setSearchInput('');
    onFilters({ myTasks: filters.myTasks });
  }

  const optionClass = (active: boolean) => cn(
    'w-full text-left px-3 py-2 text-sm transition-colors duration-150 flex items-center gap-2',
    active
      ? 'text-brand font-medium bg-brand/5 dark:bg-violet-900/20'
      : 'text-gray-700 dark:text-violet-200 hover:bg-gray-50 dark:hover:bg-violet-500/10',
  );

  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">

      {/* ── Item type segmented control (All / Tasks) ── */}
      <div className="flex items-center bg-gray-100 dark:bg-[#131317] rounded-lg p-0.5">
        {([undefined, 'TASK'] as (ItemType | undefined)[]).map((type) => (
          <button
            key={type ?? 'all'}
            onClick={() => onFilters({ ...filters, itemType: type })}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150',
              filters.itemType === type
                ? 'bg-white dark:bg-violet-500/15 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-violet-300/80 hover:text-gray-700 dark:hover:text-violet-100',
            )}
          >
            {type === 'TASK' && <CheckSquare className="w-3 h-3 text-brand" />}
            {type === undefined ? 'All' : 'Tasks'}
          </button>
        ))}
      </div>

      {/* ── Assignee filter ── */}
      <FilterDropdown
        label={selectedEmployee ? selectedEmployee.name.split(' ')[0] : 'Assignee'}
        active={!!filters.assigneeId}
      >
        <button
          className={optionClass(!filters.assigneeId)}
          onClick={() => onFilters({ ...filters, assigneeId: undefined })}
        >
          All Assignees
        </button>
        <button
          className={optionClass(filters.assigneeId === 'unassigned')}
          onClick={() => onFilters({ ...filters, assigneeId: 'unassigned' })}
        >
          <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-violet-500/15 flex items-center justify-center text-[9px] text-gray-400 shrink-0">—</span>
          Unassigned
        </button>
        <div className="border-t border-gray-100 dark:border-violet-900/30 my-1" />
        {employees.map((e) => (
          <button
            key={e.id}
            className={optionClass(filters.assigneeId === e.id)}
            onClick={() => onFilters({ ...filters, assigneeId: e.id })}
          >
            <div className="w-5 h-5 rounded-full bg-brand-light dark:bg-brand/20 text-brand flex items-center justify-center text-[9px] font-semibold overflow-hidden border border-brand/20 shrink-0">
              {e.avatarUrl
                ? <img src={e.avatarUrl} alt={e.name} className="w-full h-full object-cover" />
                : getInitials(e.name)}
            </div>
            <span className="flex-1 truncate">{e.name}</span>
            {e.designation && (
              <span className="text-xs text-gray-400 dark:text-violet-400/60 truncate max-w-[80px] shrink-0">{e.designation}</span>
            )}
          </button>
        ))}
      </FilterDropdown>

      {/* ── Priority filter ── */}
      <FilterDropdown
        label={filters.priority ?? 'Priority'}
        active={!!filters.priority}
      >
        <button
          className={optionClass(!filters.priority)}
          onClick={() => onFilters({ ...filters, priority: undefined })}
        >
          All Priorities
        </button>
        {PRIORITY_LEVELS.map((p) => (
          <button
            key={p.value}
            className={optionClass(filters.priority === p.value)}
            onClick={() => onFilters({ ...filters, priority: p.value as Priority })}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            {p.label}
          </button>
        ))}
      </FilterDropdown>

      {/* ── Client filter ── */}
      <FilterDropdown
        label={selectedClient ? selectedClient.name : 'Client'}
        active={!!filters.clientId}
      >
        <button
          className={optionClass(!filters.clientId)}
          onClick={() => onFilters({ ...filters, clientId: undefined, projectId: undefined })}
        >
          All Clients
        </button>
        {clients.map((c) => (
          <button
            key={c.id}
            className={optionClass(filters.clientId === c.id)}
            onClick={() => onFilters({ ...filters, clientId: c.id, projectId: undefined })}
          >
            <span className="flex-1 truncate">{c.name}</span>
          </button>
        ))}
      </FilterDropdown>

      {/* ── Project filter (narrows to selected client, if any) ── */}
      <FilterDropdown
        label={selectedProject ? selectedProject.name : 'Project'}
        active={!!filters.projectId}
      >
        <button
          className={optionClass(!filters.projectId)}
          onClick={() => onFilters({ ...filters, projectId: undefined })}
        >
          All Projects
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            className={optionClass(filters.projectId === p.id)}
            onClick={() => onFilters({ ...filters, projectId: p.id })}
          >
            <span className="flex-1 truncate">{p.name}</span>
            <span className="text-xs font-mono text-gray-400 dark:text-violet-400/60 shrink-0">{p.prefix}</span>
          </button>
        ))}
        {isAdmin && onNewProject && (
          <>
            <div className="border-t border-gray-100 dark:border-violet-900/30 my-1" />
            <button
              className="w-full text-left px-3 py-2 text-sm text-brand hover:bg-brand/5 transition-colors duration-150 flex items-center gap-1.5"
              onClick={onNewProject}
            >
              <Plus className="w-3.5 h-3.5" /> New Project
            </button>
          </>
        )}
      </FilterDropdown>

      {/* ── Due filter ── */}
      <FilterDropdown
        label={filters.dueRange ? DUE_RANGES.find((d) => d.value === filters.dueRange)!.label : 'Due'}
        active={!!filters.dueRange}
      >
        <button
          className={optionClass(!filters.dueRange)}
          onClick={() => onFilters({ ...filters, dueRange: undefined })}
        >
          Any time
        </button>
        {DUE_RANGES.map((d) => (
          <button
            key={d.value}
            className={optionClass(filters.dueRange === d.value)}
            onClick={() => onFilters({ ...filters, dueRange: d.value })}
          >
            {d.label}
          </button>
        ))}
      </FilterDropdown>

      {/* ── Blocked-only toggle ── */}
      <button
        onClick={() => onFilters({ ...filters, blocked: !filters.blocked })}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition-colors duration-150 active:scale-[0.98]',
          filters.blocked
            ? 'bg-red-50 border-red-300 text-red-600 dark:bg-red-500/15 dark:border-red-500/40 dark:text-red-400'
            : 'bg-white dark:bg-[#131317] border-gray-200 dark:border-violet-900/40 text-gray-700 dark:text-violet-200 hover:border-red-200 dark:hover:border-red-500/40',
        )}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Blocked
      </button>

      {/* ── Group-by ── */}
      <FilterDropdown
        label={`Group: ${GROUP_OPTIONS.find((g) => g.value === groupBy)!.label}`}
        active={groupBy !== 'none'}
      >
        {GROUP_OPTIONS.map((g) => (
          <button
            key={g.value}
            className={optionClass(groupBy === g.value)}
            onClick={() => onGroupByChange(g.value)}
          >
            {g.label}
          </button>
        ))}
      </FilterDropdown>

      {/* ── Clear all filters ── */}
      {activeFilterCount > 0 && (
        <button
          onClick={clearAllFilters}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 dark:text-violet-400/60 hover:text-status-absent hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-150"
          title="Clear all filters"
        >
          <X className="w-3.5 h-3.5" />
          Clear ({activeFilterCount})
        </button>
      )}

      {/* ── View toggle ── */}
      <div className="flex items-center bg-gray-100 dark:bg-[#131317] rounded-lg p-0.5">
        {(['board', 'list'] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150',
              view === v
                ? 'bg-white dark:bg-violet-500/15 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-violet-300/80 hover:text-gray-700 dark:hover:text-violet-100',
            )}
          >
            {v === 'board' ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── My Tasks toggle ── */}
      <button
        onClick={() => onFilters({ ...filters, myTasks: !filters.myTasks })}
        className={cn(
          'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 active:scale-[0.98]',
          filters.myTasks
            ? 'bg-brand text-white border-brand'
            : 'bg-white dark:bg-[#131317] text-gray-600 dark:text-violet-200 border-gray-200 dark:border-violet-900/40 hover:border-violet-200 dark:hover:border-violet-500',
        )}
      >
        My Tasks
      </button>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search tasks..."
          className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#131317] border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200 placeholder:text-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 w-44"
        />
      </div>

      {/* ── New item ── */}
      <button
        onClick={onNewItem}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors duration-150 active:scale-[0.98] shadow-sm"
      >
        <Plus className="w-4 h-4" />
        New Item
      </button>
    </div>
  );
}
