import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

/**
 * GET /api/cron/due-reminders
 *
 * Sends TASK_DUE_REMINDER notifications for every non-closed task
 * whose due date is tomorrow and has an assignee.
 *
 * Call this once daily (e.g. 08:00 AM) via:
 *   - A cron job: curl https://yourapp.com/api/cron/due-reminders -H "x-cron-secret: <CRON_SECRET>"
 *   - Vercel Cron (vercel.json): { "crons": [{ "path": "/api/cron/due-reminders", "schedule": "0 8 * * *" }] }
 *   - Docker: add a cron container that hits this endpoint daily
 *
 * Protected by CRON_SECRET env variable to prevent public access.
 */
export async function GET(req: NextRequest) {
  // Verify secret to prevent unauthorised triggers
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Build tomorrow's date range (UTC midnight → midnight)
  const now       = new Date();
  const tomorrow  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dayAfter  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));

  try {
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt:  { isSet: false },
        status:     { notIn: ['CLOSED'] },
        assigneeId: { not: null },
        dueDate:    { gte: tomorrow, lt: dayAfter },
      },
      select: {
        id:         true,
        humanId:    true,
        title:      true,
        assigneeId: true,
        project:    { select: { name: true } },
      },
    });

    if (tasks.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No tasks due tomorrow.' });
    }

    await Promise.all(
      tasks.map((task) =>
        createNotification(
          task.assigneeId!,
          'TASK_DUE_REMINDER',
          `Task due tomorrow: ${task.humanId}`,
          `"${task.title}"${task.project ? ` in ${task.project.name}` : ''} is due tomorrow.`,
          `/tasks?task=${task.id}`,
        ),
      ),
    );

    return NextResponse.json({ sent: tasks.length, message: `Sent ${tasks.length} due-tomorrow reminder(s).` });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
