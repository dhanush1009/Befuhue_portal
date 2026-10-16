import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { generateReportPDFBlob } from '@/lib/reports/ReportPDF';
import type { ProjectReportData } from '@/types/report';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const report = await prisma.projectReport.findUnique({
      where: { id: params.id },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const reportData = report.reportData as unknown as ProjectReportData;
    if (report.notes && !reportData.adminNotes) {
      reportData.adminNotes = report.notes;
    }

    const blob = await generateReportPDFBlob(reportData);
    const arrayBuffer = await blob.arrayBuffer();
    const filename = `${report.title.replace(/\s+/g, '_')}.pdf`;

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
