import { z } from 'zod';

// Changing a joining date: the employee asks, a different admin approves. Pure rules, easy to test.

const IST_MS = 5.5 * 60 * 60 * 1000;
export const istDay = (now: Date) => new Date(now.getTime() + IST_MS).toISOString().slice(0, 10);

export const MIN_DATE = '2000-01-01';

export const createJoiningRequestSchema = z.object({
  requestedDate: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), 'Pick a valid date'),
  reason:        z.string().trim().min(5, 'Say briefly why it needs changing (at least 5 characters)').max(300),
});

export const decideJoiningSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note:     z.string().trim().max(300).nullable().optional(),
});

/** Returns a message if the date cannot be accepted, otherwise null. */
export function checkRequestedDate(requested: string, current: Date | null, now = new Date()): string | null {
  if (requested < MIN_DATE) return 'That date is too far in the past.';
  if (requested > istDay(now)) return 'A joining date cannot be in the future.';
  if (current && current.toISOString().slice(0, 10) === requested) return 'That is already your joining date.';
  return null;
}

export const toNoonUtc = (day: string) => new Date(`${day}T12:00:00.000Z`);
