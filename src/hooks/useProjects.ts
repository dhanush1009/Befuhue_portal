import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Project, ProjectStatus } from '@/types';

export interface ProjectFilters {
  clientId?:   string;
  employeeId?: string;
  status?:     string;
  search?:     string;
}

export function useProjects(filters?: ProjectFilters | string) {
  const params = new URLSearchParams();
  if (typeof filters === 'string') {
    if (filters) params.set('clientId', filters);
  } else if (filters) {
    if (filters.clientId)   params.set('clientId', filters.clientId);
    if (filters.employeeId) params.set('employeeId', filters.employeeId);
    if (filters.status)     params.set('status', filters.status);
    if (filters.search)     params.set('search', filters.search);
  }

  const queryKey = typeof filters === 'string'
    ? ['projects', filters || 'all']
    : ['projects', filters?.clientId ?? 'all', filters?.employeeId ?? 'all', filters?.status ?? 'all', filters?.search ?? 'all'];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<Project[]> => {
      const res = await fetch(`/api/projects?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch projects');
      const json = await res.json() as { data: Project[] };
      return json.data;
    },
    staleTime: 1000 * 60,
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ['projects', 'detail', id],
    queryFn: async (): Promise<Project> => {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      const json = await res.json() as { data: Project };
      return json.data;
    },
    enabled: !!id,
  });
}

export interface CreateProjectInput {
  clientId:            string;
  name:                string;
  prefix?:             string;
  description?:        string;
  type?:               'FULL_REVAMP' | 'LP_BUILD' | 'RETAINER' | 'CUSTOM';
  startDate?:          string;
  targetDate?:         string;
  deadline?:           string;
  status?:             ProjectStatus;
  assignedEmployeeId?: string;
  amount?:             number;
  currency?:           string;
}

export interface UpdateProjectInput {
  id:                  string;
  name?:               string;
  description?:        string | null;
  clientId?:           string;
  type?:               'FULL_REVAMP' | 'LP_BUILD' | 'RETAINER' | 'CUSTOM';
  startDate?:          string | null;
  targetDate?:         string | null;
  deadline?:           string | null;
  status?:             ProjectStatus;
  assignedEmployeeId?: string | null;
  amount?:             number | null;
  currency?:           string;
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput): Promise<Project> => {
      const res = await fetch('/api/projects', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string | Record<string, unknown> };
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to create project');
      }
      const json = await res.json() as { data: Project };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created and assigned successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateProjectInput): Promise<Project> => {
      const res = await fetch(`/api/projects/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to update project');
      }
      const json = await res.json() as { data: Project };
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'detail', data.id] });
      toast.success('Project updated successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to delete project');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Project deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

import { executeExcelDownload } from '@/store/useExcelDownloadStore';

export function downloadProjectsExcel() {
  const filename = `Befhue_Projects_Master_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const exportUrl = `/api/projects/export/${filename}`;

  return executeExcelDownload(exportUrl, filename, 'Generating Projects Master Report...');
}

