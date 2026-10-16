import { describe, expect, it, vi } from 'vitest';
import { SlackError, friendlySlackError, slackCall } from './api';
import { absoluteUrl, celebrationsMessage, esc, isBroadcastType, isDmType, notificationMessage } from './messages';

const reply = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });

describe('slackCall', () => {
  it('sends the token as a header, never in the body or URL', async () => {
    const f = vi.fn().mockResolvedValue(reply({ ok: true, user: { id: 'U1' } }));
    await slackCall('users.lookupByEmail', { email: 'a@b.in' }, { token: 'xoxb-secret', fetchImpl: f as never });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('https://slack.com/api/users.lookupByEmail');
    expect(String(url)).not.toContain('xoxb');
    expect(init.headers.Authorization).toBe('Bearer xoxb-secret');
    expect(init.body).not.toContain('xoxb');
  });
  it('form-encodes lookups (Slack rejects JSON for them) but sends messages as JSON', async () => {
    const f = vi.fn().mockImplementation(async () => reply({ ok: true })); // a fresh Response each call: bodies can only be read once
    await slackCall('users.lookupByEmail', { email: 'a+b@x.in' }, { token: 't', fetchImpl: f as never });
    expect(f.mock.calls[0][1].headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(f.mock.calls[0][1].body).toBe('email=a%2Bb%40x.in');
    await slackCall('conversations.list', { types: 'public_channel', limit: 100, exclude_archived: true }, { token: 't', fetchImpl: f as never });
    expect(f.mock.calls[1][1].body).toBe('types=public_channel&limit=100&exclude_archived=true');
    await slackCall('chat.postMessage', { channel: 'C1', blocks: [{ type: 'section' }] }, { token: 't', fetchImpl: f as never });
    expect(f.mock.calls[2][1].headers['Content-Type']).toContain('application/json');
    expect(JSON.parse(f.mock.calls[2][1].body).blocks).toHaveLength(1);
  });
  it('explains common setup mistakes in plain English', async () => {
    const f = vi.fn().mockResolvedValue(reply({ ok: false, error: 'not_in_channel' }));
    await expect(slackCall('chat.postMessage', {}, { token: 't', fetchImpl: f as never })).rejects.toThrow(/\/invite/);
    expect(friendlySlackError('invalid_auth')).toMatch(/SLACK_BOT_TOKEN/);
    expect(friendlySlackError('missing_scope')).toMatch(/users:read.email/);
  });
  it('retries once when Slack asks us to slow down', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(reply({ ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await slackCall('chat.postMessage', {}, { token: 't', fetchImpl: f as never, sleep });
    expect(f).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });
  it('reports an unreachable Slack and a missing token clearly', async () => {
    const down = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(slackCall('auth.test', {}, { token: 't', fetchImpl: down as never })).rejects.toMatchObject({ code: 'unreachable' });
    const saved = process.env.SLACK_BOT_TOKEN; delete process.env.SLACK_BOT_TOKEN;
    await expect(slackCall('auth.test')).rejects.toBeInstanceOf(SlackError);
    if (saved) process.env.SLACK_BOT_TOKEN = saved;
  });
});

describe('what goes where', () => {
  it('DMs the personal types and keeps broadcasts for the channel', () => {
    expect(isDmType('TASK_ASSIGNED')).toBe(true);
    expect(isDmType('LEAVE_APPROVED')).toBe(true);
    expect(isDmType('ANNOUNCEMENT')).toBe(false);
    expect(isBroadcastType('ANNOUNCEMENT')).toBe(true);
    expect(isBroadcastType('HOLIDAYS_UPDATED')).toBe(true);
    expect(isBroadcastType('TASK_ASSIGNED')).toBe(false);
  });
});

describe('messages', () => {
  it('escapes Slack control characters in anything a person typed', () => {
    expect(esc('<!channel> a & b')).toBe('&lt;!channel&gt; a &amp; b');
    const m = notificationMessage('TASK_ASSIGNED', 'Fix <!here> now', 'see <http://x|y>', '/tasks?task=1', 'https://desk.your-domain.example');
    expect(JSON.stringify(m.blocks)).not.toContain('<!here>');
  });
  it('links back to the portal with an absolute URL', () => {
    expect(absoluteUrl('/tasks?task=1', 'https://desk.your-domain.example/')).toBe('https://desk.your-domain.example/tasks?task=1');
    expect(absoluteUrl(null, 'https://x')).toBeNull();
    const m = notificationMessage('TASK_ASSIGNED', 'T', 'B', '/tasks', 'https://desk.your-domain.example');
    expect(JSON.stringify(m.blocks)).toContain('https://desk.your-domain.example/tasks');
    // with no site address configured there is nothing to link to, so no button
    const saved = process.env.NEXTAUTH_URL; delete process.env.NEXTAUTH_URL;
    expect(JSON.stringify(notificationMessage('TASK_ASSIGNED', 'T', 'B', '/tasks', undefined).blocks)).not.toContain('actions');
    if (saved) process.env.NEXTAUTH_URL = saved;
  });
  it('trims very long text', () => {
    expect(notificationMessage('SYSTEM', 'x'.repeat(500), 'y'.repeat(2000)).text.length).toBeLessThan(160);
  });
  it('builds the morning celebrations post, or nothing', () => {
    expect(celebrationsMessage([], [])).toBeNull();
    const m = celebrationsMessage([{ name: 'Asha' }, { name: 'Ravi' }, { name: 'Mei' }], [{ name: 'Kiran', years: 1 }])!;
    const t = JSON.stringify(m.blocks);
    expect(t).toContain('*Asha*, *Ravi* and *Mei*');
    expect(t).toContain('1 year at Deep Impression');
    expect(t).not.toContain('1 years');
  });
});
