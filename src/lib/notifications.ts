import { prisma } from '@/lib/prisma';
import type { NotificationType } from '@prisma/client';
import { mirrorNotificationSoon } from '@/lib/slack/mirror';

export async function createNotification(
  userId:   string,
  type:     NotificationType,
  title:    string,
  body:     string,
  linkUrl?: string,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body, linkUrl: linkUrl ?? null },
    });
    // Slack gets a copy when it is connected (a no-op otherwise); it can never fail the request.
    await mirrorNotificationSoon(userId, type, title, body, linkUrl);
  } catch {
    // Notifications are non-critical — never let a failure here break the main flow
    console.error('[notifications] Failed to create notification for user', userId);
  }
}
