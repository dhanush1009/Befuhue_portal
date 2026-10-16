import type { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { nextOccurrence } from '@/lib/details/celebrations';
import { SlackError, slackCall, slackChannel, slackConfigured } from './api';
import { broadcastMessage, celebrationsMessage, isBroadcastType, isDmType, notificationMessage, type SlackMessage } from './messages';

// Everything that talks to Slack on the portal's behalf. Nothing here may ever break the action that
// triggered it, so every entry point swallows errors (they are logged without any token or message text).

const DAY_MS = 24 * 60 * 60 * 1000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
}

interface Linkable { id: string; email: string; slackUserId: string | null; slackLookupAt: Date | null }

/** Finds a person's Slack id by their work email, remembering the answer (and a "not found" for a day). */
export async function resolveSlackUserId(u: Linkable, force = false, throwErrors = false): Promise<string | null> {
  if (u.slackUserId) return u.slackUserId;
  if (!force && u.slackLookupAt && Date.now() - u.slackLookupAt.getTime() < DAY_MS) return null;
  try {
    const r = await slackCall<{ user?: { id: string } }>('users.lookupByEmail', { email: u.email });
    const id = r.user?.id ?? null;
    await prisma.user.update({ where: { id: u.id }, data: { slackUserId: id, slackLookupAt: new Date() } });
    return id;
  } catch (e) {
    if (e instanceof SlackError && e.code === 'users_not_found') {
      await prisma.user.update({ where: { id: u.id }, data: { slackLookupAt: new Date() } }).catch(() => {});
    } else {
      console.error('[slack] lookup failed', (e as Error).message);
    }
    if (throwErrors) throw e;
    return null;
  }
}

/** Sends the Slack copy of an in-app notification. Called from createNotification. */
export async function mirrorNotification(userId: string, type: NotificationType, title: string, body: string, linkUrl?: string | null): Promise<void> {
  if (!slackConfigured() || !isDmType(type)) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, isActive: true, slackUserId: true, slackLookupAt: true, slackMuted: true } });
    if (!user || !user.isActive || user.slackMuted) return;
    const slackId = await resolveSlackUserId(user);
    if (!slackId) return;
    const m = notificationMessage(type, title, body, linkUrl);
    await slackCall('chat.postMessage', { channel: slackId, text: m.text, blocks: m.blocks });
  } catch (e) {
    console.error('[slack] could not deliver a notification', (e as Error).message);
  }
}

/** Mirror with a time limit, so a slow Slack never makes the portal slow. */
export const mirrorNotificationSoon = (...args: Parameters<typeof mirrorNotification>) => withTimeout(mirrorNotification(...args), 3500);

export async function postToChannel(m: SlackMessage): Promise<boolean> {
  const channel = slackChannel();
  if (!slackConfigured() || !channel) return false;
  try {
    await slackCall('chat.postMessage', { channel, text: m.text, blocks: m.blocks });
    return true;
  } catch (e) {
    console.error('[slack] could not post to the channel', (e as Error).message);
    return false;
  }
}

/** One company-wide post (announcement, poll, new wiki article, holiday change). */
export async function postBroadcast(type: NotificationType, title: string, body: string, linkUrl?: string): Promise<void> {
  if (!isBroadcastType(type)) return;
  await withTimeout(postToChannel(broadcastMessage(type, title, body, linkUrl)), 3500);
}

export interface MatchResult { matched: { id: string; name: string }[]; unmatched: { id: string; name: string }[] }

/** Tries to link every active person to their Slack account (by work email). */
export async function matchAllUsers(): Promise<MatchResult> {
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true, slackUserId: true, slackLookupAt: true } });
  const out: MatchResult = { matched: [], unmatched: [] };
  for (const u of users) {
    const id = await resolveSlackUserId(u, true);
    (id ? out.matched : out.unmatched).push({ id: u.id, name: u.name });
  }
  return out;
}

const istDay = (now: Date) => new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/** The morning celebrations post. Safe to call more than once a day: it only posts the first time. */
export async function postDailyCelebrations(now = new Date()): Promise<{ posted: boolean; reason?: string; birthdays?: number; anniversaries?: number }> {
  if (!slackConfigured() || !slackChannel()) return { posted: false, reason: 'not configured' };

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { name: true, joiningDate: true, details: { select: { dateOfBirth: true, hideBirthday: true, preferredName: true } } },
  });
  const birthdays: { name: string }[] = [], anniversaries: { name: string; years: number }[] = [];
  for (const u of users) {
    const dob = u.details?.dateOfBirth;
    if (dob && !u.details?.hideBirthday && nextOccurrence(dob, now).daysAway === 0) birthdays.push({ name: u.details?.preferredName?.trim() || u.name });
    if (u.joiningDate) {
      const n = nextOccurrence(u.joiningDate, now);
      const years = Number(n.date.slice(0, 4)) - u.joiningDate.getUTCFullYear();
      if (n.daysAway === 0 && years >= 1) anniversaries.push({ name: u.name, years });
    }
  }
  const m = celebrationsMessage(birthdays, anniversaries);
  if (!m) return { posted: false, reason: 'nobody celebrating', birthdays: 0, anniversaries: 0 };

  const key = `celebrations:${istDay(now)}`;
  try { await prisma.slackPostLog.create({ data: { key } }); } catch { return { posted: false, reason: 'already posted today' }; }
  const ok = await postToChannel(m);
  if (!ok) { await prisma.slackPostLog.delete({ where: { key } }).catch(() => {}); return { posted: false, reason: 'Slack refused the post' }; }
  return { posted: true, birthdays: birthdays.length, anniversaries: anniversaries.length };
}
