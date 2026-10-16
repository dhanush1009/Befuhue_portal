import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { SlackError, slackCall, slackChannel, slackConfigured } from '@/lib/slack/api';
import { resolveSlackUserId } from '@/lib/slack/mirror';
import { notificationMessage } from '@/lib/slack/messages';

// Admin only: sends a test message to the company channel and a private one to the admin who clicked.
// The two are tried separately, so a wrong channel never hides the fact that private messages work.
export async function POST() {
  const { user, error } = await requireAdmin();
  if (error) return error;
  if (!slackConfigured()) return NextResponse.json({ error: 'Slack is not connected yet. Add SLACK_BOT_TOKEN in Vercel first.' }, { status: 400 });

  const m = notificationMessage('SYSTEM', 'Slack is connected', 'This is a test message from the Deep Impression portal. Real notifications will arrive like this.', '/dashboard');
  const say = (e: unknown) => (e instanceof SlackError ? e.message : 'Could not reach Slack');
  const result = { channel: 'skipped (SLACK_CHANNEL_ID is not set)', dm: 'skipped', channelOk: false, dmOk: false };

  const channel = slackChannel();
  if (channel) {
    try { await slackCall('chat.postMessage', { channel, text: m.text, blocks: m.blocks }); result.channel = 'sent'; result.channelOk = true; }
    catch (e) { result.channel = say(e); }
  }

  try {
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, slackUserId: true, slackLookupAt: true } });
    if (!me) throw new SlackError('Your account was not found.', 'no_user');
    // Look up directly (not through the cached helper) so the real reason is shown if it fails.
    let slackId = me.slackUserId;
    if (!slackId) {
      try { slackId = await resolveSlackUserId(me, true, true); }
      catch (e) {
        if (e instanceof SlackError && e.code === 'users_not_found') throw new SlackError(`No Slack member has the email ${me.email}. In Slack, check the email on your profile matches your portal work email.`, e.code);
        throw e;
      }
    }
    if (slackId) { await slackCall('chat.postMessage', { channel: slackId, text: m.text, blocks: m.blocks }); result.dm = 'sent'; result.dmOk = true; }
  } catch (e) { result.dm = say(e); }

  return NextResponse.json({ data: result });
}
