import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

// Revoke one of the current user's own tokens.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const token = await prisma.apiToken.findUnique({ where: { id: params.id } });
    if (!token || token.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (token.revokedAt) {
      return NextResponse.json({ error: 'Already revoked' }, { status: 409 });
    }

    await prisma.apiToken.update({ where: { id: params.id }, data: { revokedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
