import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  try {
    const report = await prisma.projectReport.findUnique({
      where: { id: params.id },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.projectReport.update({
      where: { id: params.id },
      data: {
        shareToken: token,
        shareExpiresAt: expiresAt,
        isPublic: true,
        status: 'SHARED',
      },
    });

    const origin =
      process.env.NEXTAUTH_URL ||
      req.nextUrl.origin ||
      'http://localhost:3000';
    const shareUrl = `${origin}/reports/shared/${token}`;

    return NextResponse.json({ data: { shareUrl, expiresAt } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate share link';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
