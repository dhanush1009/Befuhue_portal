import { z } from 'zod';

// The promotions / career timeline. Admin only: neither the screens nor the API show it to anyone else.

export const CAREER_TYPES = ['PROMOTION', 'ROLE_CHANGE', 'TRANSFER', 'CONFIRMATION', 'OTHER'] as const;
export type CareerType = (typeof CAREER_TYPES)[number];

export const CAREER_LABELS: Record<CareerType, string> = {
  PROMOTION: 'Promotion', ROLE_CHANGE: 'Role change', TRANSFER: 'Transfer', CONFIRMATION: 'Confirmation', OTHER: 'Other',
};

const text = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v === undefined ? undefined : v || null));

const day = z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), 'Pick a valid date');

export const createCareerEventSchema = z.object({
  type:            z.enum(CAREER_TYPES),
  effectiveDate:   day,
  title:           z.string().trim().min(1, 'Add a short title').max(120),
  fromDesignation: text(100),
  toDesignation:   text(100),
  note:            text(500),
  /** Also change the person's current designation to "toDesignation". */
  updateDesignation: z.boolean().optional(),
}).superRefine((v, ctx) => {
  if (v.updateDesignation && !v.toDesignation) {
    ctx.addIssue({ code: 'custom', path: ['toDesignation'], message: 'Enter the new designation to update it' });
  }
});

export const updateCareerEventSchema = z.object({
  type:            z.enum(CAREER_TYPES).optional(),
  effectiveDate:   day.optional(),
  title:           z.string().trim().min(1).max(120).optional(),
  fromDesignation: text(100),
  toDesignation:   text(100),
  note:            text(500),
});

export const toDay = (s: string): Date => new Date(`${s}T12:00:00.000Z`);

export interface TimelineEntry {
  id:              string | null;     // null for the joining entry, which is not stored here
  kind:            'JOINED' | CareerType;
  date:            string;            // YYYY-MM-DD
  title:           string;
  fromDesignation: string | null;
  toDesignation:   string | null;
  note:            string | null;
}

interface StoredEvent {
  id: string; type: string; effectiveDate: Date; title: string;
  fromDesignation: string | null; toDesignation: string | null; note: string | null;
}

/** Newest first, with the day they joined as the last (oldest) entry. */
export function buildTimeline(events: StoredEvent[], joiningDate: Date | null, joinedAs: string | null): TimelineEntry[] {
  const list: TimelineEntry[] = events.map((e) => ({
    id: e.id, kind: e.type as CareerType, date: e.effectiveDate.toISOString().slice(0, 10), title: e.title,
    fromDesignation: e.fromDesignation, toDesignation: e.toDesignation, note: e.note,
  }));
  list.sort((a, b) => b.date.localeCompare(a.date));
  if (joiningDate) {
    list.push({ id: null, kind: 'JOINED', date: joiningDate.toISOString().slice(0, 10), title: 'Joined Deep Impression', fromDesignation: null, toDesignation: joinedAs, note: null });
  }
  return list;
}

/** "1 year 3 months" style length of service, from the joining day to `now`. */
export function tenure(joiningDate: Date | null, now: Date): string | null {
  if (!joiningDate) return null;
  let months = (now.getUTCFullYear() - joiningDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - joiningDate.getUTCMonth());
  if (now.getUTCDate() < joiningDate.getUTCDate()) months -= 1;
  if (months < 0) return null;
  const y = Math.floor(months / 12), m = months % 12;
  const parts = [y && `${y} year${y === 1 ? '' : 's'}`, m && `${m} month${m === 1 ? '' : 's'}`].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Less than a month';
}
