import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    // If regular employee, filter reports for projects they have tasks in
    let projectFilter: Record<string, unknown> = {};
    if (user.role !== 'ADMIN') {
      const userProjects = await prisma.task.findMany({
        where: { assigneeId: user.id },
        select: { projectId: true },
        distinct: ['projectId'],
      });
      const userProjectIds = userProjects.map((p) => p.projectId);
      projectFilter = {
        projectId: { in: userProjectIds },
      };
    }

    const reports = await prisma.projectReport.findMany({
      where: {
        ...projectFilter,
        ...(projectId ? { projectId } : {}),
        ...(year ? { year: Number(year) } : {}),
        ...(month ? { month: Number(month) } : {}),
      },
      include: {
        project: { select: { id: true, name: true, prefix: true } },
        generatedBy: { select: { id: true, name: true, avatarUrl: true } },
      },

      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return NextResponse.json({ data: reports });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch reports';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
