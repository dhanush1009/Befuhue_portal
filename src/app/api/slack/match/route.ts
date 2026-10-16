import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { slackConfigured } from '@/lib/slack/api';
import { matchAllUsers } from '@/lib/slack/mirror';

// Admin only: links every active person to their Slack account by work email and reports who could not be found.
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;
  if (!slackConfigured()) return NextResponse.json({ error: 'Slack is not connected yet.' }, { status: 400 });
  return NextResponse.json({ data: await matchAllUsers() });
}
