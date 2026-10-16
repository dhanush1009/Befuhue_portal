import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { updateEmployeeSchema, updateOwnProfileSchema } from '@/lib/validations/employee';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/mailer';

const EMPLOYEE_SELECT = {
  id: true, name: true, email: true, role: true,
  department: true, designation: true, phone: true,
  avatarUrl: true, managerId: true, isActive: true,
  employmentType: true, createdAt: true, joiningDate: true, attendanceMode: true,
  manager: { select: { id: true, name: true, avatarUrl: true } },
  _count:  { select: { leaves: true, tasks: true } },
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const data = await prisma.user.findUnique({ where: { id: params.id }, select: EMPLOYEE_SELECT });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Colleagues get the directory basics; leave/task counts are for the person themselves and admins.
    if (user.role !== 'ADMIN' && user.id !== params.id) {
      const { _count, ...basics } = data;
      void _count;
      return NextResponse.json({ data: basics });
    }
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const isSelf  = user.id === params.id;
  const isAdmin  = user.role === 'ADMIN';

  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body   = await req.json() as unknown;
  const schema = isAdmin ? updateEmployeeSchema : updateOwnProfileSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Prevent self-role-escalation
  if (!isAdmin && 'role' in parsed.data) {
    return NextResponse.json({ error: 'Cannot change own role' }, { status: 403 });
  }

  // Check email uniqueness if changing email
  const data = parsed.data as Record<string, unknown>;
  if (data.email) {
    const conflict = await prisma.user.findFirst({ where: { email: data.email as string, id: { not: params.id } } });
    if (conflict) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  // joiningDate arrives as a string (from a <input type="date">) — Prisma needs a Date.
  const { joiningDate, ...restData } = parsed.data as Record<string, unknown> & { joiningDate?: string | null };
  const updateData = {
    ...restData,
    ...(joiningDate !== undefined ? { joiningDate: joiningDate ? new Date(joiningDate) : null } : {}),
  };

  try {
    const before = await prisma.user.findUnique({ where: { id: params.id }, select: EMPLOYEE_SELECT });
    const updated = await prisma.user.update({ where: { id: params.id }, data: updateData, select: EMPLOYEE_SELECT });

    // Build changes diff for audit
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(parsed.data)) {
      const bVal = (before as Record<string, unknown>)?.[key];
      const aVal = (updated as Record<string, unknown>)?.[key];
      if (bVal !== aVal) changes[key] = { before: bVal, after: aVal };
    }
    await createAuditLog(user.id, 'EMPLOYEE_UPDATED', params.id, 'Employee', changes);

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (user.id === params.id) {
    return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, name: true, email: true, role: true, isActive: true } });
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (target.role === 'ADMIN') return NextResponse.json({ error: 'Cannot deactivate an admin account' }, { status: 403 });
    if (!target.isActive) return NextResponse.json({ error: 'Account is already inactive' }, { status: 409 });

    // Soft delete + cleanup in a transaction
    await prisma.$transaction([
      // Soft delete the user
      prisma.user.update({
        where: { id: params.id },
        data:  { isActive: false, deletedAt: new Date() },
      }),
      // Unassign pending tasks
      prisma.task.updateMany({
        where: { assigneeId: params.id, status: { in: ['TO_DO', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_REVIEW'] }, deletedAt: { isSet: false } },
        data:  { assigneeId: null },
      }),
      // Cancel pending leaves
      prisma.leave.updateMany({
        where: { userId: params.id, status: 'PENDING' },
        data:  { status: 'CANCELLED' },
      }),
    ]);

    await createAuditLog(user.id, 'EMPLOYEE_DELETED', params.id, 'Employee');

    // Deactivation email (fire-and-forget)
    try {
      await sendEmail({
        to:      target.email,
        subject: 'Your Deep Impression account has been deactivated',
        html:    `<p>Hi ${target.name},</p><p>Your Deep Impression account has been deactivated by an administrator. If you believe this is an error, please contact HR.</p>`,
      });
    } catch {
      console.error('[deactivate] Failed to send deactivation email to', target.email);
    }

    // Notify admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true, id: { not: user.id } }, select: { id: true } });
    await Promise.all(admins.map((a) =>
      createNotification(a.id, 'SYSTEM', `Account deactivated: ${target.name}`, `${target.name}'s account has been deactivated.`, '/hr'),
    ));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
