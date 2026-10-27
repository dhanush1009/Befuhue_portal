import { prisma } from '@/lib/prisma';
import { LUNCH_BREAK_MINUTES } from '@/lib/attendance';

export async function processDueLunchBreaks(userId?: string) {
  const now = new Date();
  const breaks = await prisma.lunchBreak.findMany({
    where: {
      status: 'ACTIVE',
      scheduledEndAt: { lte: now },
      ...(userId ? { userId } : {}),
    },
    select: { id: true, attendanceSessionId: true, scheduledEndAt: true },
  });

  if (breaks.length === 0) return 0;

  const processed = await Promise.all(breaks.map(async (lunchBreak) => {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.lunchBreak.updateMany({
        where: { id: lunchBreak.id, status: 'ACTIVE' },
        data: { status: 'COMPLETED', resumedAt: lunchBreak.scheduledEndAt },
      });
      if (updated.count === 0) return 0;

      await tx.attendanceSession.update({
        where: { id: lunchBreak.attendanceSessionId },
        data: { lunchBreakEndAt: lunchBreak.scheduledEndAt },
      });
      return 1;
    });
  }));

  return processed.reduce<number>((total, count) => total + count, 0);
}

export function getLunchBreakEnd(startAt: Date) {
  return new Date(startAt.getTime() + LUNCH_BREAK_MINUTES * 60 * 1000);
}
