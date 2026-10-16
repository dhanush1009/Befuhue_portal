import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { can } from '@/lib/permissions';
import { getISTMidnight } from '@/lib/attendance';
import type { TaskStatus } from '@prisma/client';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const today = getISTMidnight();

  try {
    const isTaskAdmin = can.viewAllTasks(user.role);
    const isApprovalAdmin = can.viewApprovals(user.role);

    const [
      totalEmployees,
      presentToday,
      onLeave,
      openTasks,
      pendingApprovals,
      openBugs,
      criticalBugs,
      readyForQACount,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.attendance.count({
        where: { date: today, sessions: { some: {} } },
      }),
      prisma.leave.count({
        where: { status: 'APPROVED', fromDate: { lte: today }, toDate: { gte: today } },
      }),
      isTaskAdmin
        ? prisma.task.count({ where: { itemType: 'TASK', status: { notIn: ['DONE', 'CLOSED'] }, deletedAt: { isSet: false } } })
        : prisma.task.count({ where: { itemType: 'TASK', OR: [{ assigneeId: user.id }, { participants: { some: { userId: user.id } } }], status: { notIn: ['DONE', 'CLOSED'] }, deletedAt: { isSet: false } } }),
      isApprovalAdmin
        ? prisma.leave.count({ where: { status: 'PENDING' } })
        : Promise.resolve(null),
      isTaskAdmin
        ? prisma.task.count({ where: { itemType: 'BUG', status: { notIn: ['DONE', 'CLOSED'] }, deletedAt: { isSet: false } } })
        : Promise.resolve(null),
      isTaskAdmin
        ? prisma.task.count({ where: { itemType: 'BUG', severity: 'CRITICAL', status: { notIn: ['DONE', 'CLOSED'] }, deletedAt: { isSet: false } } })
        : Promise.resolve(null),
      prisma.task.count({ where: { status: { in: ['INTERNAL_REVIEW', 'CLIENT_REVIEW'] }, deletedAt: { isSet: false } } }),
    ]);

    return NextResponse.json({
      data: { totalEmployees, presentToday, onLeave, openTasks, pendingApprovals, openBugs, criticalBugs, readyForQACount },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
