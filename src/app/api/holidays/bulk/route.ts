import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createAuditLog } from '@/lib/audit';
import { holidayDayKey, holidayStoredDate } from '@/lib/holidays';
import { notifyHolidayChange } from '@/lib/holidaysDb';
import { holidayInputSchema } from '@/lib/validations/holiday';

const bulkSchema = z.object({
  rows: z.array(holidayInputSchema).min(1, 'Add at least one holiday').max(200),
  // merge: add new dates and update ones that already exist; leave everything else alone.
  // replaceYear: make `year` match this list exactly — holidays in that year that aren't listed are removed.
  mode: z.enum(['merge', 'replaceYear']).default('merge'),
  year: z.number().int().min(2020).max(2100).optional(),
});

// ── POST — add / update many holidays at once (admin) ─────────────────────────

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { rows, mode, year } = parsed.data;

  if (mode === 'replaceYear' && !year) {
    return NextResponse.json({ error: 'year is required to replace a year' }, { status: 400 });
  }
  // Replacing a year with dates from another year would be a silent foot-gun.
  if (mode === 'replaceYear' && rows.some((r) => !r.date.startsWith(`${year}-`))) {
    return NextResponse.json({ error: `Every date must fall in ${year} when replacing that year.` }, { status: 400 });
  }

  // Collapse duplicate dates inside the payload (last one wins).
  const byDate = new Map(rows.map((r) => [r.date, r]));

  try {
    let removed = 0;
    if (mode === 'replaceYear' && year) {
      const keep = [...byDate.keys()].map(holidayStoredDate);
      const res = await prisma.holiday.deleteMany({
        where: {
          date: { gte: holidayStoredDate(`${year}-01-01`), lte: holidayStoredDate(`${year}-12-31`), notIn: keep },
        },
      });
      removed = res.count;
    }

    let added = 0;
    let updated = 0;
    for (const r of byDate.values()) {
      const stored   = holidayStoredDate(r.date);
      const existing = await prisma.holiday.findUnique({ where: { date: stored } });
      if (existing) {
        if (existing.name !== r.name || (existing.note ?? null) !== (r.note || null)) {
          await prisma.holiday.update({ where: { id: existing.id }, data: { name: r.name, note: r.note || null } });
          updated++;
        }
      } else {
        await prisma.holiday.create({ data: { date: stored, name: r.name, note: r.note || null, createdBy: user.id } });
        added++;
      }
    }

    await createAuditLog(user.id, 'HOLIDAYS_IMPORTED', year ? String(year) : 'bulk', 'Holiday', {
      summary: { before: null, after: { mode, added, updated, removed } },
    });
    if (added + updated + removed > 0) {
      const years = [...new Set([...byDate.keys()].map((k) => k.slice(0, 4)))].join(', ');
      notifyHolidayChange(user.id, `Holiday calendar updated (${years})`, `${added} added, ${updated} changed${removed ? `, ${removed} removed` : ''}. Open Holidays to see the list.`);
    }

    const all = await prisma.holiday.findMany({ orderBy: { date: 'asc' }, select: { date: true } });
    return NextResponse.json({ data: { added, updated, removed, total: all.length, firstDate: all[0] ? holidayDayKey(all[0].date) : null } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
