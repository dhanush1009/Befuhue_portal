import { z } from 'zod';

export const salarySchema = z.object({
  basic:            z.number().min(0),
  hra:              z.number().min(0),
  conveyance:       z.number().min(0),
  medicalAllowance: z.number().min(0),
  specialAllowance: z.number().min(0),
  bonus:            z.number().min(0),
  incentive:        z.number().min(0),
  incomeTax:        z.number().min(0),
  providentFund:    z.number().min(0),
  esi:              z.number().min(0),
  professionalTax:  z.number().min(0),
  otherDeductions:  z.number().min(0),
});

export const calculatePayrollSchema = z.object({
  month:      z.number().int().min(1).max(12),
  year:       z.number().int().min(2020),
  employeeId: z.string().optional(), // if omitted = all employees
});

export const publishBulkSchema = z.object({
  month:       z.number().int().min(1).max(12),
  year:        z.number().int().min(2020),
  employeeIds: z.array(z.string()).optional(), // if omitted = all DRAFT for that month/year
});

// kept for backward compat
export const runPayrollSchema      = calculatePayrollSchema;
export const publishPayslipSchema  = z.object({ payslipId: z.string().min(1) });

export type SalaryInput            = z.infer<typeof salarySchema>;
export type CalculatePayrollInput  = z.infer<typeof calculatePayrollSchema>;
export type PublishBulkInput       = z.infer<typeof publishBulkSchema>;
export type RunPayrollInput        = CalculatePayrollInput;
export type PublishPayslipInput    = z.infer<typeof publishPayslipSchema>;
