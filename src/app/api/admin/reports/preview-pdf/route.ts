import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { generateReportPDFBlob } from '@/lib/reports/ReportPDF';
import type { ProjectReportData } from '@/types/report';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();
    if (!body.reportData) {
      return NextResponse.json({ error: 'Missing reportData' }, { status: 400 });
    }

    const reportData = body.reportData as ProjectReportData;
    const blob = await generateReportPDFBlob(reportData);
    const arrayBuffer = await blob.arrayBuffer();
    const filename = `${(reportData.projectName || 'Project').replace(/\s+/g, '_')}_${(reportData.monthLabel || 'Report').replace(/\s+/g, '_')}.pdf`;

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate preview PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
