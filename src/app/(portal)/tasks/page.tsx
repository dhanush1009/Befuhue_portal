'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useUIStore } from '@/store/useUIStore';
import { useTasks, type TaskFilters, type GroupBy } from '@/hooks/useTasks';
import { KanbanBoard }            from '@/components/tasks/KanbanBoard';
import { ListView }               from '@/components/tasks/ListView';
import { TaskToolbar, type ViewMode } from '@/components/tasks/TaskToolbar';
import { TaskDetailPanel }        from '@/components/tasks/TaskDetailPanel';
import { TaskForm }               from '@/components/tasks/TaskForm';
import { ProjectForm }            from '@/components/tasks/ProjectForm';
import { ItemTypeSelector }       from '@/components/tasks/ItemTypeSelector';
import { PageLoader }             from '@/components/shared/PageLoader';
import type { Task } from '@/types';
import type { TaskStatus } from '@prisma/client';

const BugReportForm = dynamic(
  () => import('@/components/tasks/BugReportForm').then((m) => m.BugReportForm),
  { ssr: false, loading: () => <PageLoader /> },
);

const LS_VIEW    = 'tp-tasks-view';
const LS_PROJECT = 'tp-tasks-project';

// ── Inner component — uses useSearchParams (must be inside Suspense) ──────────

function TasksInner() {
  const searchParams = useSearchParams();
  const nav          = useRouter();
  const { setPageTitle } = useUIStore();

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem(LS_VIEW) as ViewMode) ?? 'board';
    return 'board';
  });

  const [filters, setFilters] = useState<TaskFilters>(() => {
    if (typeof window !== 'undefined') {
      const pid = localStorage.getItem(LS_PROJECT);
      return pid ? { projectId: pid } : {};
    }
    return {};
  });

  const [selectedTaskId,    setSelectedTaskId]    = useState<string | null>(searchParams?.get('task') ?? null);
  const [showItemSelector,  setShowItemSelector]  = useState(false);
  const [showTaskForm,      setShowTaskForm]      = useState(false);
  const [showBugForm,       setShowBugForm]       = useState(false);
  const [showProjectForm,   setShowProjectForm]   = useState(false);
  const [defaultStatus,     setDefaultStatus]     = useState<TaskStatus>('TO_DO');
  const [groupBy,           setGroupBy]           = useState<GroupBy>('none');

  const { data: tasks = [], isLoading } = useTasks(filters);

  useEffect(() => { setPageTitle('Task Board'); }, [setPageTitle]);

  const handleViewChange = useCallback((v: ViewMode) => {
    setView(v);
    localStorage.setItem(LS_VIEW, v);
  }, []);

  const handleFilters = useCallback((f: TaskFilters) => {
    setFilters(f);
    if (f.projectId) localStorage.setItem(LS_PROJECT, f.projectId);
    else             localStorage.removeItem(LS_PROJECT);
  }, []);

  const handleOpenTask = useCallback((task: Task) => {
    setSelectedTaskId(task.id);
    nav.push(`/tasks?task=${task.id}`, { scroll: false });
  }, [nav]);

  const handleClosePanel = useCallback(() => {
    setSelectedTaskId(null);
    nav.push('/tasks', { scroll: false });
  }, [nav]);

  const handleAddTask = useCallback((status: TaskStatus) => {
    setDefaultStatus(status);
    setShowTaskForm(true);
  }, []);

  function handleItemTypeSelect(type: 'TASK' | 'BUG') {
    setShowItemSelector(false);
    if (type === 'TASK') setShowTaskForm(true);
    else                 setShowBugForm(true);
  }

  return (
    <div className="flex flex-col h-full">
      <TaskToolbar
        view={view}
        onViewChange={handleViewChange}
        filters={filters}
        onFilters={handleFilters}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onNewItem={() => {
          setDefaultStatus('TO_DO');
          setShowTaskForm(true);
        }}
        onNewProject={() => setShowProjectForm(true)}
      />

      {isLoading ? (
        <PageLoader />
      ) : view === 'board' ? (
        <KanbanBoard
          tasks={tasks}
          filters={filters}
          groupBy={groupBy}
          onOpen={handleOpenTask}
          onAddTask={handleAddTask}
        />
      ) : (
        <ListView tasks={tasks} onOpen={handleOpenTask} />
      )}

      {selectedTaskId && (
        <TaskDetailPanel taskId={selectedTaskId} onClose={handleClosePanel} />
      )}

      {showItemSelector && (
        <ItemTypeSelector
          onSelect={handleItemTypeSelect}
          onClose={() => setShowItemSelector(false)}
        />
      )}

      {showTaskForm && (
        <TaskForm
          defaultStatus={defaultStatus as 'TO_DO' | 'IN_PROGRESS' | 'INTERNAL_REVIEW' | 'CLIENT_REVIEW' | 'DONE' | 'CLOSED'}
          defaultProjectId={filters.projectId}
          onClose={() => setShowTaskForm(false)}
        />
      )}

      {showBugForm && (
        <BugReportForm
          defaultStatus={defaultStatus}
          defaultProjectId={filters.projectId}
          onClose={() => setShowBugForm(false)}
        />
      )}

      {showProjectForm && (
        <ProjectForm onClose={() => setShowProjectForm(false)} />
      )}
    </div>
  );
}

// ── Page — wraps inner in Suspense (required by Next.js for useSearchParams) ──

export default function TasksPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <TasksInner />
    </Suspense>
  );
}
