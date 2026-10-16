import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { holidayDayKey } from '@/lib/holidays';
import { postBroadcast } from '@/lib/slack/mirror';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 'yyyy-MM-dd' keys of every company holiday in [from, to]. Padded by a couple of
 * days each side so timezone differences between the caller's Dates and the stored
 * noon-UTC values can never drop an edge day; callers look keys up exactly anyway.
 */
export async function getHolidayKeySet(from: Date, to: Date): Promise<Set<string>> {
  const rows = await prisma.holiday.findMany({
    where:  { date: { gte: new Date(from.getTime() - 2 * DAY_MS), lte: new Date(to.getTime() + 2 * DAY_MS) } },
    select: { date: true },
  });
  return new Set(rows.map((r) => holidayDayKey(r.date)));
}

/** day key → name for every holiday in [from, to]. */
export async function getHolidayMap(from: Date, to: Date): Promise<Map<string, { name: string; note: string | null }>> {
  const rows = await prisma.holiday.findMany({
    where:  { date: { gte: new Date(from.getTime() - 2 * DAY_MS), lte: new Date(to.getTime() + 2 * DAY_MS) } },
    select: { date: true, name: true, note: true },
  });
  return new Map(rows.map((r) => [holidayDayKey(r.date), { name: r.name, note: r.note }]));
}

/** One in-app notification per active employee (fire-and-forget; never fails the request). */
export function notifyHolidayChange(actorId: string, title: string, body: string): void {
  prisma.user.findMany({ where: { isActive: true, id: { not: actorId } }, select: { id: true } })
    .then((users) => Promise.all(users.map((u) =>
      createNotification(u.id, 'HOLIDAYS_UPDATED', title, body, '/holidays'),
    )))
    .catch(() => {});
  // One post in the company Slack channel (when connected)
  void postBroadcast('HOLIDAYS_UPDATED', title, body, '/holidays');
}
