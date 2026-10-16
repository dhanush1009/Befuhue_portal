import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

const voteSchema = z.object({
  optionIndex: z.number().int().min(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const body   = await req.json() as unknown;
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const poll = await prisma.poll.findUnique({
      where:   { id: params.id },
      include: { votes: { select: { userId: true, optionIndex: true } } },
    });
    if (!poll)          return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!poll.isActive) return NextResponse.json({ error: 'Poll is closed' }, { status: 409 });

    const options = poll.options as string[];
    if (parsed.data.optionIndex >= options.length) {
      return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
    }

    const alreadyVoted = poll.votes.some((v) => v.userId === user.id);
    if (alreadyVoted) return NextResponse.json({ error: 'Already voted' }, { status: 409 });

    await prisma.pollVote.create({
      data: { pollId: params.id, userId: user.id, optionIndex: parsed.data.optionIndex },
    });

    // Return updated results
    const allVotes  = [...poll.votes, { userId: user.id, optionIndex: parsed.data.optionIndex }];
    const voteCounts = options.map((_, i) => allVotes.filter((v) => v.optionIndex === i).length);

    return NextResponse.json({
      data: { hasVoted: true, voteCounts, totalVotes: allVotes.length },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
