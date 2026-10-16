import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createAuditLog } from '@/lib/audit';
import { sendEmail } from '@/lib/mailer';
import { createInvitePayload } from '@/lib/invites';
import { inviteEmployeeEmailHtml, inviteEmployeeEmailSubject } from '@/lib/emails/inviteEmployee';
import type { Role } from '@prisma/client';

const sendInviteSchema = z.object({
  firstName:      z.string().min(1, 'First name is required').trim(),
  lastName:       z.string().min(1, 'Last name is required').trim(),
  email:          z.string().email('Valid work email is required').toLowerCase().trim(),
  role:           z.enum(['ADMIN', 'EMPLOYEE', 'MANAGER']).default('EMPLOYEE'),
  department:     z.string().optional().nullable(),
  designation:    z.string().optional().nullable(),
  phone:          z.string().optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']).default('FULL_TIME'),
  joiningDate:    z.string().optional().nullable(),
  managerId:      z.string().optional().nullable(),
});

function getBaseUrl(req: NextRequest): string {
  // 1. Explicitly configured production APP_URL
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }

  // 2. If NEXTAUTH_URL is configured with a production domain (not localhost)
  if (
    process.env.NEXTAUTH_URL &&
    !process.env.NEXTAUTH_URL.includes('localhost') &&
    !process.env.NEXTAUTH_URL.includes('127.0.0.1')
  ) {
    return process.env.NEXTAUTH_URL.replace(/\/+$/, '');
  }

  // 3. Vercel automatic deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  }

  // 4. Derive dynamically from the actual incoming request headers (detects live domain on any host)
  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost || req.headers.get('host');
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  // 5. Fallback for local development
  return (process.env.NEXTAUTH_URL || req.nextUrl?.origin || 'http://localhost:3000').replace(/\/+$/, '');
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = sendInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    firstName,
    lastName,
    email,
    role,
    department,
    designation,
    phone,
    employmentType,
    joiningDate,
    managerId,
  } = parsed.data;

  const fullName = `${firstName} ${lastName}`.trim();

  // Validate manager if specified
  if (managerId) {
    const mgr = await prisma.user.findUnique({ where: { id: managerId } });
    if (!mgr) return NextResponse.json({ error: 'Manager not found.' }, { status: 400 });
  }

  // Check if an account already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.isActive && (existing.passwordHash || existing.hashedPassword)) {
    return NextResponse.json(
      { error: 'An active employee with this email already exists in the workspace.' },
      { status: 409 },
    );
  }

  const { token, expiresAt, tempPassword } = createInvitePayload(7);
  const baseUrl = getBaseUrl(req);
  const acceptUrl = `${baseUrl}/accept-invite/${token}`;

  try {
    let targetUser;

    if (existing) {
      // Re-issue invite for existing inactive / pending employee
      targetUser = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name:                      fullName,
          role:                      role as Role,
          department:                department ?? existing.department,
          designation:               designation ?? existing.designation,
          phone:                     phone ?? existing.phone,
          employmentType:            employmentType ?? existing.employmentType,
          joiningDate:               joiningDate ? new Date(joiningDate) : existing.joiningDate,
          managerId:                 managerId ?? existing.managerId,
          isActive:                  false,
          tempPassword,
          passwordSetBy:             'INVITE',
          mustChangePasswordOnLogin: false,
        },
      });
    } else {
      // Create new inactive user record awaiting invitation acceptance
      targetUser = await prisma.user.create({
        data: {
          email,
          name:                      fullName,
          role:                      role as Role,
          department:                department ?? null,
          designation:               designation ?? null,
          phone:                     phone ?? null,
          employmentType:            employmentType ?? 'FULL_TIME',
          joiningDate:               joiningDate ? new Date(joiningDate) : null,
          managerId:                 managerId ?? null,
          isActive:                  false,
          tempPassword,
          passwordSetBy:             'INVITE',
          mustChangePasswordOnLogin: false,
          hashedPassword:            null,
          passwordHash:              null,
        },
      });
    }

    await createAuditLog(user.id, 'EMPLOYEE_INVITED', targetUser.id, 'Employee');

    // Send the email with the invitation link via Nodemailer
    let mailResult: { success: boolean; messageId?: string; previewUrl?: string | null } | null = null;
    let emailError: string | null = null;
    try {
      mailResult = await sendEmail({
        to:      email,
        subject: inviteEmployeeEmailSubject,
        html:    inviteEmployeeEmailHtml({
          name:          fullName,
          email,
          role,
          department:    department ?? null,
          acceptUrl,
          expiresInDays: 7,
        }),
      });
    } catch (mailErr: unknown) {
      emailError = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.error('[invites] Nodemailer email dispatch failed:', mailErr);
    }

    return NextResponse.json(
      {
        success:         true,
        message:         `Invitation created for ${email}`,
        inviteUrl:       acceptUrl,
        emailSent:       mailResult?.success ?? false,
        emailError,
        emailPreviewUrl: mailResult?.previewUrl ?? null,
        token,
        email,
        name:            fullName,
        expiresAt:       expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[invites:send] Error creating invite:', err);
    return NextResponse.json({ error: 'Internal server error while creating invite.' }, { status: 500 });
  }
}
