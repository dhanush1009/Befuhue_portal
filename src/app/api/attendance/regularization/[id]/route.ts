import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = await (prisma as any).attendanceRegularization.findUnique({ where: { id } }) as { status: string; userId: string } | null;
  if (!request)                     return NextResponse.json({ error: 'Not found' },                        { status: 404 });
  if (request.userId !== user.id)   return NextResponse.json({ error: 'Forbidden' },                       { status: 403 });
  if (request.status !== 'PENDING') return NextResponse.json({ error: 'Only PENDING requests can be withdrawn.' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).attendanceRegularization.update({
    where: { id },
    data:  { status: 'WITHDRAWN' },
  });

  return NextResponse.json({ data: { success: true } });
}
