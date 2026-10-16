/**
 * PayslipPDF — pdf-lib generator that matches PayslipTemplate.tsx exactly.
 * Colors, layout, and sections mirror the React view 1-to-1.
 */
import { PDFDocument, StandardFonts, rgb, PageSizes, type PDFFont } from 'pdf-lib';
import { format } from 'date-fns';
import type { Payslip } from '@/types';
import { formatIndianCurrency } from '@/lib/payroll';

export interface CompanyInfo {
  name:     string;
  address?: string;
  logoUrl?: string | null;
  footer?:  string;
}

// ── Colors (match PayslipTemplate) ───────────────────────────────────────────

const hex = (h: string) => {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const C = {
  dark:        hex('#111827'), // gray-900
  body:        hex('#374151'), // gray-700
  muted:       hex('#6B7280'), // gray-500
  light:       hex('#9CA3AF'), // gray-400
  border:      hex('#E5E7EB'), // gray-200
  bg:          hex('#F9FAFB'), // gray-50
  white:       rgb(1, 1, 1),
  // green theme (matches bg-green-50 / text-green-700 / border-green-200)
  greenBg:     hex('#F0FDF4'),
  greenBorder: hex('#BBF7D0'),
  greenText:   hex('#15803D'),
  greenDark:   hex('#166534'),
  // table header bg
  tableHeader: hex('#F3F4F6'), // gray-100
};

// ── Layout ────────────────────────────────────────────────────────────────────

const PW = PageSizes.A4[0]; // 595
const PH = PageSizes.A4[1]; // 842
const ML = 40;
const MR = 40;
const CW = PW - ML - MR;   // 515

// ── Helpers ───────────────────────────────────────────────────────────────────

type Page = ReturnType<PDFDocument['addPage']>;

function txt(
  page: Page, s: string, x: number, y: number,
  size: number, font: PDFFont, color = C.dark, maxW?: number,
) {
  let str = s;
  if (maxW) {
    while (str.length > 1 && font.widthOfTextAtSize(str, size) > maxW) str = str.slice(0, -1);
    if (str !== s) str = str.slice(0, -1) + '…';
  }
  page.drawText(str, { x, y, size, font, color });
}

function txtRight(page: Page, s: string, rx: number, y: number, size: number, font: PDFFont, color = C.dark) {
  page.drawText(s, { x: rx - font.widthOfTextAtSize(s, size), y, size, font, color });
}

function hline(page: Page, y: number, x1 = ML, x2 = PW - MR, color = C.border) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color });
}

