import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function PATCH() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data:  { isRead: true },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
