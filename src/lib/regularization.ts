import { differenceInDays, startOfDay, getDay, eachDayOfInterval } from 'date-fns';
import type { PrismaClient } from '@prisma/client';

export interface RegularizationRecord {
  id:                string;
  userId:            string;
  date:              Date;
  requestedClockIn:  Date;
  requestedClockOut: Date | null;
}

// ── Eligibility ───────────────────────────────────────────────────────────────

export function isEligibleForRegularization(date: Date): { eligible: boolean; reason?: string } {
  const today      = startOfDay(new Date());
  const targetDate = startOfDay(date);

  if (targetDate >= today) {
    return { eligible: false, reason: 'Cannot regularize today or future dates.' };
  }
  if (getDay(targetDate) === 0) {
    return { eligible: false, reason: 'Sunday is a holiday and cannot be regularized.' };
  }
  const daysDiff = differenceInDays(today, targetDate);
  if (daysDiff > 30) {
    return {
      eligible: false,
      reason:   'Regularization window is 30 days. Contact your admin for older dates.',
    };
  }
  return { eligible: true };
}

// ── Time validation ───────────────────────────────────────────────────────────

export function validateRegularizationTimes(
  clockIn:  Date,
  clockOut?: Date,
): { valid: boolean; reason?: string } {
  if (clockOut && clockOut <= clockIn) {
    return { valid: false, reason: 'Clock out time must be after clock in time.' };
  }
  if (clockOut) {
    const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    if (hoursWorked > 16) {
      return { valid: false, reason: 'Claimed working hours cannot exceed 16 hours.' };
    }
  }
  return { valid: true };
}

// ── Get reviewer ──────────────────────────────────────────────────────────────

export async function getRegularizationReviewer(
  userId: string,
  prisma:  PrismaClient,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { managerId: true },
  });
  return user?.managerId ?? null;
}

// ── Apply approved regularization ─────────────────────────────────────────────
// Uses `(prisma as any)` for new models/fields until `prisma generate` runs after migration.

export async function applyRegularization(
  regularization: RegularizationRecord,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
): Promise<void> {
  const { userId, date, requestedClockIn, requestedClockOut, id } = regularization;

  const durationMins = requestedClockOut
    ? Math.round((requestedClockOut.getTime() - requestedClockIn.getTime()) / 60000)
    : null;

  const attendance = await (prisma as PrismaClient).attendance.upsert({
    where:  { userId_date: { userId, date } },
    create: { userId, date, type: 'OFFICE', ipAddress: 'regularized' },
    update: {},
  });

  const existing = await prisma.attendanceSession.findFirst({
    where: { attendanceId: attendance.id, isRegularized: true },
  });

  if (existing) {
    await prisma.attendanceSession.update({
      where: { id: existing.id },
      data:  { clockIn: requestedClockIn, clockOut: requestedClockOut ?? null, durationMins, regularizationId: id },
    });
  } else {
    await prisma.attendanceSession.create({
      data: {
        attendanceId:     attendance.id,
        clockIn:          requestedClockIn,
        clockOut:         requestedClockOut ?? null,
        durationMins,
        isRegularized:    true,
        regularizationId: id,
      },
    });
  }

  await prisma.attendanceRegularization.update({
    where: { id },
    data:  { attendanceId: attendance.id },
  });
}

// ── Count working days (Mon-Sat) in range ─────────────────────────────────────

export function countWorkingDaysInRange(from: Date, to: Date): number {
  return eachDayOfInterval({ start: from, end: to }).filter((d) => getDay(d) !== 0).length;
}
