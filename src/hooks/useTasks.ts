import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Task, TaskComment, TaskHistory } from '@/types';
import type { CreateTaskInput, UpdateTaskInput, CreateBugInput } from '@/lib/validations/task';
import type { TaskStatus, Priority, ItemType, Team } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaskFilters {
  projectId?:     string;
  status?:        TaskStatus;
  priority?:      Priority;
  assigneeId?:    string;
  myTasks?:       boolean;
  search?:        string;
  itemType?:      ItemType;
  clientId?:      string;
  team?:          Team;
  blocked?:       boolean;
  dueRange?:      'overdue' | 'this_week';
  assignedDay?:   string;
  assignedMonth?: string;
}

export type GroupBy = 'none' | 'client' | 'project' | 'team' | 'assignee';

export interface EmployeeListItem {
  id:          string;
  name:        string;
  avatarUrl:   string | null;
  designation: string | null;
}

// ── Tasks list ────────────────────────────────────────────────────────────────

export function useTasks(filters: TaskFilters = {}) {
  const params = new URLSearchParams();
  if (filters.projectId)  params.set('projectId',  filters.projectId);
  if (filters.status)     params.set('status',     filters.status);
  if (filters.priority)   params.set('priority',   filters.priority);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters.myTasks)    params.set('myTasks',    'true');
  if (filters.search)     params.set('search',     filters.search);
  if (filters.itemType)   params.set('itemType',   filters.itemType);
  if (filters.clientId)     params.set('clientId',     filters.clientId);
  if (filters.team)         params.set('team',         filters.team);
  if (filters.blocked)      params.set('blocked',      'true');
  if (filters.dueRange)     params.set('dueRange',     filters.dueRange);

  return useQuery({
    // Assignment-period filters are applied to the already fetched task list
    // so the task API and its existing date semantics remain unchanged.
    queryKey: ['tasks', params.toString()],
    queryFn: async (): Promise<Task[]> => {
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const json = await res.json() as { data: Task[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Single task ───────────────────────────────────────────────────────────────

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ['tasks', 'detail', id],
    queryFn: async (): Promise<Task> => {
      const res = await fetch(`/api/tasks/${id}`);
      if (!res.ok) throw new Error('Failed to fetch task');
      const json = await res.json() as { data: Task };
      return json.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60,
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput): Promise<Task> => {
      const res = await fetch('/api/tasks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to create task');
      }
      const json = await res.json() as { data: Task };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['performance'] });
      queryClient.invalidateQueries({ queryKey: ['task-completions'] });
      toast.success('Task created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Update (with optimistic update for Kanban drag) ───────────────────────────

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTaskInput & { id: string }): Promise<Task> => {
      const res = await fetch(`/api/tasks/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to update task');
      }
      const json = await res.json() as { data: Task };
      return json.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-completions'] });
      queryClient.invalidateQueries({ queryKey: ['performance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.setQueryData(['tasks', 'detail', updated.id], updated);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Create bug ───────────────────────────────────────────────────────────────

export function useCreateBug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBugInput): Promise<Task> => {
      const res = await fetch('/api/tasks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to report bug');
      }
      const json = await res.json() as { data: Task };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Reopen bug ──────────────────────────────────────────────────────────────

export function useReopenBug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/tasks/${id}/reopen`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to reopen bug');
      }
      const json = await res.json() as { data: Task };
      return json.data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Verify bug ──────────────────────────────────────────────────────────────

export function useVerifyBug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}/verify-bug`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to verify bug');
      }
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['task-completions'] });
      queryClient.invalidateQueries({ queryKey: ['performance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Bug verified successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to delete task');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-completions'] });
      queryClient.invalidateQueries({ queryKey: ['performance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Add comment ───────────────────────────────────────────────────────────────

export interface CommentInput {
  body:             Record<string, unknown>;
  bodyText:         string;
  mentionedUserIds: string[];
}

export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CommentInput): Promise<TaskComment> => {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to post comment');
      }
      const json = await res.json() as { data: TaskComment };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', taskId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Delete comment ────────────────────────────────────────────────────────────

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to delete comment');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', taskId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Task history ─────────────────────────────────────────────────────────────

export function useTaskHistory(taskId: string | null) {
  return useQuery({
    queryKey: ['tasks', 'history', taskId],
    queryFn: async (): Promise<TaskHistory[]> => {
      const res = await fetch(`/api/tasks/${taskId}/history`);
      if (!res.ok) throw new Error('Failed to fetch task history');
      const json = await res.json() as { data: TaskHistory[] };
      return json.data;
    },
    enabled: !!taskId,
    staleTime: 1000 * 30,
  });
}

// ── Employee list (for assignee picker) ──────────────────────────────────────

export function useEmployeeList() {
  return useQuery({
    queryKey: ['employees', 'list'],
    queryFn: async (): Promise<EmployeeListItem[]> => {
      const res = await fetch('/api/employees/list');
      if (!res.ok) throw new Error('Failed to fetch employees');
      const json = await res.json() as { data: EmployeeListItem[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ── Shared work: together / anyone ────────────────────────────────────────────

async function postJson<T>(url: string, method: string, body: unknown, fallback: string): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => ({})) as { data?: T; error?: unknown };
  if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : fallback);
  return json.data as T;
}

function useRefreshTasks() {
  const queryClient = useQueryClient();
  return (id: string) => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', id] });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'history', id] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['task-completions'] });
    queryClient.invalidateQueries({ queryKey: ['performance'] });
  };
}

/** First to accept an offered task takes it. */
export function useAcceptTask() {
  const refresh = useRefreshTasks();
  return useMutation({
    mutationFn: (id: string) => postJson<{ id: string }>(`/api/tasks/${id}/accept`, 'POST', undefined, 'Could not accept the task'),
    onSuccess: (_d, id) => { refresh(id); toast.success('It\u2019s yours \u2014 the others have been released'); },
    onError: (e: Error, id) => { refresh(id); toast.error(e.message); },
  });
}

/** Tick (or untick) my part of a shared task. */
export function useMarkPart() {
  const refresh = useRefreshTasks();
  return useMutation({
    mutationFn: ({ id, done, userId }: { id: string; done: boolean; userId?: string }) =>
      postJson<{ done: number; total: number; allDone: boolean; status: string }>(`/api/tasks/${id}/part`, 'POST', { done, userId }, 'Could not update the part'),
    onSuccess: (r, { id, done }) => {
      refresh(id);
      if (r.allDone && r.status === 'INTERNAL_REVIEW') toast.success('All parts done \u2014 moved to Internal Review');
      else toast.success(done ? `Part done (${r.done} of ${r.total})` : 'Part reopened');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Change who is on a task, or how (one person / together / anyone). */
export function useSetPeople() {
  const refresh = useRefreshTasks();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; mode: 'SINGLE' | 'TOGETHER' | 'OFFER'; people: { userId: string; role?: string }[]; assigneeId?: string | null }) =>
      postJson<{ id: string }>(`/api/tasks/${id}/people`, 'PUT', body, 'Could not change the people on this task'),
    onSuccess: (_d, { id }) => { refresh(id); toast.success('People updated'); },
    onError: (e: Error) => toast.error(e.message),
  });
}
