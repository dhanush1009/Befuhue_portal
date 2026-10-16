import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const doc = await prisma.document.findUnique({ where: { id: params.docId } });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Only the document owner or ADMIN can delete
    if (doc.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.document.delete({ where: { id: params.docId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
