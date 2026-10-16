import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { prisma } from '@/lib/prisma';
import { generateAndUploadPayslipPdf } from '@/lib/payslip/uploadPayslipPdf';
import type { Payslip } from '@/types';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const isAdmin = user.role === 'ADMIN';
  const { id }  = await params;

  const payslip = await prisma.payslip.findUnique({ where: { id } });
  if (!payslip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!isAdmin && (payslip.userId !== user.id || payslip.status !== 'PUBLISHED')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Happy path — PDF already on S3, just redirect
  if (payslip.pdfUrl) {
    return NextResponse.redirect(payslip.pdfUrl);
  }

  // Fallback — PDF missing (e.g. old payslip before this feature), generate now and cache it
  const settings = await prisma.companySettings.findUnique({ where: { id: 'singleton' } });
  const company  = {
    name:    settings?.name          ?? 'Deep Impression',
    logoUrl: settings?.logoUrl       ?? null,
    address: settings?.address       ?? undefined,
    footer:  settings?.payslipFooter ?? undefined,
  };

  try {
    const pdfUrl = await generateAndUploadPayslipPdf(payslip as unknown as Payslip, company);

    // Store so next download is instant
    await prisma.payslip.update({ where: { id }, data: { pdfUrl } });

    return NextResponse.redirect(pdfUrl);
  } catch (e) {
    console.error('PDF generation failed:', e);
    return NextResponse.json({ error: 'Failed to generate payslip PDF' }, { status: 500 });
  }
}
