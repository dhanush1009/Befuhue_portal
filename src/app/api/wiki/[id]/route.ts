import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import type { Prisma } from '@prisma/client';

const updateWikiSchema = z.object({
  title:    z.string().min(1).max(200).optional(),
  content:  z.record(z.string(), z.unknown()).optional(),
  category: z.string().min(1).max(100).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json() as unknown;
  const parsed = updateWikiSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const page = await prisma.wikiPage.update({
      where:   { id: params.id },
      data:    {
        title:    parsed.data.title,
        category: parsed.data.category,
        ...(parsed.data.content !== undefined
          ? { content: parsed.data.content as unknown as Prisma.InputJsonValue }
          : {}),
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Notify all employees except the editor (fire-and-forget)
    prisma.user.findMany({ where: { isActive: true, id: { not: user.id } }, select: { id: true } })
      .then((users) => Promise.all(
        users.map((u) =>
          createNotification(
            u.id,
            'WIKI_UPDATED',
            `Wiki updated: ${page.title}`,
            `The article "${page.title}" in the ${page.category} section was updated.`,
            '/communication',
          ),
        ),
      ))
      .catch(() => {});

    return NextResponse.json({ data: page });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
