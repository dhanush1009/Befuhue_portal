import { NextRequest, NextResponse } from 'next/server';
import { getInviteByToken } from '@/lib/invites';

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }

  const result = await getInviteByToken(token);
  if (!result) {
    return NextResponse.json({ error: 'Invitation not found or invalid token.' }, { status: 404 });
  }

  if (result.isAlreadyActive) {
    return NextResponse.json(
      {
        error:           'This invitation has already been accepted.',
        alreadyAccepted: true,
        email:           result.user.email,
      },
      { status: 400 },
    );
  }

  if (result.isExpired) {
    return NextResponse.json(
      {
        error:     'This invitation link has expired. Please ask your administrator to send a new invite.',
        isExpired: true,
      },
      { status: 410 },
    );
  }

  return NextResponse.json({
    valid:       true,
    name:        result.user.name,
    email:       result.user.email,
    role:        result.user.role,
    department:  result.user.department,
    designation: result.user.designation,
    expiresAt:   result.expiresAt.toISOString(),
  });
}
