import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { computeEngagementHealth } from '@/lib/engagementHealth';
import { generateProjectExcelBuffer } from '@/lib/projectExcel';
import { z } from 'zod';

const createProjectSchema = z.object({
  clientId:           z.string().min(1, 'Client is required'),
  name:               z.string().min(1, 'Project name is required').max(150),
  description:        z.string().optional().nullable(),
  prefix:             z.string().max(10).optional().nullable(),
  type:               z.enum(['FULL_REVAMP', 'LP_BUILD', 'RETAINER', 'CUSTOM']).default('CUSTOM'),
  startDate:          z.string().optional().nullable(),
  targetDate:         z.string().optional().nullable(),
  deadline:           z.string().optional().nullable(),
  status:             z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  assignedEmployeeId: z.string().optional().nullable(),
  amount:             z.number().min(0).optional().nullable(),
  currency:           z.string().default('INR'),
});

function generateUniquePrefix(projectName: string, clientName?: string): string {
  const base = (projectName.replace(/[^a-zA-Z]/g, '').slice(0, 3) || 'PRJ').toUpperCase();
  const rand = Math.floor(100 + Math.random() * 900);
  return `${base}${rand}`;
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const clientId   = req.nextUrl.searchParams.get('clientId') ?? undefined;
  const employeeId = req.nextUrl.searchParams.get('employeeId') ?? undefined;
  const status     = req.nextUrl.searchParams.get('status') ?? undefined;
  const search     = req.nextUrl.searchParams.get('search')?.trim().toLowerCase() ?? undefined;

  const isAdmin = user.role === 'ADMIN';

  // Base query filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (clientId) where.clientId = clientId;
  if (status)   where.status = status;

  if (isAdmin) {
    if (employeeId) where.assignedEmployeeId = employeeId;
  } else {
    // DATA SECURITY: Non-admin employees can ONLY access projects assigned to them
    where.assignedEmployeeId = user.id;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { prefix: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        assignedEmployee: { select: { id: true, name: true, email: true, avatarUrl: true, designation: true } },
        _count: { select: { tasks: true } },
      },
    });

    // Compute health and task metrics for each project
    const data = await Promise.all(
      projects.map(async (p) => {
        const tasks = await prisma.task.findMany({
          where:  { projectId: p.id, deletedAt: { isSet: false } },
          select: { id: true, status: true, dueDate: true, isGate: true, dependsOn: true },
        });

        const healthMetrics = computeEngagementHealth(tasks);

        // BACKEND DATA SECURITY ENFORCEMENT:
        // If user is NOT ADMIN, project amount is completely stripped from API response.
        if (!isAdmin) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { amount, ...employeeSafeProject } = p;
          return {
            ...employeeSafeProject,
            ...healthMetrics,
          };
        }

        return { ...p, ...healthMetrics };
      }),
    );

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Failed to get projects:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  // DATA SECURITY: Only Admin can create/assign projects and set project amounts
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN authorization required' }, { status: 403 });
  }

  const body   = await req.json() as unknown;
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const {
      startDate,
      targetDate,
      deadline,
      prefix,
      assignedEmployeeId,
      amount,
      ...rest
    } = parsed.data;

    let finalPrefix = prefix ? prefix.trim().toUpperCase() : '';
    if (!finalPrefix) {
      finalPrefix = generateUniquePrefix(rest.name);
    }

    // Verify prefix uniqueness
    const existing = await prisma.project.findUnique({ where: { prefix: finalPrefix } });
    if (existing) {
      finalPrefix = `${finalPrefix.slice(0, 4)}${Math.floor(100 + Math.random() * 900)}`;
    }

    const data = await prisma.project.create({
      data: {
        ...rest,
        prefix:             finalPrefix,
        assignedEmployeeId: assignedEmployeeId || null,
        startDate:          startDate ? new Date(startDate) : undefined,
        targetDate:         targetDate ? new Date(targetDate) : undefined,
        deadline:           deadline ? new Date(deadline) : (targetDate ? new Date(targetDate) : undefined),
        amount:             typeof amount === 'number' ? amount : null,
      },
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        assignedEmployee: { select: { id: true, name: true, email: true, avatarUrl: true, designation: true } },
      },
    });

    // Auto-sync into Excel master file in background
    generateProjectExcelBuffer().catch((e) => console.error('Auto excel sync failed:', e));

    return NextResponse.json({ data }, { status: 201 });
  } catch (e: unknown) {
    console.error('Failed to create project:', e);
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return NextResponse.json({ error: 'That project code/prefix is already in use.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
