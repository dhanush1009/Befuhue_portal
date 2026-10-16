import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth.config';
import { prisma } from '@/lib/prisma';

const createQuoteSchema = z.object({
  text: z
    .string()
    .min(10, 'Quote must be at least 10 characters.')
    .max(300, 'Quote must be under 300 characters.'),
  author: z.string().max(100).optional().or(z.literal('')),
});

export async function GET() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const quotes = await prisma.quote.findMany({
      include: {
        addedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ data: quotes });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const existing = await prisma.quote.findFirst({
      where: { text: { equals: parsed.data.text, mode: 'insensitive' } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'This quote already exists in the system.' },
        { status: 409 },
      );
    }

    const quote = await prisma.quote.create({
      data: {
        text:      parsed.data.text,
        author:    parsed.data.author || null,
        isSystem:  false,
        isActive:  true,
        addedById: session!.user!.id,
      },
      include: {
        addedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ data: quote }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
