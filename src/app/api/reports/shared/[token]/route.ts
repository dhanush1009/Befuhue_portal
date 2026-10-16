import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const report = await prisma.projectReport.findUnique({
      where: { shareToken: params.token },
    });

    if (!report || !report.isPublic) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }

    if (report.shareExpiresAt && new Date() > new Date(report.shareExpiresAt)) {
      return NextResponse.json(
        { error: 'This report link has expired.' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      data: {
        reportData: report.reportData,
        title: report.title,
        month: report.month,
        year: report.year,
        notes: report.notes,
        status: report.status,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
