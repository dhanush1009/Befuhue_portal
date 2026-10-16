import { z } from 'zod';

export const clockInSchema = z.object({
  type: z.enum(['OFFICE', 'HALF_DAY']).default('OFFICE'),
});

export const attendanceFilterSchema = z.object({
  year:  z.number().int().min(2020).max(2100),
  month: z.number().int().min(0).max(11),
});

export type ClockInInput = z.infer<typeof clockInSchema>;
export type AttendanceFilterInput = z.infer<typeof attendanceFilterSchema>;
