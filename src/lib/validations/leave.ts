import { z } from 'zod';

export const leaveRequestSchema = z.object({
  leaveType: z.enum(['EARNED', 'SICK', 'CASUAL', 'LOP', 'COMP_OFF', 'MATERNITY', 'PATERNITY']),
  fromDate:  z.string().min(1, 'Start date is required'),
  toDate:    z.string().min(1, 'End date is required'),
  reason:    z.string().min(10, 'Reason must be at least 10 characters'),
  documentUrl: z.string().url().optional(),
}).refine(
  (d) => new Date(d.fromDate) <= new Date(d.toDate),
  { message: 'End date must be on or after start date', path: ['toDate'] },
);

export const leaveActionSchema = z.object({
  status:  z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().optional(),
});

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;
export type LeaveActionInput  = z.infer<typeof leaveActionSchema>;
