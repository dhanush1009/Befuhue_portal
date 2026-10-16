import { NextRequest, NextResponse } from 'next/server';
import { format, parseISO } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createAuditLog } from '@/lib/audit';
import { getISTDateString } from '@/lib/attendance';
import { holidayDayKey, holidayStoredDate } from '@/lib/holidays';
import { holidayInputSchema } from '@/lib/validations/holiday';
import { notifyHolidayChange } from '@/lib/holidaysDb';

function present(h: { id: string; date: Date; name: string; note: string | null }) {
  return { id: h.id, date: holidayDayKey(h.date), name: h.name, note: h.note };
}

// ── GET — the calendar (everyone can read) ────────────────────────────────────
//   ?year=2026       every holiday in that year
//   ?upcoming=3      the next N holidays from today, with days-away

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const today = getISTDateString();

  try {
    const upcoming = sp.get('upcoming');
    if (upcoming) {
      const n = Math.min(20, Math.max(1, Number(upcoming) || 3));
      const rows = await prisma.holiday.findMany({
        where:   { date: { gte: holidayStoredDate(today) } },
        orderBy: { date: 'asc' },
        take:    n,
      });
      const todayMs = parseISO(today).getTime();
      return NextResponse.json({
        data: rows.map((h) => ({ ...present(h), daysAway: Math.round((parseISO(holidayDayKey(h.date)).getTime() - todayMs) / 86_400_000) })),
      });
    }

    const year = Number(sp.get('year') ?? today.slice(0, 4));
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      return NextResponse.json({ error: 'year must be between 2020 and 2100' }, { status: 400 });
    }
    const rows = await prisma.holiday.findMany({
      where:   { date: { gte: holidayStoredDate(`${year}-01-01`), lte: holidayStoredDate(`${year}-12-31`) } },
      orderBy: { date: 'asc' },
    });
    return NextResponse.json({ data: rows.map(present), meta: { year, today } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST — add one holiday (admin) ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = holidayInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { date, name, note } = parsed.data;

  try {
    const stored = holidayStoredDate(date);
    const existing = await prisma.holiday.findUnique({ where: { date: stored } });
    if (existing) {
      return NextResponse.json({ error: `${format(parseISO(date), 'd MMM yyyy')} is already "${existing.name}". Edit that one instead.` }, { status: 409 });
    }
    const created = await prisma.holiday.create({ data: { date: stored, name, note: note || null, createdBy: user.id } });
    await createAuditLog(user.id, 'HOLIDAY_CREATED', created.id, 'Holiday', { name: { before: null, after: name }, date: { before: null, after: date } });
    notifyHolidayChange(user.id, `New holiday: ${name}`, `${format(parseISO(date), 'EEEE, d MMMM yyyy')} is a company holiday.`);
    return NextResponse.json({ data: present(created) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
