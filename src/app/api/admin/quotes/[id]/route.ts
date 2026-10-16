import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth.config';
import { prisma } from '@/lib/prisma';

const patchQuoteSchema = z.object({
  isActive: z.boolean().optional(),
  text:     z.string().min(10).max(300).optional(),
  author:   z.string().max(100).optional().or(z.literal('')),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });

  const body = await req.json();
  const parsed = patchQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // System quotes: only isActive can be toggled — text/author are immutable
  if (quote.isSystem && (parsed.data.text !== undefined || parsed.data.author !== undefined)) {
    return NextResponse.json(
      { error: 'System quotes cannot be edited. You can only activate or deactivate them.' },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.quote.update({
      where: { id },
      data: {
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        ...(!quote.isSystem && parsed.data.text !== undefined && { text: parsed.data.text }),
        ...(!quote.isSystem && parsed.data.author !== undefined && {
          author: parsed.data.author || null,
        }),
      },
      include: {
        addedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });

  if (quote.isSystem) {
    return NextResponse.json(
      { error: 'System quotes cannot be deleted. You can deactivate them instead.' },
      { status: 400 },
    );
  }

  try {
    await prisma.quote.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