function fillRect(page: Page, x: number, y: number, w: number, h: number, fill: ReturnType<typeof rgb>, borderColor?: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill, ...(borderColor ? { borderColor, borderWidth: 0.5 } : {}) });
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generatePayslipBlob(payslip: Payslip, company: CompanyInfo): Promise<Blob> {
  const doc     = await PDFDocument.create();
  const page    = doc.addPage(PageSizes.A4);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PH - 36;

  // ── Header ─────────────────────────────────────────────────────────────────
  // Left: company name / logo
  if (company.logoUrl) {
    try {
      const res  = await fetch(company.logoUrl);
      const buf  = await res.arrayBuffer();
      const mime = res.headers.get('content-type') ?? '';
      const img  = mime.includes('png') ? await doc.embedPng(buf) : await doc.embedJpg(buf);
      const dims = img.scaleToFit(130, 36);
      page.drawImage(img, { x: ML, y: y - dims.height + 8, width: dims.width, height: dims.height });
    } catch {
      txt(page, company.name, ML, y - 6, 18, bold, C.dark);
    }
  } else {
    txt(page, company.name, ML, y - 6, 18, bold, C.dark);
  }

  if (company.address) {
    txt(page, company.address, ML, y - 22, 8, regular, C.muted, 220);
  }

  // Right: "Payslip For the Month" + period
  const periodW = bold.widthOfTextAtSize(payslip.payPeriod, 18);
  txt(page, 'Payslip For the Month', PW - MR - regular.widthOfTextAtSize('Payslip For the Month', 8), y - 4, 8, regular, C.muted);
  txt(page, payslip.payPeriod, PW - MR - periodW, y - 20, 18, bold, C.dark);

  y -= 46;
  hline(page, y);
  y -= 18;

  // ── Employee Summary + Net Pay Box ─────────────────────────────────────────
  const summaryTop = y;

  // Left: Employee Summary label + table
  txt(page, 'Employee Summary', ML, y, 8, regular, C.muted);
  y -= 14;

  const infoRows: [string, string][] = [
    ['Employee Name', payslip.employeeName],
    ['Employee ID',   payslip.employeeId],
    ['Designation',   payslip.designation ?? '—'],
    ['Department',    payslip.department  ?? '—'],
    ['Pay Period',    payslip.payPeriod],
    ['Pay Date',      format(new Date(payslip.payDate), 'dd/MM/yyyy')],
  ];

  const leftColW = 95;
  for (const [label, value] of infoRows) {
    txt(page, label,  ML,             y, 9, regular, C.muted);
    txt(page, ':',    ML + leftColW,  y, 9, regular, C.muted);
    txt(page, value,  ML + leftColW + 10, y, 9, bold, C.dark, 155);
    y -= 13;
  }

  // Right: Net Pay Box — green theme matching PayslipTemplate
  const boxW  = 160;
  const boxH  = 110;
  const boxX  = PW - MR - boxW;
  const boxY  = summaryTop - boxH;

  fillRect(page, boxX, boxY, boxW, boxH, C.greenBg, C.greenBorder);

  // Net pay amount (large, right-aligned inside box)
  const netStr = formatIndianCurrency(payslip.totalNetPay);
  txtRight(page, netStr, boxX + boxW - 10, boxY + boxH - 22, 16, bold, C.greenText);

  // "Total Net Pay" label
  txt(page, 'Total Net Pay', boxX + 10, boxY + boxH - 34, 8, regular, C.muted);

  // Divider inside box
  hline(page, boxY + boxH - 42, boxX + 10, boxX + boxW - 10, C.greenBorder);

  // Paid Days / LOP Days
  txt(page, 'Paid Days',               boxX + 10, boxY + boxH - 54, 8, regular, C.muted);
  txtRight(page, String(payslip.paidDays), boxX + boxW - 10, boxY + boxH - 54, 8, bold, C.dark);

  txt(page, 'LOP Days',                boxX + 10, boxY + boxH - 68, 8, regular, C.muted);
  txtRight(page, String(payslip.lopDays),  boxX + boxW - 10, boxY + boxH - 68, 8, bold, C.dark);

  // Sync y to below both columns
  y = Math.min(y, boxY) - 16;
  hline(page, y + 8);
  y -= 10;

  // ── Earnings & Deductions tables ───────────────────────────────────────────

  const halfW  = (CW - 8) / 2;
  const rightX = ML + halfW + 8;
  const rowH   = 14;

  function drawSplitTable(
    startX: number, startY: number, w: number,
    title: string, amountHeader: string,
    rows: [string, number][], total: number, totalLabel: string,
  ): number {
    let ty = startY;

    // Header row — gray-100 bg
    fillRect(page, startX, ty - rowH, w, rowH + 1, C.tableHeader, C.border);
    txt(page, title,         startX + 8, ty - 9,  8, bold,    C.muted);
    txtRight(page, amountHeader, startX + w - 8, ty - 9, 8, bold, C.muted);
    ty -= rowH;

    // Data rows
    for (const [label, amount] of rows) {
      page.drawRectangle({ x: startX, y: ty - rowH, width: w, height: rowH, borderColor: C.border, borderWidth: 0.5 });
      txt(page, label, startX + 8, ty - 10, 9, regular, C.body);
      txtRight(page, formatIndianCurrency(amount), startX + w - 8, ty - 10, 9, regular, C.dark);
      ty -= rowH;
    }

    // Footer total row — gray-50 bg
    fillRect(page, startX, ty - rowH, w, rowH, C.bg, C.border);
    txt(page, totalLabel, startX + 8, ty - 10, 9, bold, C.dark);
    txtRight(page, formatIndianCurrency(total), startX + w - 8, ty - 10, 9, bold, C.dark);
    ty -= rowH;

    return ty;
  }

  const earningsRows: [string, number][] = [
    ['Basic',                payslip.basic],
    ['House Rent Allowance', payslip.hra],
    ['Conveyance',           payslip.conveyance],
    ['Medical Allowance',    payslip.medicalAllowance],
    ['Special Allowance',    payslip.specialAllowance],
    ['Bonus',                payslip.bonus],
    ['Incentive',            payslip.incentive],
  ];

  const deductionRows: [string, number][] = [
    ['Income Tax',       payslip.incomeTax],
    ['Provident Fund',   payslip.providentFund],
    ['ESI',              payslip.esi],
    ['Professional Tax', payslip.professionalTax],
    ['Other Deductions', payslip.otherDeductions],
    ['LOP Deduction',    payslip.lopDeduction],
  ];

  const tableTop   = y;
  const endLeft    = drawSplitTable(ML,     tableTop, halfW, 'EARNINGS',   'Amount', earningsRows,   payslip.grossEarnings,   'Gross Earnings');
  const endRight   = drawSplitTable(rightX, tableTop, halfW, 'DEDUCTIONS', 'Amount', deductionRows,  payslip.totalDeductions, 'Total Deductions');

  y = Math.min(endLeft, endRight) - 12;

  // ── Total Net Payable bar — green theme ────────────────────────────────────

  const barH = 30;
  fillRect(page, ML, y - barH, CW, barH, C.greenBg, C.greenBorder);
  txt(page, 'Total Net Payable',               ML + 10, y - 10, 9,  bold,    C.dark);
  txt(page, 'Gross Earnings - Total Deductions', ML + 10, y - 22, 7.5, regular, C.muted);
  txtRight(page, formatIndianCurrency(payslip.totalNetPay), ML + CW - 10, y - 15, 14, bold, C.greenText);
  y -= barH + 12;

  // ── Amount in Words ────────────────────────────────────────────────────────

  const labelStr = 'Amount In Words : ';
  txt(page, labelStr, ML, y, 8.5, regular, C.muted);
  txt(page, payslip.amountInWords, ML + regular.widthOfTextAtSize(labelStr, 8.5), y, 8.5, bold, C.dark, CW - regular.widthOfTextAtSize(labelStr, 8.5) - 4);
  y -= 14;
  hline(page, y);
  y -= 14;

  // ── Attendance summary strip ───────────────────────────────────────────────

  const stripItems: [string, string | number][] = [
    ['Total Days',   payslip.totalDays],
    ['Working Days', payslip.workingDays],
    ['Paid Days',    payslip.paidDays],
    ['LOP Days',     payslip.lopDays],
    ['EL Used',      payslip.earnedLeaveUsed],
    ['EL Balance',   payslip.earnedLeaveBalance],
  ];

  const stripH  = 28;
  const itemW   = CW / stripItems.length;
  fillRect(page, ML, y - stripH, CW, stripH, C.bg, C.border);

  stripItems.forEach(([label, val], i) => {
    const ix     = ML + i * itemW;
    const valStr = String(val);
    const valX   = ix + itemW / 2 - bold.widthOfTextAtSize(valStr, 10) / 2;
    const labX   = ix + itemW / 2 - regular.widthOfTextAtSize(label as string, 7) / 2;
    txt(page, valStr,        valX, y - 11, 10, bold,    C.dark);
    txt(page, label as string, labX, y - 22, 7,  regular, C.muted);
    if (i > 0) hline(page, y - 2, ix, ix);
  });

  y -= stripH + 14;

  // ── Footer ─────────────────────────────────────────────────────────────────

  hline(page, y + 4);
  y -= 10;

  const footerText = company.footer ?? `Powered by ${company.name} Payroll`;
  const sysStr     = '— This is a system-generated document. —';
  const sysW       = regular.widthOfTextAtSize(sysStr, 8);
  const ftW        = regular.widthOfTextAtSize(footerText, 7.5);
  txt(page, sysStr,     ML + CW / 2 - sysW / 2, y,     8,   regular, C.light);
  txt(page, footerText, ML + CW / 2 - ftW  / 2, y - 11, 7.5, regular, C.light);

  const bytes = await doc.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
