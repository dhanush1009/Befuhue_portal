import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const notif = await prisma.notification.findUnique({ where: { id: params.id } });
    if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (notif.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.notification.update({
      where: { id: params.id },
      data:  { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
