import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Employee, EmployeeDocument, Leave, Task } from '@/types';
import type { UpdateEmployeeInput, CreateEmployeeInput } from '@/lib/validations/employee';

// ── Filters ───────────────────────────────────────────────────────────────────

export interface EmployeeFilters {
  search?:       string;
  department?:   string;
  page?:         number;
  showInactive?: boolean;
}

// ── Directory list ────────────────────────────────────────────────────────────

export function useEmployees(filters: EmployeeFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search)       params.set('search',       filters.search);
  if (filters.department)   params.set('department',   filters.department);
  if (filters.page)         params.set('page',         String(filters.page));
  if (filters.showInactive) params.set('showInactive', 'true');

  return useQuery({
    queryKey: ['employees', filters],
    queryFn: async (): Promise<{ data: Employee[]; total: number; page: number; limit: number }> => {
      const res = await fetch(`/api/employees?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json() as Promise<{ data: Employee[]; total: number; page: number; limit: number }>;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── Single employee ───────────────────────────────────────────────────────────

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: async (): Promise<Employee> => {
      const res = await fetch(`/api/employees/${id}`);
      if (!res.ok) throw new Error('Failed to fetch employee');
      const json = await res.json() as { data: Employee };
      return json.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

// ── Create (onboard) employee ─────────────────────────────────────────────────

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEmployeeInput): Promise<Employee> => {
      const res = await fetch('/api/employees', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to create employee');
      }
      const json = await res.json() as { data: Employee };
      return json.data;
    },
    onSuccess: (emp) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`Welcome email sent to ${emp.email}. Employee onboarded successfully.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Update profile ────────────────────────────────────────────────────────────

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateEmployeeInput): Promise<Employee> => {
      const res = await fetch(`/api/employees/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to update profile');
      }
      const json = await res.json() as { data: Employee };
      return json.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['employees', id], updated);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee profile updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Deactivate (soft delete) employee ────────────────────────────────────────

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to deactivate employee');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Documents ─────────────────────────────────────────────────────────────────

export function useEmployeeDocuments(id: string) {
  return useQuery({
    queryKey: ['employees', id, 'documents'],
    queryFn: async (): Promise<EmployeeDocument[]> => {
      const res = await fetch(`/api/employees/${id}/documents`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      const json = await res.json() as { data: EmployeeDocument[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUploadDocument(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<EmployeeDocument> => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/employees/${employeeId}/documents`, {
        method: 'POST',
        body:   form,
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Upload failed');
      }
      const json = await res.json() as { data: EmployeeDocument };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'documents'] });
      toast.success('Document uploaded');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDocument(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/employees/${employeeId}/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Delete failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'documents'] });
      toast.success('Document deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Employee leaves ───────────────────────────────────────────────────────────

export function useEmployeeLeaves(id: string) {
  return useQuery({
    queryKey: ['employees', id, 'leaves'],
    queryFn: async (): Promise<Leave[]> => {
      const res = await fetch(`/api/employees/${id}/leaves`);
      if (!res.ok) throw new Error('Failed to fetch leaves');
      const json = await res.json() as { data: Leave[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── Employee tasks ────────────────────────────────────────────────────────────

export function useEmployeeTasks(id: string) {
  return useQuery({
    queryKey: ['employees', id, 'tasks'],
    queryFn: async (): Promise<Task[]> => {
      const res = await fetch(`/api/employees/${id}/tasks`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const json = await res.json() as { data: Task[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
