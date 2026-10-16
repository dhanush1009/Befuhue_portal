import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { z } from 'zod';

const saveReportSchema = z.object({
  projectId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  notes: z.string().optional().nullable(),
  reportData: z.record(z.string(), z.any()),
});


export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = saveReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { projectId, month, year, notes, reportData } = parsed.data;

    const title = `${reportData.projectName ?? 'Project'} — ${reportData.monthLabel ?? `${month}/${year}`} Report`;

    const saved = await prisma.projectReport.upsert({
      where: {
        projectId_month_year: { projectId, month, year },
      },
      create: {
        projectId,
        month,
        year,
        title,
        generatedById: user.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reportData: reportData as any,
        notes: notes ?? null,
        status: 'SAVED',
      },
      update: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reportData: reportData as any,
        notes: notes ?? null,
        generatedById: user.id,
        generatedAt: new Date(),
        status: 'SAVED',
      },
      include: {
        project: { select: { id: true, name: true } },
        generatedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ data: saved }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
