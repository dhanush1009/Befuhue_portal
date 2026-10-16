import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { slackConfigured } from '@/lib/slack/api';

// Each person's own Slack switch: is it available, are they linked, and have they turned it off.
export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { slackUserId: true, slackMuted: true } });
  return NextResponse.json({ data: { available: slackConfigured(), linked: !!me?.slackUserId, muted: me?.slackMuted === true } });
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const parsed = z.object({ muted: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { slackMuted: parsed.data.muted } });
  return NextResponse.json({ data: { muted: parsed.data.muted } });
}
