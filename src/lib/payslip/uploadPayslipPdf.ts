/**
 * Generates a payslip PDF and uploads it to S3.
 * Returns the public S3 URL.
 * Call this at publish time — not at download time.
 */
import { generatePayslipBlob } from '@/lib/payslip/generatePayslipPDF';
import { uploadToS3 } from '@/lib/s3';
import type { Payslip } from '@/types';

export interface CompanyInfo {
  name:     string;
  address?: string;
  logoUrl?: string | null;
  footer?:  string;
}

export async function generateAndUploadPayslipPdf(
  payslip: Payslip,
  company: CompanyInfo,
): Promise<string> {
  const blob   = await generatePayslipBlob(payslip, company);
  const buffer = Buffer.from(await blob.arrayBuffer());

  // e.g. payslips/2026/05/EMP001_May_2026.pdf
  const key = `payslips/${payslip.year}/${String(payslip.month).padStart(2, '0')}/${payslip.employeeId}_${payslip.payPeriod.replace(' ', '_')}.pdf`;

  const url = await uploadToS3(key, buffer, 'application/pdf');
  return url;
}
