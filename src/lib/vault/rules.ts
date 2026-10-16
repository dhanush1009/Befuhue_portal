import { z } from 'zod';

// The rules of the password vault, with no database or network so they are easy to test.

/** How long an approved one-time view stays open before it lapses unused. */
export const WINDOW_HOURS = [1, 4, 24] as const;
export const DEFAULT_WINDOW_HOURS = 4;

// ── Validation ────────────────────────────────────────────────────────────────

const text = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v === undefined ? undefined : v || null));

/** "https://www.Hostinger.com/panel" -> "hostinger.com" so every entry for a site looks the same. */
export function normalizeDomain(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw) return null;
  const host = raw.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '').replace(/:\d+$/, '');
  return host || null;
}

const domain = z.string().trim().max(200).nullable().optional()
  .transform((v) => (v === undefined ? undefined : normalizeDomain(v)))
  .refine((v) => v === undefined || v === null || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v), 'Enter a valid domain like hostinger.com');

const loginUrl = z.string().trim().max(300).nullable().optional()
  .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), 'The login link must start with https://')
  .transform((v) => (v === undefined ? undefined : v || null));

export const createCredentialSchema = z.object({
  clientId: z.string().min(1, 'Choose a brand'),
  service:  z.string().trim().min(1, 'Enter the service name').max(80),
  domain, label: text(80), loginUrl,
  username: z.string().min(1, 'Enter the username or email').max(300),
  password: z.string().min(1, 'Enter the password').max(500),
  notes:    z.string().max(2000).nullable().optional(),
});

/** On edit, username/password/notes are only changed when sent (so the form can leave them untouched). */
export const updateCredentialSchema = z.object({
  clientId: z.string().min(1).optional(),
  service:  z.string().trim().min(1).max(80).optional(),
  domain, label: text(80), loginUrl,
  username: z.string().min(1).max(300).optional(),
  password: z.string().min(1).max(500).optional(),
  notes:    z.string().max(2000).nullable().optional(),
});

export const requestAccessSchema = z.object({
  reason: z.string().trim().min(5, 'Say briefly why you need it (at least 5 characters)').max(300),
  taskId: z.string().min(1).nullable().optional(),
});

export const decideSchema = z.object({
  decision: z.enum(['APPROVE', 'DENY']),
  note:     z.string().trim().max(300).nullable().optional(),
  hours:    z.number().refine((h) => (WINDOW_HOURS as readonly number[]).includes(h), 'Choose 1, 4 or 24 hours').optional(),
});

// ── State of an access request ────────────────────────────────────────────────

export type AccessState = 'PENDING' | 'READY' | 'EXPIRED' | 'USED' | 'DENIED' | 'CANCELLED';

export interface AccessLike {
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'USED' | 'CANCELLED';
  expiresAt: Date | null;
}

/** What a request means right now. "Approved" only counts as READY while its window is still open. */
export function accessState(a: AccessLike, now = new Date()): AccessState {
  if (a.status === 'APPROVED') return a.expiresAt && a.expiresAt.getTime() > now.getTime() ? 'READY' : 'EXPIRED';
  return a.status;
}

export const windowEnd = (now: Date, hours: number) => new Date(now.getTime() + hours * 3_600_000);

/** An admin may not approve their own request: another admin has to. */
export function canDecide(deciderId: string, requesterId: string): boolean {
  return deciderId !== requesterId;
}

/** Admins can change any entry; anyone else can only change the ones they added themselves. */
export function canManageCredential(userId: string, isAdmin: boolean, createdById: string): boolean {
  return isAdmin || userId === createdById;
}

/** Who may attach vault entries to a task: admins, whoever created it, and whoever it is assigned to. */
export function canAttachToTask(task: { reporterId: string; assigneeId: string | null }, userId: string, isAdmin: boolean): boolean {
  return isAdmin || task.reporterId === userId || task.assigneeId === userId;
}
