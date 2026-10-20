import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } },
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { avatarData: true, avatarUrl: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const rawData = user.avatarData || (user.avatarUrl?.startsWith('data:') ? user.avatarUrl : null);

    if (rawData) {
      let mimeType = 'image/jpeg';
      let base64Data = rawData;

      if (rawData.startsWith('data:')) {
        const matches = rawData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        } else {
          base64Data = rawData.replace(/^data:[^;]+;base64,/, '');
        }
      }

      const buffer = Buffer.from(base64Data, 'base64');

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    if (user.avatarUrl && !user.avatarUrl.startsWith('/api/avatar/')) {
      return NextResponse.redirect(user.avatarUrl);
    }

    return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
  } catch (err) {
    console.error('[avatar GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
