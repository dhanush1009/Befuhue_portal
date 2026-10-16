import { NextRequest, NextResponse } from 'next/server';
import { format, parseISO } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createAuditLog } from '@/lib/audit';
import { holidayDayKey, holidayStoredDate } from '@/lib/holidays';
import { notifyHolidayChange } from '@/lib/holidaysDb';
import { holidayInputSchema } from '@/lib/validations/holiday';

// ── PATCH — change a holiday's date, name or note (admin) ─────────────────────

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = holidayInputSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const before = await prisma.holiday.findUnique({ where: { id: params.id } });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { date, name, note } = parsed.data;
    if (date) {
      const clash = await prisma.holiday.findFirst({ where: { date: holidayStoredDate(date), id: { not: params.id } } });
      if (clash) return NextResponse.json({ error: `${format(parseISO(date), 'd MMM yyyy')} is already "${clash.name}".` }, { status: 409 });
    }

    const updated = await prisma.holiday.update({
      where: { id: params.id },
      data: {
        ...(date !== undefined ? { date: holidayStoredDate(date) } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(note !== undefined ? { note: note || null } : {}),
      },
    });

    const beforeKey = holidayDayKey(before.date);
    const afterKey  = holidayDayKey(updated.date);
    await createAuditLog(user.id, 'HOLIDAY_UPDATED', updated.id, 'Holiday', {
      ...(before.name !== updated.name ? { name: { before: before.name, after: updated.name } } : {}),
      ...(beforeKey !== afterKey ? { date: { before: beforeKey, after: afterKey } } : {}),
    });
    // People plan around holidays — tell them when one moves or is renamed.
    if (before.name !== updated.name || beforeKey !== afterKey) {
      notifyHolidayChange(
        user.id,
        `Holiday updated: ${updated.name}`,
        beforeKey !== afterKey
          ? `Now on ${format(parseISO(afterKey), 'EEEE, d MMMM yyyy')} (was ${format(parseISO(beforeKey), 'd MMM')}).`
          : `Renamed from "${before.name}".`,
      );
    }
    return NextResponse.json({ data: { id: updated.id, date: afterKey, name: updated.name, note: updated.note } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE — remove a holiday (admin) ─────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const before = await prisma.holiday.findUnique({ where: { id: params.id } });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.holiday.delete({ where: { id: params.id } });
    const key = holidayDayKey(before.date);
    await createAuditLog(user.id, 'HOLIDAY_DELETED', before.id, 'Holiday', { name: { before: before.name, after: null }, date: { before: key, after: null } });
    notifyHolidayChange(user.id, `Holiday removed: ${before.name}`, `${format(parseISO(key), 'EEEE, d MMMM yyyy')} is no longer a company holiday.`);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
