import { getDaysInMonth, getDay, startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmployeeSalaryConfig {
  basic:            number;
  hra:              number;
  conveyance:       number;
  medicalAllowance: number;
  specialAllowance: number;
  bonus:            number;
  incentive:        number;
  incomeTax:        number;
  providentFund:    number;
  esi:              number;
  professionalTax:  number;
  otherDeductions:  number;
}

export interface PayrollResult {
  workingDays:        number;
  paidDays:           number;
  lopDays:            number;
  earnedLeaveUsed:    number;
  earnedLeaveBalance: number;
  // Earnings
  basic:              number;
  hra:                number;
  conveyance:         number;
  medicalAllowance:   number;
  specialAllowance:   number;
  bonus:              number;
  incentive:          number;
  grossEarnings:      number;
  // Deductions
  incomeTax:          number;
  providentFund:      number;
  esi:                number;
  professionalTax:    number;
  otherDeductions:    number;
  lopDeduction:       number;
  totalDeductions:    number;
  totalNetPay:        number;
  amountInWords:      string;
}

// ── Task completion stats for payroll reporting ──────────────────────────────
// "Completed" = reached DONE, VERIFIED, or CLOSED status.
// For monthly metrics, use doneAt (set when task moves to DONE/VERIFIED).

export const COMPLETED_TASK_STATUSES = ['DONE', 'VERIFIED', 'CLOSED'] as const;
export type CompletedTaskStatus = typeof COMPLETED_TASK_STATUSES[number];

export function isCompletedTaskStatus(status: string): status is CompletedTaskStatus {
  return COMPLETED_TASK_STATUSES.includes(status as CompletedTaskStatus);
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

export function getTotalDaysInMonth(month: number, year: number): number {
  return getDaysInMonth(new Date(year, month - 1));
}

// month: 1-12. Working days = Mon(1)–Sat(6). Sunday(0) is the only holiday.
export function getWorkingDaysInMonth(month: number, year: number): number {
  const start   = startOfMonth(new Date(year, month - 1));
  const end     = endOfMonth(new Date(year, month - 1));
  const allDays = eachDayOfInterval({ start, end });
  return allDays.filter(day => getDay(day) !== 0).length;
}

export function getSundaysInMonth(month: number, year: number): number {
  return getTotalDaysInMonth(month, year) - getWorkingDaysInMonth(month, year);
}

// Count working days (Mon–Sat) within a date range (for leave day counting).
// Company holidays ('yyyy-MM-dd' keys) are not working days, so a holiday inside a
// leave range doesn't use up leave balance or turn into loss-of-pay.
export function countWorkingDaysInRange(from: Date, to: Date, holidayKeys?: ReadonlySet<string>): number {
  const allDays = eachDayOfInterval({ start: from, end: to });
  return allDays.filter(day => getDay(day) !== 0 && !holidayKeys?.has(format(day, 'yyyy-MM-dd'))).length;
}

// ── LOP & pay calculations ────────────────────────────────────────────────────

export function calculateLOP(
  leaveTaken: number,
  earnedLeaveAvailable: number,
): { earnedLeaveUsed: number; lopDays: number } {
  if (leaveTaken <= 0) return { earnedLeaveUsed: 0, lopDays: 0 };
  const earnedLeaveUsed = Math.min(leaveTaken, earnedLeaveAvailable);
  const lopDays         = Math.max(0, leaveTaken - earnedLeaveUsed);
  return { earnedLeaveUsed, lopDays };
}

export function calculatePaidDays(workingDays: number, lopDays: number): number {
  return Math.max(0, workingDays - lopDays);
}

export function calculatePerDaySalary(basicSalary: number, workingDays: number): number {
  return basicSalary / workingDays;
}

export function calculateLOPDeduction(
  basicSalary: number,
  workingDays: number,
  lopDays: number,
): number {
  const perDay = calculatePerDaySalary(basicSalary, workingDays);
  return parseFloat((perDay * lopDays).toFixed(2));
}

export function calculateProratedAmount(
  amount: number,
  workingDays: number,
  paidDays: number,
): number {
  if (workingDays === 0) return 0;
  return parseFloat(((amount / workingDays) * paidDays).toFixed(2));
}

// ── Currency formatting ───────────────────────────────────────────────────────

export function formatIndianCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Rs.${formatted}`;
}

// ── Number to words ───────────────────────────────────────────────────────────

export function numberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHundreds(n: number): string {
    if (n === 0) return '';
    if (n < 20)  return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    return ones[Math.floor(n / 100)] + ' Hundred ' + convertHundreds(n % 100);
  }

  if (amount === 0) return 'Zero';
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);

  let result = '';
  if (rupees >= 10000000) {
    result += convertHundreds(Math.floor(rupees / 10000000)) + 'Crore ';
    result += convertHundreds(Math.floor((rupees % 10000000) / 100000));
  } else if (rupees >= 100000) {
    result += convertHundreds(Math.floor(rupees / 100000)) + 'Lakh ';
    result += convertHundreds(Math.floor((rupees % 100000) / 1000)) + (Math.floor((rupees % 100000) / 1000) ? 'Thousand ' : '');
    result += convertHundreds(rupees % 1000);
  } else if (rupees >= 1000) {
    result += convertHundreds(Math.floor(rupees / 1000)) + 'Thousand ';
    result += convertHundreds(rupees % 1000);
  } else {
    result += convertHundreds(rupees);
  }

  let words = 'Indian Rupee ' + result.trim();
  if (paise > 0) words += ' and ' + convertHundreds(paise).trim() + ' Paise';
  words += ' Only';
  return words;
}

// ── Master payroll calculation ────────────────────────────────────────────────

export function calculatePayroll(params: {
  salary:               EmployeeSalaryConfig;
  workingDays:          number;
  leaveTakenDays:       number;
  earnedLeaveBalance:   number;
}): PayrollResult {
  const { salary, workingDays, leaveTakenDays, earnedLeaveBalance } = params;

  const { earnedLeaveUsed, lopDays } = calculateLOP(leaveTakenDays, earnedLeaveBalance);
  const paidDays   = calculatePaidDays(workingDays, lopDays);
  const lopDeduction = calculateLOPDeduction(salary.basic, workingDays, lopDays);

  const proRate = (amount: number) => calculateProratedAmount(amount, workingDays, paidDays);

  const earnings = {
    basic:            proRate(salary.basic),
    hra:              proRate(salary.hra),
    conveyance:       proRate(salary.conveyance),
    medicalAllowance: proRate(salary.medicalAllowance),
    specialAllowance: proRate(salary.specialAllowance),
    bonus:            salary.bonus,      // not pro-rated
    incentive:        salary.incentive,  // not pro-rated
  };

  const grossEarnings = parseFloat(
    Object.values(earnings).reduce((a, b) => a + b, 0).toFixed(2),
  );

  const deductions = {
    incomeTax:       salary.incomeTax,
    providentFund:   salary.providentFund,
    esi:             salary.esi,
    professionalTax: salary.professionalTax,
    otherDeductions: salary.otherDeductions,
    lopDeduction,
  };

  const totalDeductions = parseFloat(
    Object.values(deductions).reduce((a, b) => a + b, 0).toFixed(2),
  );

  const totalNetPay = parseFloat((grossEarnings - totalDeductions).toFixed(2));

  return {
    workingDays,
    paidDays,
    lopDays,
    earnedLeaveUsed,
    earnedLeaveBalance: Math.max(0, earnedLeaveBalance - earnedLeaveUsed),
    ...earnings,
    grossEarnings,
    ...deductions,
    totalDeductions,
    totalNetPay,
    amountInWords: numberToWords(totalNetPay),
  };
}
