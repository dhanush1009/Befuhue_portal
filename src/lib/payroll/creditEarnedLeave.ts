import { prisma } from '@/lib/prisma';

export async function creditMonthlyEarnedLeave(): Promise<{ credited: number; log: string[] }> {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const activeEmployees = await prisma.user.findMany({
    where:  { isActive: true, deletedAt: { isSet: false } },
    select: { id: true, name: true, email: true },
  });

  const log: string[] = [];

  for (const emp of activeEmployees) {
    await prisma.leaveBalance.upsert({
      where:  { userId_year: { userId: emp.id, year } },
      create: { userId: emp.id, year, earnedLeave: 1, usedEarnedLeave: 0, lopDays: 0 },
      update: { earnedLeave: { increment: 1 } },
    });
    log.push(`Credited 1 EL to ${emp.name} for ${month}/${year}`);
  }

  return { credited: activeEmployees.length, log };
}
