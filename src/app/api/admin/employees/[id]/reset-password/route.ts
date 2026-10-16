import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { hashPassword, generateStrongPassword, checkPasswordStrength } from '@/lib/passwordUtils';
import { sendEmail } from '@/lib/mailer';
import { passwordResetEmailHtml, passwordResetEmailSubject } from '@/lib/emails/passwordReset';
import { createNotification } from '@/lib/notifications';

const resetSchema = z.object({
  passwordType:              z.enum(['AUTO', 'CUSTOM']),
  customPassword:            z.string().min(8).optional(),
  mustChangePasswordOnLogin: z.boolean().default(true),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden. Only admins can reset passwords.' }, { status: 403 });
  }

  if (params.id === user.id) {
    return NextResponse.json(
      { error: 'Use the Change Password option in Settings to update your own password.' },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where:  { id: params.id },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!target) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
  if (!target.isActive) {
    return NextResponse.json({ error: 'Cannot reset password for a deactivated account.' }, { status: 400 });
  }

  const body   = await req.json() as unknown;
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { passwordType, customPassword, mustChangePasswordOnLogin } = parsed.data;

  if (passwordType === 'CUSTOM') {
    if (!customPassword) {
      return NextResponse.json({ error: 'Custom password is required.' }, { status: 400 });
    }
    const { score } = checkPasswordStrength(customPassword);
    if (score < 2) {
      return NextResponse.json({ error: 'Password is too weak. Use a stronger password.' }, { status: 400 });
    }
  }

  const plainPassword = passwordType === 'AUTO' ? generateStrongPassword() : customPassword!;
  const newHash       = await hashPassword(plainPassword);

  // Fetch admin name for email
  const adminUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { name: true },
  });

  await prisma.user.update({
    where: { id: params.id },
    data: {
      passwordHash:              newHash,
      hashedPassword:            newHash,
      mustChangePasswordOnLogin,
      passwordChangedAt:         mustChangePasswordOnLogin ? null : new Date(),
      passwordSetBy:             'ADMIN',
      tempPassword:              mustChangePasswordOnLogin ? plainPassword : null,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId:    user.id,
      action:     'PASSWORD_RESET',
      targetId:   params.id,
      targetType: 'Employee',
      changes: {
        passwordType,
        mustChangePasswordOnLogin,
        resetBy:  adminUser?.name ?? user.id,
        resetAt:  new Date().toISOString(),
      },
    },
  });

  // In-app notification to the employee whose password was reset
  await createNotification(
    params.id,
    'SYSTEM',
    'Your password has been reset',
    `Your password was reset by ${adminUser?.name ?? 'an administrator'}. Please sign in with your new credentials.`,
    '/settings',
  );

  // Send email (fire-and-forget — don't fail the request if email fails)
  try {
    const loginUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000') + '/login';
    await sendEmail({
      to:      target.email,
      subject: passwordResetEmailSubject(),
      html:    passwordResetEmailHtml({
        name:        target.name,
        email:       target.email,
        newPassword: plainPassword,
        loginUrl,
        resetByName: adminUser?.name ?? 'Administrator',
        mustChange:  mustChangePasswordOnLogin,
      }),
    });
  } catch {
    console.error('[reset-password] Failed to send email to', target.email);
  }

  return NextResponse.json({
    success:      true,
    message:      `Password reset successfully. A new password has been sent to ${target.email}.`,
    plainPassword,
  });
}
