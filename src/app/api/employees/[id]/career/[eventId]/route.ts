import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { createAuditLog } from '@/lib/audit';
import { toDay, updateCareerEventSchema } from '@/lib/career';

type Ctx = { params: { id: string; eventId: string } };

async function findOwn(ctx: Ctx) {
  const e = await prisma.careerEvent.findUnique({ where: { id: ctx.params.eventId } });
  return e && e.userId === ctx.params.id ? e : null;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;
  if (!(await findOwn(ctx))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = updateCareerEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid entry' }, { status: 400 });
  const { effectiveDate, ...rest } = parsed.data;

  await prisma.careerEvent.update({ where: { id: ctx.params.eventId }, data: { ...rest, ...(effectiveDate ? { effectiveDate: toDay(effectiveDate) } : {}) } });
  await createAuditLog(admin.id, 'CAREER_EVENT_UPDATED', ctx.params.id, 'CareerEvent');
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;
  if (!(await findOwn(ctx))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.careerEvent.delete({ where: { id: ctx.params.eventId } });
  await createAuditLog(admin.id, 'CAREER_EVENT_REMOVED', ctx.params.id, 'CareerEvent');
  return NextResponse.json({ data: { ok: true } });
}
