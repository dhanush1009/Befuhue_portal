import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import type { Prisma } from '@prisma/client';
import { postBroadcast } from '@/lib/slack/mirror';

const AUTHOR_SELECT = { id: true, name: true, role: true, avatarUrl: true, designation: true };

const createSchema = z.object({
  title:         z.string().min(1).max(200),
  body:          z.record(z.string(), z.unknown()), // Tiptap JSON
  isPinned:      z.boolean().optional().default(false),
  attachmentUrl: z.string().url().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page')  ?? '1'));
  const limit = Math.min(20, parseInt(req.nextUrl.searchParams.get('limit') ?? '10'));

  try {
    const [data, total] = await prisma.$transaction([
      prisma.announcement.findMany({
        include: { author: { select: AUTHOR_SELECT } },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.announcement.count(),
    ]);
    return NextResponse.json({ data, total, page, limit });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json() as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const announcement = await prisma.announcement.create({
      data: {
        title:         parsed.data.title,
        body:          parsed.data.body as Prisma.InputJsonValue,
        authorId:      user.id,
        isPinned:      parsed.data.isPinned ?? false,
        attachmentUrl: parsed.data.attachmentUrl ?? null,
        reactions:     {} as Prisma.InputJsonValue,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    // Notify all employees (fire-and-forget)
    prisma.user.findMany({ select: { id: true } }).then((users) => {
      const others = users.filter((u) => u.id !== user.id);
      return Promise.all(
        others.map((u) =>
          createNotification(u.id, 'ANNOUNCEMENT', parsed.data.title,
            'A new announcement has been posted.', '/communication'),
        ),
      );
    }).catch(() => {});

    await postBroadcast('ANNOUNCEMENT', parsed.data.title, 'A new announcement has been posted.', '/communication');

    return NextResponse.json({ data: announcement }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
