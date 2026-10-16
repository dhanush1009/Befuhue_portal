import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { adminDetailsSchema, employeeDetailsSchema } from '@/lib/details/validation';
import { buildUpdate, completeness, forCreate, forUpdate, secretLabel, toClientDetails } from '@/lib/details/service';

// An employee's HR details. Only the person themselves and Admins can read or change them.

type Ctx = { params: { id: string } };

async function allowed(id: string) {
  const auth = await requireAuth();
  if (auth.error) return { error: auth.error } as const;
  if (auth.user.id !== id && auth.user.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }
  return { user: auth.user, isAdmin: auth.user.role === 'ADMIN', isSelf: auth.user.id === id } as const;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const a = await allowed(params.id);
  if ('error' in a) return a.error;

  const owner = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!owner) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const row = await prisma.employeeDetails.findUnique({ where: { userId: params.id } });
  const details = toClientDetails(row, a.isAdmin);
  return NextResponse.json({ data: { details, completeness: completeness(details), canEditAdminFields: a.isAdmin } });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const a = await allowed(params.id);
  if ('error' in a) return a.error;

  const owner = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!owner) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null) as unknown;
  const parsed = (a.isAdmin ? adminDetailsSchema : employeeDetailsSchema).safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? 'Invalid details', fields: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { data, secretsChanged } = buildUpdate(parsed.data, a.isAdmin);
    const existing = await prisma.employeeDetails.findUnique({ where: { userId: params.id }, select: { id: true } });
    if (existing) await prisma.employeeDetails.update({ where: { userId: params.id }, data: forUpdate(data) });
    else await prisma.employeeDetails.create({ data: forCreate(params.id, data) });

    // Bank and ID changes leave a trail: which fields changed (never the values) and who did it.
    const bankTouched = ['bankHolderName', 'bankName', 'bankBranch', 'ifsc', 'accountType'].some((k) => k in data);
    if (secretsChanged.length || bankTouched) {
      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const k of secretsChanged) changes[secretLabel(k)] = { before: 'hidden', after: 'changed' };
      if (bankTouched) changes['Bank details'] = { before: 'hidden', after: 'changed' };
      await createAuditLog(a.user.id, a.isSelf ? 'DETAILS_UPDATED' : 'DETAILS_UPDATED_BY_ADMIN', params.id, 'EmployeeDetails', changes);

      // Tell the admins when an employee changes how they get paid.
      if (a.isSelf && !a.isAdmin && (secretsChanged.includes('bankAccount') || bankTouched)) {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
        await Promise.all(admins.map((x) => createNotification(
          x.id, 'SYSTEM', 'Bank details updated', `${owner.name} updated their bank details. Review them in their profile.`, `/hr/${params.id}`,
        )));
      }
    }

    const row = await prisma.employeeDetails.findUnique({ where: { userId: params.id } });
    const details = toClientDetails(row, a.isAdmin);
    return NextResponse.json({ data: { details, completeness: completeness(details), canEditAdminFields: a.isAdmin } });
  } catch (e) {
    console.error('[details] save failed', e);
    return NextResponse.json({ error: 'Could not save your details. Please try again.' }, { status: 500 });
  }
}
