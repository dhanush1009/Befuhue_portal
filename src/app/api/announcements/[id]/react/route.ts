import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

const reactSchema = z.object({
  reaction: z.enum(['thumbsup', 'clap', 'heart']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const body   = await req.json() as unknown;
  const parsed = reactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const announcement = await prisma.announcement.findUnique({ where: { id: params.id } });
    if (!announcement) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const reactions = (announcement.reactions as Record<string, string[]>) ?? {};
    const key       = parsed.data.reaction;
    const current   = reactions[key] ?? [];

    // Toggle: add if not present, remove if already reacted
    reactions[key] = current.includes(user.id)
      ? current.filter((id) => id !== user.id)
      : [...current, user.id];

    const updated = await prisma.announcement.update({
      where: { id: params.id },
      data:  { reactions },
      include: { author: { select: { id: true, name: true, role: true, avatarUrl: true, designation: true } } },
    });

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
