import { z } from 'zod';
import { toDayKey } from '@/lib/holidays';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const holidayInputSchema = z.object({
  date: z.string()
    .regex(DAY_KEY, 'Date must be yyyy-MM-dd')
    .refine((d) => toDayKey(+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10)) === d, 'Not a real calendar date'),
  name: z.string().trim().min(2, 'Add a name').max(80),
  note: z.string().trim().max(200).optional().nullable(),
});

export type HolidayInput = z.infer<typeof holidayInputSchema>;
