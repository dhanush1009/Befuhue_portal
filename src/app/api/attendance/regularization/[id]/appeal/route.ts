import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { requireAuth } from '@/lib/requireAuth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = await (prisma as any).attendanceRegularization.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  }) as { status: string; userId: string; date: Date; user: { name: string } } | null;

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (request.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (request.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Only reviewer-rejected requests can be appealed.' }, { status: 400 });
  }

  // Notify all admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });

  for (const admin of admins) {
    await createNotification(
      admin.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'REGULARIZATION_APPEAL' as any,
      `${request.user.name} is appealing a rejected regularization request`,
      `For ${format(request.date, 'dd MMM yyyy')} — originally rejected by reviewer`,
      '/approvals?tab=regularization',
    );
  }

  return NextResponse.json({ data: { success: true } });
}
