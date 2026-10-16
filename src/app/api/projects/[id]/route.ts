import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { computeEngagementHealth } from '@/lib/engagementHealth';
import { generateProjectExcelBuffer } from '@/lib/projectExcel';
import { z } from 'zod';

const updateProjectSchema = z.object({
  name:               z.string().min(1).max(150).optional(),
  description:        z.string().nullable().optional(),
  clientId:           z.string().optional(),
  type:               z.enum(['FULL_REVAMP', 'LP_BUILD', 'RETAINER', 'CUSTOM']).optional(),
  startDate:          z.string().nullable().optional(),
  targetDate:         z.string().nullable().optional(),
  deadline:           z.string().nullable().optional(),
  status:             z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  assignedEmployeeId: z.string().nullable().optional(),
  amount:             z.number().nullable().optional(),
  currency:           z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const isAdmin = user.role === 'ADMIN';

  try {
    const project = await prisma.project.findUnique({
      where:   { id: params.id },
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        assignedEmployee: { select: { id: true, name: true, email: true, avatarUrl: true, designation: true } },
      },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // BACKEND DATA SECURITY ENFORCEMENT:
    // Unauthorized employees cannot view projects not assigned to them
    if (!isAdmin && project.assignedEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden — you are not assigned to this project' }, { status: 403 });
    }

    const tasks = await prisma.task.findMany({
      where:  { projectId: params.id, deletedAt: { isSet: false } },
      select: {
        id: true, humanId: true, title: true, status: true, dueDate: true, isGate: true,
        dependsOn: true, team: true, phase: true, priority: true, itemType: true,
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const health = computeEngagementHealth(tasks);

    // Strip project amount for non-admin users
    if (!isAdmin) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { amount, ...safeProject } = project;
      return NextResponse.json({ data: { ...safeProject, tasks, ...health } });
    }

    return NextResponse.json({ data: { ...project, tasks, ...health } });
  } catch (err) {
    console.error('Failed to get project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const isAdmin = user.role === 'ADMIN';

  const existing = await prisma.project.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Non-admins can only update their own assigned projects
  if (!isAdmin && existing.assignedEmployeeId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body   = await req.json() as unknown;
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updateData: any = {};

    if (isAdmin) {
      // Admin can update all project details
      const { startDate, targetDate, deadline, assignedEmployeeId, amount, ...rest } = parsed.data;
      updateData = {
        ...rest,
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(targetDate !== undefined ? { targetDate: targetDate ? new Date(targetDate) : null } : {}),
        ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
        ...(assignedEmployeeId !== undefined ? { assignedEmployeeId: assignedEmployeeId || null } : {}),
        ...(amount !== undefined ? { amount: typeof amount === 'number' ? amount : null } : {}),
      };
    } else {
      // DATA SECURITY: Employee can ONLY update project progress/status, NEVER the amount or assignment
      if (parsed.data.status) {
        updateData.status = parsed.data.status;
      }
    }

    const data = await prisma.project.update({
      where: { id: params.id },
      data:  updateData,
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        assignedEmployee: { select: { id: true, name: true, email: true, avatarUrl: true, designation: true } },
      },
    });

    // Auto-sync into Excel master file in background
    generateProjectExcelBuffer().catch((e) => console.error('Auto excel sync failed:', e));

    if (!isAdmin) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { amount, ...safeData } = data;
      return NextResponse.json({ data: safeData });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Failed to update project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  // DATA SECURITY: Only Admin can delete projects
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin authorization required' }, { status: 403 });
  }

  try {
    const project = await prisma.project.findUnique({
      where:   { id: params.id },
      include: { _count: { select: { tasks: true } } },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    if (project._count.tasks > 0) {
      return NextResponse.json(
        { error: `Cannot delete — this project has ${project._count.tasks} task(s). Reassign or remove them first.` },
        { status: 409 },
      );
    }

    await prisma.project.delete({ where: { id: params.id } });

    // Auto-sync into Excel master file in background
    generateProjectExcelBuffer().catch((e) => console.error('Auto excel sync failed:', e));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
