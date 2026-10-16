import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { leaveActionSchema } from '@/lib/validations/leave';
import { requireAuth } from '@/lib/requireAuth';
import { can } from '@/lib/permissions';

// ADMIN: approve or reject a leave
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (!can.approveLeave(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body   = await req.json() as unknown;
  const parsed = leaveActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const data = await prisma.leave.update({
      where: { id: params.id },
      data: {
        status:     parsed.data.status,
        remarks:    parsed.data.remarks,
        approvedBy: parsed.data.status === 'APPROVED' ? user.id : undefined,
        rejectedBy: parsed.data.status === 'REJECTED' ? user.id : undefined,
      },
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Employee: cancel own PENDING leave
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const leave = await prisma.leave.findUnique({ where: { id: params.id } });
    if (!leave) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (leave.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (leave.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only PENDING leaves can be cancelled' }, { status: 400 });
    }

    const data = await prisma.leave.update({
      where: { id: params.id },
      data:  { status: 'CANCELLED' },
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
