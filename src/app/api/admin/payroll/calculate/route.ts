import { NextRequest, NextResponse } from 'next/server';
import { getDaysInMonth, format, max, min } from 'date-fns';
import { auth } from '@/lib/auth.config';
import { prisma } from '@/lib/prisma';
import { calculatePayrollSchema } from '@/lib/validations/payroll';
import {
  getWorkingDaysInMonth,
  getTotalDaysInMonth,
  calculatePayroll,
  countWorkingDaysInRange,
} from '@/lib/payroll';
import { getISTMidnight } from '@/lib/attendance';
import { getHolidayKeySet } from '@/lib/holidaysDb';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json();
  const parsed = calculatePayrollSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { month, year, employeeId } = parsed.data;
  const workingDays = getWorkingDaysInMonth(month, year);
  const totalDays   = getTotalDaysInMonth(month, year);
  const payPeriod   = format(new Date(year, month - 1, 1), 'MMMM yyyy');
  // Use IST-anchored boundaries so date comparisons match stored attendance dates
  const monthStart  = getISTMidnight(new Date(year, month - 1, 1));
  const monthEnd    = getISTMidnight(new Date(year, month - 1, totalDays));

  // Fetch target employees
  const employees = await prisma.user.findMany({
    where: {
      isActive:  true,
      deletedAt: { isSet: false },
      ...(employeeId ? { id: employeeId } : {}),
    },
    include: { salary: true },
    orderBy: { name: 'asc' },
  });

  // For employeeId display, get a stable sorted index across ALL active employees
  const allActive = await prisma.user.findMany({
    where:   { isActive: true, deletedAt: { isSet: false } },
    orderBy: { createdAt: 'asc' },
    select:  { id: true },
  });
  const empIndexMap = new Map(allActive.map((e, i) => [e.id, i + 1]));

  const calculated: { id: string; name: string; netPay: number; status: string }[] = [];
  const errors: string[] = [];

  for (const emp of employees) {
    if (!emp.salary) {
      errors.push(`${emp.name} (${emp.id}): no salary configured`);
      continue;
    }

    // 1. Get all approved leaves that overlap this month
    const leaves = await prisma.leave.findMany({
      where: {
        userId:   emp.id,
        status:   'APPROVED',
        fromDate: { lte: monthEnd },
        toDate:   { gte: monthStart },
      },
    });

    // Fetch approved regularizations for this month — these days count as PRESENT
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approvedRegs = await (prisma as any).attendanceRegularization.findMany({
      where: {
        userId: emp.id,
        status: 'APPROVED',
        date:   { gte: monthStart, lte: monthEnd },
      },
      select: { date: true },
    }) as { date: Date }[];
    const regularizedDates = new Set(approvedRegs.map((r) => format(r.date, 'yyyy-MM-dd')));

    // Count only working days (Mon–Sat) within the month for each leave,
    // but exclude days already covered by approved regularization (those are PRESENT).
    const holidayKeys = await getHolidayKeySet(monthStart, monthEnd);
    let leaveTakenDays = 0;
    for (const leave of leaves) {
      const clampedFrom = max([new Date(leave.fromDate), monthStart]);
      const clampedTo   = min([new Date(leave.toDate),   monthEnd]);
      // Count working days in range, excluding regularized dates
      const rangeDays = countWorkingDaysInRange(clampedFrom, clampedTo, holidayKeys);
      // Subtract any days that were regularized (those are already paid)
      let regDaysInRange = 0;
      for (const dateStr of regularizedDates) {
        const d = new Date(dateStr as string);
        if (d >= clampedFrom && d <= clampedTo) regDaysInRange++;
      }
      leaveTakenDays += Math.max(0, rangeDays - regDaysInRange);
    }

    // 2. Get earned leave balance
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: { userId_year: { userId: emp.id, year } },
    });
    const earnedLeaveBalance = Math.max(
      0,
      (leaveBalance?.earnedLeave ?? 0) - (leaveBalance?.usedEarnedLeave ?? 0),
    );

    // 3. Run calculation
    const result = calculatePayroll({
      salary:             emp.salary,
      workingDays,
      leaveTakenDays,
      earnedLeaveBalance,
    });

    const empDisplayId = `EMP${String(empIndexMap.get(emp.id) ?? 999).padStart(3, '0')}`;

    // 4. Upsert payslip (recalculate if already exists)
    const payslip = await prisma.payslip.upsert({
      where:  { userId_month_year: { userId: emp.id, month, year } },
      update: {
        employeeId:         empDisplayId,
        payPeriod,
        payDate:            new Date(),
        employeeName:       emp.name,
        designation:        emp.designation ?? '',
        department:         emp.department  ?? '',
        totalDays,
        workingDays:        result.workingDays,
        paidDays:           result.paidDays,
        lopDays:            result.lopDays,
        earnedLeaveUsed:    result.earnedLeaveUsed,
        earnedLeaveBalance: result.earnedLeaveBalance,
        basic:              result.basic,
        hra:                result.hra,
        conveyance:         result.conveyance,
        medicalAllowance:   result.medicalAllowance,
        specialAllowance:   result.specialAllowance,
        bonus:              result.bonus,
        incentive:          result.incentive,
        grossEarnings:      result.grossEarnings,
        incomeTax:          result.incomeTax,
        providentFund:      result.providentFund,
        esi:                result.esi,
        professionalTax:    result.professionalTax,
        otherDeductions:    result.otherDeductions,
        lopDeduction:       result.lopDeduction,
        totalDeductions:    result.totalDeductions,
        totalNetPay:        result.totalNetPay,
        amountInWords:      result.amountInWords,
        status:             'DRAFT',
        publishedAt:        null,
      },
      create: {
        userId:             emp.id,
        employeeId:         empDisplayId,
        month,
        year,
        payPeriod,
        payDate:            new Date(),
        employeeName:       emp.name,
        designation:        emp.designation ?? '',
        department:         emp.department  ?? '',
        totalDays,
        workingDays:        result.workingDays,
        paidDays:           result.paidDays,
        lopDays:            result.lopDays,
        earnedLeaveUsed:    result.earnedLeaveUsed,
        earnedLeaveBalance: result.earnedLeaveBalance,
        basic:              result.basic,
        hra:                result.hra,
        conveyance:         result.conveyance,
        medicalAllowance:   result.medicalAllowance,
        specialAllowance:   result.specialAllowance,
        bonus:              result.bonus,
        incentive:          result.incentive,
        grossEarnings:      result.grossEarnings,
        incomeTax:          result.incomeTax,
        providentFund:      result.providentFund,
        esi:                result.esi,
        professionalTax:    result.professionalTax,
        otherDeductions:    result.otherDeductions,
        lopDeduction:       result.lopDeduction,
        totalDeductions:    result.totalDeductions,
        totalNetPay:        result.totalNetPay,
        amountInWords:      result.amountInWords,
        status:             'DRAFT',
      },
    });

    calculated.push({ id: emp.id, name: emp.name, netPay: result.totalNetPay, status: payslip.status });
  }

  return NextResponse.json({
    data: { calculated: calculated.length, errors, payPeriod, payslips: calculated },
  });
}
