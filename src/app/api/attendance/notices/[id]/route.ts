import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { getISTDateString } from '@/lib/attendance';
import { dateKeyOf } from '@/lib/timeline';

// ── DELETE — cancel a heads-up ────────────────────────────────────────────────
// The owner can cancel one that's still ahead of them (or today); Admins can cancel any.

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const notice = await prisma.attendanceNotice.findUnique({ where: { id: params.id } });
    if (!notice || !notice.isActive) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner = notice.userId === user.id;
    if (!isOwner && user.role !== 'ADMIN') {
      // 404 rather than 403 — don't confirm that someone else's notice exists.
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (isOwner && user.role !== 'ADMIN' && dateKeyOf(notice.date) < getISTDateString()) {
      return NextResponse.json({ error: 'Past heads-ups are part of the attendance record and cannot be cancelled.' }, { status: 400 });
    }

    await prisma.attendanceNotice.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
