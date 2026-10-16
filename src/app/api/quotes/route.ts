import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const quotes = await prisma.quote.findMany({
      where: { isActive: true },
      select: { id: true, text: true, author: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data: quotes });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
