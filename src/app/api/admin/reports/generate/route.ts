import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { generateProjectReport } from '@/lib/reports/generateReport';
import { z } from 'zod';

const generateSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { projectId, month, year } = parsed.data;
    const report = await generateProjectReport(
      projectId,
      month,
      year,
      prisma,
      user.name || 'Admin'
    );

    return NextResponse.json({ data: report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
