import type { NotificationType } from '@prisma/client';

// What goes to Slack, and how it looks. No database or network in here, so it is easy to test.

/** Types sent as a private message to the person they are for. */
const DM_TYPES = new Set<NotificationType>([
  'LEAVE_APPLIED', 'LEAVE_APPROVED', 'LEAVE_REJECTED',
  'TASK_ASSIGNED', 'TASK_MENTIONED', 'TASK_DUE_REMINDER', 'TASK_DONE',
  'TASK_OFFERED', 'TASK_OFFER_TAKEN', 'TASK_OFFER_REMINDER', 'TASK_PART_DONE',
  'REGULARIZATION_REQUEST', 'REGULARIZATION_APPROVED', 'REGULARIZATION_REJECTED', 'REGULARIZATION_APPEAL',
  'ATTENDANCE_NOTICE',
  'BUG_ASSIGNED', 'BUG_VERIFIED', 'BUG_SEVERITY_CHANGED', 'READY_FOR_QA', 'TESTING_STARTED', 'BUG_REOPENED_BY_QA',
  'SYSTEM',
  'JOINING_DATE_REQUEST', 'JOINING_DATE_DECIDED', 'CREDENTIAL_REQUEST', 'CREDENTIAL_DECIDED',
]);

/** Sent to everyone in-app, but posted to the company channel ONCE instead of as a DM to each person. */
const BROADCAST_TYPES = new Set<NotificationType>(['ANNOUNCEMENT', 'POLL_CREATED', 'WIKI_UPDATED', 'HOLIDAYS_UPDATED']);

export const isDmType = (t: NotificationType) => DM_TYPES.has(t);
export const isBroadcastType = (t: NotificationType) => BROADCAST_TYPES.has(t);

const ICONS: Partial<Record<NotificationType, string>> = {
  LEAVE_APPLIED: ':palm_tree:', LEAVE_APPROVED: ':white_check_mark:', LEAVE_REJECTED: ':x:',
  TASK_ASSIGNED: ':clipboard:', TASK_MENTIONED: ':speech_balloon:', TASK_DUE_REMINDER: ':alarm_clock:', TASK_DONE: ':white_check_mark:',
  TASK_OFFERED: ':raising_hand:', TASK_OFFER_TAKEN: ':handshake:', TASK_OFFER_REMINDER: ':hourglass_flowing_sand:', TASK_PART_DONE: ':jigsaw:',
  REGULARIZATION_REQUEST: ':clock3:', REGULARIZATION_APPROVED: ':white_check_mark:', REGULARIZATION_REJECTED: ':x:', REGULARIZATION_APPEAL: ':mega:',
  ATTENDANCE_NOTICE: ':calendar:', BUG_ASSIGNED: ':beetle:', BUG_VERIFIED: ':white_check_mark:', BUG_SEVERITY_CHANGED: ':warning:',
  JOINING_DATE_REQUEST: ':calendar:', JOINING_DATE_DECIDED: ':calendar:', CREDENTIAL_REQUEST: ':key:', CREDENTIAL_DECIDED: ':key:',
  READY_FOR_QA: ':mag:', TESTING_STARTED: ':test_tube:', BUG_REOPENED_BY_QA: ':repeat:', SYSTEM: ':bell:',
  ANNOUNCEMENT: ':loudspeaker:', POLL_CREATED: ':bar_chart:', WIKI_UPDATED: ':books:', HOLIDAYS_UPDATED: ':palm_tree:',
};

/** Slack uses &, < and > for its own formatting, so they have to be escaped in anything a person typed. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export interface SlackMessage { text: string; blocks: unknown[] }

export function absoluteUrl(path: string | null | undefined, base: string | undefined = process.env.NEXTAUTH_URL): string | null {
  if (!path || !base) return null;
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/** One notification as a Slack message: bold title, the details, and a button back to the portal. */
export function notificationMessage(type: NotificationType, title: string, body: string, linkUrl?: string | null, base?: string): SlackMessage {
  const icon = ICONS[type] ?? ':bell:';
  const text = `${icon} ${clip(title, 140)}`;
  const url = absoluteUrl(linkUrl, base);
  const blocks: unknown[] = [
    { type: 'section', text: { type: 'mrkdwn', text: `${icon} *${esc(clip(title, 140))}*${body ? `\n${esc(clip(body, 500))}` : ''}` } },
  ];
  if (url) blocks.push({ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open in portal' }, url }] });
  return { text, blocks };
}

export interface Celebrant { name: string; years?: number }

/** The morning post for the company channel; null when nobody is celebrating. */
export function celebrationsMessage(birthdays: Celebrant[], anniversaries: Celebrant[]): SlackMessage | null {
  if (birthdays.length === 0 && anniversaries.length === 0) return null;
  const lines: string[] = [];
  if (birthdays.length) lines.push(`:birthday: *Happy birthday* to ${joinNames(birthdays.map((b) => b.name))}!`);
  for (const a of anniversaries) lines.push(`:tada: *${esc(a.name)}* completes ${a.years} year${a.years === 1 ? '' : 's'} at Deep Impression today.`);
  const text = lines.join('\n');
  return { text: text.replace(/[*:]/g, ''), blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }] };
}

function joinNames(names: string[]): string {
  const e = names.map((n) => `*${esc(n)}*`);
  return e.length <= 1 ? e.join('') : `${e.slice(0, -1).join(', ')} and ${e[e.length - 1]}`;
}

/** A broadcast (announcement, poll, new wiki article, holiday change) for the company channel. */
export function broadcastMessage(type: NotificationType, title: string, body: string, linkUrl?: string, base?: string): SlackMessage {
  return notificationMessage(type, title, body, linkUrl, base);
}
