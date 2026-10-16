import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { auth } from '@/lib/auth.config';
import { prisma } from '@/lib/prisma';
import { publishBulkSchema } from '@/lib/validations/payroll';
import { sendEmail } from '@/lib/mailer';
import { generateAndUploadPayslipPdf } from '@/lib/payslip/uploadPayslipPdf';
import type { Payslip } from '@/types';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json();
  const parsed = publishBulkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { month, year, employeeIds } = parsed.data;

  // Find all DRAFT payslips for this period (optionally filtered by employeeIds)
  const payslips = await prisma.payslip.findMany({
    where: {
      month,
      year,
      status: 'DRAFT',
      ...(employeeIds?.length ? { userId: { in: employeeIds } } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!payslips.length) {
    return NextResponse.json({ data: { published: 0, message: 'No DRAFT payslips found for this period' } });
  }

  const now       = new Date();
  const payPeriod = format(new Date(year, month - 1, 1), 'MMMM yyyy');
  const settings  = await prisma.companySettings.findUnique({ where: { id: 'singleton' } });
  const company   = {
    name:    settings?.name          ?? 'Deep Impression',
    logoUrl: settings?.logoUrl       ?? null,
    address: settings?.address       ?? undefined,
    footer:  settings?.payslipFooter ?? undefined,
  };
  let published   = 0;

  for (const payslip of payslips) {
    // Generate PDF and upload to S3 (best-effort — don't fail publish on PDF error)
    let pdfUrl: string | undefined;
    try {
      pdfUrl = await generateAndUploadPayslipPdf(payslip as unknown as Payslip, company);
    } catch (e) {
      console.error(`PDF generation failed for payslip ${payslip.id}:`, e);
    }

    // Publish
    await prisma.payslip.update({
      where: { id: payslip.id },
      data:  { status: 'PUBLISHED', publishedAt: now, ...(pdfUrl ? { pdfUrl } : {}) },
    });

    // In-app notification
    await prisma.notification.create({
      data: {
        userId:  payslip.userId,
        type:    'SYSTEM',
        title:   'Payslip Available',
        body:    `Your payslip for ${payPeriod} is now available.`,
        linkUrl: '/payslips',
      },
    });

    // Email notification (best-effort — don't fail the whole batch on email error)
    try {
      await sendEmail({
        to:      payslip.user.email,
        subject: `Your payslip for ${payPeriod} is now available`,
        html: `
          <p>Hi ${payslip.user.name},</p>
          <p>Your payslip for <strong>${payPeriod}</strong> has been published.</p>
          <p>Net Pay: <strong>Rs.${payslip.totalNetPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></p>
          <p>Log in to the portal to view and download your payslip.</p>
        `,
      });
    } catch {
      // Email failure should not block publish
    }

    published++;
  }

  return NextResponse.json({ data: { published, payPeriod } });
}
