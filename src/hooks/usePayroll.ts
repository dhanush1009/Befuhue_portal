import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Payslip, EmployeeSalary } from '@/types';
import type { SalaryInput, CalculatePayrollInput, PublishBulkInput } from '@/lib/validations/payroll';

// ── Employee: own published payslips ─────────────────────────────────────────

export function useMyPayslips() {
  return useQuery({
    queryKey: ['payslips', 'mine'],
    queryFn: async () => {
      const res = await fetch('/api/payslips');
      if (!res.ok) throw new Error('Failed to fetch payslips');
      return (await res.json() as { data: Payslip[] }).data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function usePayslip(id: string | null) {
  return useQuery({
    queryKey: ['payslips', id],
    enabled:  !!id,
    queryFn: async () => {
      const res = await fetch(`/api/payslips/${id}`);
      if (!res.ok) throw new Error('Failed to fetch payslip');
      return (await res.json() as { data: Payslip }).data;
    },
  });
}

// ── Admin: all payslips with filters ─────────────────────────────────────────

export function useAllPayslips(month?: number, year?: number, userId?: string) {
  const params = new URLSearchParams();
  if (month)  params.set('month',  String(month));
  if (year)   params.set('year',   String(year));
  if (userId) params.set('userId', userId);

  return useQuery({
    queryKey: ['payslips', 'all', month, year, userId],
    queryFn: async () => {
      const res = await fetch(`/api/payslips?${params}`);
      if (!res.ok) throw new Error('Failed to fetch payslips');
      return (await res.json() as { data: Payslip[] }).data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── Admin: payroll summary for a month ───────────────────────────────────────

export function usePayrollSummary(month: number, year: number) {
  return useQuery({
    queryKey: ['payroll-summary', month, year],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payroll/summary/${month}/${year}`);
      if (!res.ok) throw new Error('Failed to fetch payroll summary');
      return (await res.json() as { data: unknown[] }).data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── Salary config ─────────────────────────────────────────────────────────────

export function useEmployeeSalary(userId: string | null) {
  return useQuery({
    queryKey: ['salary', userId],
    enabled:  !!userId,
    queryFn: async () => {
      const res = await fetch(`/api/admin/payroll/salary/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch salary');
      return (await res.json() as { data: EmployeeSalary | null }).data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useSaveSalary(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: SalaryInput) => {
      const res = await fetch(`/api/admin/payroll/salary/${userId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save salary');
      return (await res.json() as { data: EmployeeSalary }).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary', userId] });
      toast.success('Salary configuration saved');
    },
    onError: () => toast.error('Failed to save salary'),
  });
}

// ── Calculate (run) payroll ───────────────────────────────────────────────────

export function useCalculatePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CalculatePayrollInput) => {
      const res = await fetch('/api/admin/payroll/calculate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to calculate payroll');
      return (await res.json() as { data: { calculated: number; errors: string[]; payPeriod: string } }).data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['payslips'] });
      qc.invalidateQueries({ queryKey: ['payroll-summary'] });
      const errMsg = data.errors.length ? ` (${data.errors.length} skipped)` : '';
      toast.success(`Payroll calculated: ${data.calculated} payslips for ${data.payPeriod}${errMsg}`);
    },
    onError: () => toast.error('Failed to run payroll'),
  });
}

// ── Publish payslips (bulk) ───────────────────────────────────────────────────

export function usePublishBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: PublishBulkInput) => {
      const res = await fetch('/api/admin/payroll/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to publish payslips');
      return (await res.json() as { data: { published: number; payPeriod: string } }).data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['payslips'] });
      toast.success(`${data.published} payslips published for ${data.payPeriod}`);
    },
    onError: () => toast.error('Failed to publish payslips'),
  });
}

// Single payslip publish (admin table row action)
export function usePublishPayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payslipId: string) => {
      const res = await fetch(`/api/payroll/payslips/${payslipId}/publish`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to publish payslip');
      return (await res.json() as { data: Payslip }).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payslips'] });
      toast.success('Payslip published to employee');
    },
    onError: () => toast.error('Failed to publish payslip'),
  });
}

export function useVoidPayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payslipId: string) => {
      const res = await fetch(`/api/payroll/payslips/${payslipId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to void payslip');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payslips'] });
      toast.success('Payslip voided');
    },
    onError: () => toast.error('Failed to void payslip'),
  });
}

// ── Payroll preview (calculate without saving) ───────────────────────────────

export interface PayrollPreviewResult {
  totalDays:            number;
  sundays:              number;
  workingDays:          number;
  leaveTakenDays:       number;
  earnedLeaveAvailable: number;
  earnedLeaveUsed:      number;
  earnedLeaveBalance:   number;
  lopDays:              number;
  paidDays:             number;
  basic:                number;
  hra:                  number;
  conveyance:           number;
  medicalAllowance:     number;
  specialAllowance:     number;
  bonus:                number;
  incentive:            number;
  grossEarnings:        number;
  incomeTax:            number;
  providentFund:        number;
  esi:                  number;
  professionalTax:      number;
  otherDeductions:      number;
  lopDeduction:         number;
  totalDeductions:      number;
  totalNetPay:          number;
  amountInWords:        string;
  salary:               EmployeeSalary;
}

export function usePayrollPreview() {
  return useMutation({
    mutationFn: async (params: { employeeId: string; month: number; year: number }) => {
      const res = await fetch('/api/admin/payroll/preview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to preview payroll');
      }
      return (await res.json() as { data: PayrollPreviewResult }).data;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Download PDF — S3 redirect ───────────────────────────────────────────────

export function useDownloadPayslip() {
  return useMutation({
    mutationFn: async (payslip: Pick<Payslip, 'id' | 'employeeId' | 'month' | 'year' | 'payPeriod'>) => {
      const res = await fetch(`/api/payslips/${payslip.id}/download`);
      if (!res.ok) throw new Error('Failed to download payslip');
      // Response is a redirect to S3 — open directly in new tab
      window.open(res.url, '_blank');
    },
    onError: () => toast.error('Failed to download payslip'),
  });
}
