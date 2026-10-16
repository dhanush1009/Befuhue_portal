import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { SlackError, slackCall, slackChannel, slackConfigured } from '@/lib/slack/api';

// Admin only: is Slack connected, to which workspace and channel, how many people are linked, and
// which channels the bot can see (so the right SLACK_CHANNEL_ID is easy to pick).
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [total, linked] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, slackUserId: { not: null } } }),
  ]);
  const base = { configured: slackConfigured(), channelSet: !!slackChannel(), people: { total, linked } };
  const none = { connected: false, workspace: null, botName: null, channelName: null, channelProblem: null, channels: [] as { id: string; name: string; isMember: boolean }[], problem: null as string | null };
  if (!base.configured) return NextResponse.json({ data: { ...base, ...none } });

  try {
    const auth = await slackCall<{ team?: string; user?: string }>('auth.test');

    let channelName: string | null = null;
    let channelProblem: string | null = null;
    const channel = slackChannel();
    if (channel) {
      try {
        const c = await slackCall<{ channel?: { name?: string; is_member?: boolean } }>('conversations.info', { channel });
        channelName = c.channel?.name ?? null;
        if (c.channel && c.channel.is_member === false) channelProblem = 'The app is not in this channel yet. In Slack, open it and type /invite @Deep Impression Portal.';
      } catch (e) {
        channelProblem = e instanceof SlackError ? e.message : 'Could not check the channel.';
      }
    }

    // Public channels the bot can see, for picking the right ID
    let channels: { id: string; name: string; isMember: boolean }[] = [];
    try {
      const l = await slackCall<{ channels?: { id: string; name: string; is_member?: boolean }[] }>('conversations.list', { types: 'public_channel', exclude_archived: true, limit: 100 });
      channels = (l.channels ?? []).map((c) => ({ id: c.id, name: c.name, isMember: !!c.is_member })).sort((a, b) => Number(b.isMember) - Number(a.isMember) || a.name.localeCompare(b.name));
    } catch { /* needs channels:read; the list is only a convenience */ }

    return NextResponse.json({ data: { ...base, connected: true, workspace: auth.team ?? null, botName: auth.user ?? null, channelName, channelProblem, channels, problem: null } });
  } catch (e) {
    return NextResponse.json({ data: { ...base, ...none, problem: e instanceof SlackError ? e.message : 'Could not reach Slack' } });
  }
}
