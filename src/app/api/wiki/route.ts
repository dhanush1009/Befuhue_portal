import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import type { Prisma } from '@prisma/client';
import { postBroadcast } from '@/lib/slack/mirror';

const createWikiSchema = z.object({
  title:    z.string().min(1).max(200),
  content:  z.record(z.string(), z.unknown()),
  category: z.string().min(1).max(100).default('General'),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const pages = await prisma.wikiPage.findMany({
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
    });
    return NextResponse.json({ data: pages });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json() as unknown;
  const parsed = createWikiSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const page = await prisma.wikiPage.create({
      data: { ...parsed.data, content: parsed.data.content as Prisma.InputJsonValue, authorId: user.id },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Notify all employees except the author (fire-and-forget)
    prisma.user.findMany({ where: { isActive: true, id: { not: user.id } }, select: { id: true } })
      .then((users) => Promise.all(
        users.map((u) =>
          createNotification(
            u.id,
            'WIKI_UPDATED',
            `New wiki article: ${page.title}`,
            `A new article "${page.title}" was added to the ${page.category} section.`,
            '/communication',
          ),
        ),
      ))
      .catch(() => {});

    await postBroadcast('WIKI_UPDATED', `New wiki article: ${page.title}`, `A new article "${page.title}" was added to the ${page.category} section.`, '/communication');

    return NextResponse.json({ data: page }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
