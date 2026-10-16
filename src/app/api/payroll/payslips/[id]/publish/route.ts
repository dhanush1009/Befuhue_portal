import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { prisma } from '@/lib/prisma';
import { generateAndUploadPayslipPdf } from '@/lib/payslip/uploadPayslipPdf';
import type { Payslip } from '@/types';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const payslip = await prisma.payslip.findUnique({ where: { id } });
  if (!payslip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (payslip.status !== 'DRAFT') return NextResponse.json({ error: 'Only DRAFT payslips can be published' }, { status: 400 });

  const settings = await prisma.companySettings.findUnique({ where: { id: 'singleton' } });
  const company  = {
    name:    settings?.name          ?? 'Deep Impression',
    logoUrl: settings?.logoUrl       ?? null,
    address: settings?.address       ?? undefined,
    footer:  settings?.payslipFooter ?? undefined,
  };

  // Generate PDF and upload to S3
  let pdfUrl: string | undefined;
  try {
    pdfUrl = await generateAndUploadPayslipPdf(payslip as unknown as Payslip, company);
  } catch (e) {
    console.error(`PDF generation failed for payslip ${id}:`, e);
  }

  const updated = await prisma.payslip.update({
    where: { id },
    data:  { status: 'PUBLISHED', publishedAt: new Date(), ...(pdfUrl ? { pdfUrl } : {}) },
  });

  await prisma.notification.create({
    data: {
      userId:  payslip.userId,
      type:    'SYSTEM',
      title:   'Payslip Published',
      body:    `Your payslip for ${payslip.payPeriod} is now available.`,
      linkUrl: '/payslips',
    },
  });

  return NextResponse.json({ data: updated });
}
