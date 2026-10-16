import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { z } from 'zod';

const updateReportSchema = z.object({
  notes: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
  shareToken: z.string().optional().nullable(),
  shareExpiresAt: z.string().datetime().optional().nullable(),
  status: z.enum(['DRAFT', 'SAVED', 'SHARED', 'ARCHIVED']).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const report = await prisma.projectReport.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { id: true, name: true, prefix: true } },
        generatedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // If regular employee, check if they have tasks in this project
    if (user.role !== 'ADMIN') {
      const hasTask = await prisma.task.findFirst({
        where: { projectId: report.projectId, assigneeId: user.id },
      });
      if (!hasTask) {
        return NextResponse.json({ error: 'Forbidden — not a member of this project' }, { status: 403 });
      }
    }

    return NextResponse.json({ data: report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = updateReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.projectReport.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.isPublic !== undefined ? { isPublic: parsed.data.isPublic } : {}),
        ...(parsed.data.shareToken !== undefined ? { shareToken: parsed.data.shareToken } : {}),
        ...(parsed.data.shareExpiresAt !== undefined
          ? {
              shareExpiresAt: parsed.data.shareExpiresAt
                ? new Date(parsed.data.shareExpiresAt)
                : null,
            }
          : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      },
      include: {
        project: { select: { id: true, name: true, prefix: true } },
        generatedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  try {
    await prisma.projectReport.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
