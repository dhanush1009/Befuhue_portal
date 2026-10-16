import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { postBroadcast } from '@/lib/slack/mirror';

const createPollSchema = z.object({
  question:  z.string().min(1).max(500),
  options:   z.array(z.string().min(1)).min(2).max(8),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const polls = await prisma.poll.findMany({
      where:   { isActive: true },
      include: {
        votes:   { select: { userId: true, optionIndex: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take:    10,
    });

    // Attach hasVoted flag per current user
    const data = polls.map((p) => ({
      ...p,
      hasVoted:    p.votes.some((v) => v.userId === user.id),
      voteCounts:  (p.options as string[]).map((_, i) => p.votes.filter((v) => v.optionIndex === i).length),
      totalVotes:  p.votes.length,
    }));

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json() as unknown;
  const parsed = createPollSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const poll = await prisma.poll.create({
      data: {
        question:  parsed.data.question,
        options:   parsed.data.options,
        createdBy: user.id,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
      include: {
        votes:   { select: { userId: true, optionIndex: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // Notify all employees except the creator (fire-and-forget)
    prisma.user.findMany({ where: { isActive: true, id: { not: user.id } }, select: { id: true } })
      .then((users) => Promise.all(
        users.map((u) =>
          createNotification(
            u.id,
            'POLL_CREATED',
            'New poll: vote now!',
            parsed.data.question,
            '/communication',
          ),
        ),
      ))
      .catch(() => {});

    await postBroadcast('POLL_CREATED', 'New poll: vote now!', parsed.data.question, '/communication');

    return NextResponse.json({ data: { ...poll, hasVoted: false, voteCounts: (poll.options as string[]).map(() => 0), totalVotes: 0 } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
