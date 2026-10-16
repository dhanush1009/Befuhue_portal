import { NextRequest, NextResponse } from 'next/server';
import { postDailyCelebrations } from '@/lib/slack/mirror';

/**
 * GET /api/cron/slack-daily
 *
 * Posts today's birthdays and work anniversaries to the company Slack channel. It also runs every
 * morning from the offer-reminders cron (so no extra scheduled job is needed); calling it again
 * the same day does nothing. Same auth as the other cron routes.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const given  = bearer ?? req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
    if (given !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await postDailyCelebrations());
}
