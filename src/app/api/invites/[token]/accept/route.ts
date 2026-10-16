import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { acceptInviteByToken } from '@/lib/invites';
import { createAuditLog } from '@/lib/audit';

const acceptSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }

  const body = await req.json() as unknown;
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updatedUser = await acceptInviteByToken(token, parsed.data.password);
    await createAuditLog(updatedUser.id, 'INVITE_ACCEPTED', updatedUser.id, 'Employee');

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully! You can now log in.',
      email:   updatedUser.email,
    });
  } catch (err: unknown) {
    const message = (err as Error)?.message;

    if (message === 'INVITE_NOT_FOUND') {
      return NextResponse.json({ error: 'Invalid or missing invitation.' }, { status: 404 });
    }
    if (message === 'INVITE_EXPIRED') {
      return NextResponse.json({ error: 'This invitation has expired. Contact your administrator.' }, { status: 410 });
    }
    if (message === 'INVITE_ALREADY_ACCEPTED') {
      return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 400 });
    }
    if (message === 'PASSWORD_TOO_SHORT') {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    console.error('[invites:accept] Unexpected error:', err);
    return NextResponse.json({ error: 'Failed to accept invitation. Please try again.' }, { status: 500 });
  }
}
