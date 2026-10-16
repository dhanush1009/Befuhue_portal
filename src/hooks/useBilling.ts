import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AgencyBillingSummary,
  AgencyProjectSummary,
  ProjectBillingDetail,
  ClientBillingSummary,
} from '@/types';

export interface AgencyProjectsResponse {
  agency: AgencyBillingSummary;
  projects: AgencyProjectSummary[];
}

export function useAgencySummaries() {
  return useQuery({
    queryKey: ['billing', 'agencies'],
    queryFn: async (): Promise<AgencyBillingSummary[]> => {
      const res = await fetch('/api/billing');
      if (!res.ok) {
        if (res.status === 403) throw new Error('Unauthorized — Admin access required');
        throw new Error('Failed to fetch agency billing summaries');
      }
      const json = (await res.json()) as { data: AgencyBillingSummary[] };
      return json.data;
    },
    staleTime: 1000 * 60,
  });
}

// Backward-compat alias
export const useBillingSummaries = useAgencySummaries;

export function useAgencyProjects(agencyId: string | null) {
  return useQuery({
    queryKey: ['billing', 'agency-projects', agencyId],
    queryFn: async (): Promise<AgencyProjectsResponse> => {
      const res = await fetch(`/api/billing/${agencyId}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error('Unauthorized — Admin access required');
        throw new Error('Failed to fetch agency projects');
      }
      const json = (await res.json()) as { data: AgencyProjectsResponse };
      return json.data;
    },
    enabled: !!agencyId,
    staleTime: 1000 * 30,
  });
}

export function useProjectBillingDetail(agencyId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: ['billing', 'project-detail', agencyId, projectId],
    queryFn: async (): Promise<ProjectBillingDetail> => {
      const res = await fetch(`/api/billing/${agencyId}/project/${projectId}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error('Unauthorized — Admin access required');
        throw new Error('Failed to fetch project billing details');
      }
      const json = (await res.json()) as { data: ProjectBillingDetail };
      return json.data;
    },
    enabled: !!agencyId && !!projectId,
    staleTime: 1000 * 30,
  });
}

/**
 * Helper to parse filename from Content-Disposition header.
 */
function parseFilenameFromHeader(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const match = disposition.match(/filename="?([^";]+)"?/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

export interface BillingDownloadFilterOptions {
  status?: string;
  search?: string;
}

import { executeExcelDownload } from '@/store/useExcelDownloadStore';

/**
 * Download genuine Excel workbook for a single project's billing.
 * Filename format: Billing_Report_AgencyName_ProjectName.xlsx
 */
export function downloadProjectBillingExcel(
  agencyId: string,
  projectId: string,
  agencyName: string,
  projectName: string,
  options?: BillingDownloadFilterOptions,
) {
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeAgency = sanitize(agencyName) || 'Agency';
  const safeProject = sanitize(projectName) || 'Project';
  const filename = `Billing_Report_${safeAgency}_${safeProject}.xlsx`;

  const params = new URLSearchParams();
  if (options?.status && options.status !== 'ALL') {
    params.set('status', options.status);
  }
  if (options?.search && options.search.trim()) {
    params.set('search', options.search.trim());
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  const exportUrl = `/api/billing/${encodeURIComponent(agencyId)}/project/${encodeURIComponent(projectId)}/export/${filename}${queryString}`;

  return executeExcelDownload(exportUrl, filename, 'Generating Excel Report...');
}

/**
 * Download consolidated Excel report for all projects under an agency.
 * Filename format: Billing_Report_AgencyName_All_Projects.xlsx
 */
export function downloadAgencyAllProjectsExcel(
  agencyId: string,
  agencyName: string,
  options?: BillingDownloadFilterOptions,
) {
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeAgency = sanitize(agencyName) || 'Agency';
  const filename = `Billing_Report_${safeAgency}_All_Projects.xlsx`;

  const params = new URLSearchParams();
  if (options?.status && options.status !== 'ALL') {
    params.set('status', options.status);
  }
  if (options?.search && options.search.trim()) {
    params.set('search', options.search.trim());
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  const exportUrl = `/api/billing/${encodeURIComponent(agencyId)}/export-all/${filename}${queryString}`;

  return executeExcelDownload(exportUrl, filename, `Generating Excel Report for ${agencyName}...`);
}

/**
 * Download billing Excel for client, agency, or project by ID.
 * Filename format: Billing_Report_EntityName.xlsx
 */
export function downloadBillingExcel(
  id: string,
  entityName: string,
  options?: BillingDownloadFilterOptions,
) {
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeEntity = sanitize(entityName) || 'Billing';
  const filename = `Billing_Report_${safeEntity}.xlsx`;

  const params = new URLSearchParams();
  if (options?.status && options.status !== 'ALL') {
    params.set('status', options.status);
  }
  if (options?.search && options.search.trim()) {
    params.set('search', options.search.trim());
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  const exportUrl = `/api/billing/${encodeURIComponent(id)}/export/${filename}${queryString}`;

  return executeExcelDownload(exportUrl, filename, `Generating Billing Excel for ${entityName}...`);
}

