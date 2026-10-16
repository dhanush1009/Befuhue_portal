import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { hashPassword, verifyPassword, checkPasswordStrength } from '@/lib/passwordUtils';

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const body = await req.json() as { currentPassword?: string; newPassword?: string };
  const { currentPassword, newPassword } = body;

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }

  const { score } = checkPasswordStrength(newPassword);
  if (score < 2) {
    return NextResponse.json({ error: 'Password too weak. Add uppercase, numbers, or symbols.' }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, hashedPassword: true, mustChangePasswordOnLogin: true },
  });
  if (!dbUser) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  const existingHash = dbUser.passwordHash ?? dbUser.hashedPassword;

  // Settings mode: currentPassword required
  if (!dbUser.mustChangePasswordOnLogin) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
    }
    if (!existingHash) {
      return NextResponse.json({ error: 'No password set for this account.' }, { status: 400 });
    }
    const valid = await verifyPassword(currentPassword, existingHash);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }
  }

  const newHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash:              newHash,
      hashedPassword:            newHash,
      mustChangePasswordOnLogin: false,
      passwordChangedAt:         new Date(),
      passwordSetBy:             'SELF',
      tempPassword:              null,
    },
  });

  return NextResponse.json({ success: true });
}
