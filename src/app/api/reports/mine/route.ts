import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    let count = 0;
    if (user.role === 'ADMIN') {
      count = await prisma.projectReport.count();
    } else {
      // Find projects where the user has assigned tasks
      const userProjects = await prisma.task.findMany({
        where: { assigneeId: user.id },
        select: { projectId: true },
        distinct: ['projectId'],
      });
      const projectIds = userProjects
        .map((p) => p.projectId)
        .filter((id): id is string => id !== null);

      if (projectIds.length > 0) {
        count = await prisma.projectReport.count({
          where: { projectId: { in: projectIds } },
        });
      }
    }

    return NextResponse.json({ data: { count } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch report count';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
