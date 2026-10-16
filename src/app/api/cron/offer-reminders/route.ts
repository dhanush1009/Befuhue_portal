import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { postDailyCelebrations } from '@/lib/slack/mirror';

/**
 * GET /api/cron/offer-reminders
 *
 * "Anyone" tasks that nobody has accepted yet and that are due within the next 24 hours
 * (or today) get a reminder: every person it was offered to, plus whoever set it up.
 * Each task is reminded once. Scheduled daily in vercel.json.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; manual callers can use the
 * `x-cron-secret` header or `?secret=` like the other cron route.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const given  = bearer ?? req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
    if (given !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now        = new Date();
  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const horizon    = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt:       { isSet: false },
        assignMode:      'OFFER',
        status:          { notIn: ['CLOSED', 'DONE'] },
        offerRemindedAt: { isSet: false },
        dueDate:         { gte: startToday, lte: horizon },
      },
      select: {
        id: true, humanId: true, title: true, reporterId: true, dueDate: true,
        participants: { where: { kind: 'OFFEREE' }, select: { userId: true } },
      },
    });

    for (const t of tasks) {
      const audience = new Set<string>([t.reporterId, ...t.participants.map((p) => p.userId)]);
      await Promise.all([...audience].map((uid) =>
        createNotification(
          uid,
          'TASK_OFFER_REMINDER',
          `Nobody has taken ${t.humanId} yet`,
          `"${t.title}" is due within 24 hours and is still waiting for someone to accept it.`,
          `/tasks?task=${t.id}`,
        ),
      ));
      await prisma.task.update({ where: { id: t.id }, data: { offerRemindedAt: new Date() } });
    }

    // The same morning run also posts today's birthdays and anniversaries to Slack (does nothing if Slack is not connected).
    const celebrations = await postDailyCelebrations().catch(() => ({ posted: false }));

    return NextResponse.json({ reminded: tasks.length, celebrations });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
