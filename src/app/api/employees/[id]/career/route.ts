import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { createAuditLog } from '@/lib/audit';
import { buildTimeline, createCareerEventSchema, tenure, toDay } from '@/lib/career';

// An employee's promotions timeline. Admins only - the person themselves cannot see it either.

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;

  const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, joiningDate: true, designation: true } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const events = await prisma.careerEvent.findMany({ where: { userId: params.id }, orderBy: { effectiveDate: 'desc' } });
  // What they started as: the "from" of their earliest move, or their current title if nothing has changed yet.
  const firstDesignation = [...events].reverse().find((e) => e.fromDesignation)?.fromDesignation ?? (events.length ? null : user.designation);
  return NextResponse.json({
    data: {
      timeline: buildTimeline(events, user.joiningDate, firstDesignation),
      currentDesignation: user.designation,
      tenure: tenure(user.joiningDate, new Date()),
    },
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, designation: true, name: true } });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = createCareerEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid entry' }, { status: 400 });
  const v = parsed.data;

  const created = await prisma.careerEvent.create({
    data: {
      userId: params.id, type: v.type, effectiveDate: toDay(v.effectiveDate), title: v.title,
      fromDesignation: v.fromDesignation ?? target.designation ?? null, toDesignation: v.toDesignation ?? null,
      note: v.note ?? null, createdById: admin.id,
    },
  });
  if (v.updateDesignation && v.toDesignation) {
    await prisma.user.update({ where: { id: params.id }, data: { designation: v.toDesignation } });
  }
  await createAuditLog(admin.id, 'CAREER_EVENT_ADDED', params.id, 'CareerEvent', {
    [v.type]: { before: v.fromDesignation ?? target.designation ?? null, after: v.toDesignation ?? v.title },
  });
  return NextResponse.json({ data: { id: created.id } }, { status: 201 });
}
