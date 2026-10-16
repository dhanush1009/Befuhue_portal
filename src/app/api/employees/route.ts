import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createEmployeeSchema } from '@/lib/validations/employee';
import { createNotification } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit';
import { sendEmail } from '@/lib/mailer';
import { welcomeEmployeeEmailHtml, welcomeEmployeeEmailSubject } from '@/lib/emails/welcomeEmployee';
import { generateStrongPassword, hashPassword, checkPasswordStrength } from '@/lib/passwordUtils';

const EMPLOYEE_SELECT = {
  id: true, name: true, email: true, role: true,
  department: true, designation: true, phone: true,
  avatarUrl: true, managerId: true, isActive: true,
  employmentType: true, createdAt: true, joiningDate: true,
  tempPassword: true, passwordSetBy: true,
  manager: { select: { id: true, name: true, avatarUrl: true } },
  _count:  { select: { leaves: true, tasks: true } },
};

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const sp           = req.nextUrl.searchParams;
  const search       = sp.get('search')       ?? undefined;
  const department   = sp.get('department')   ?? undefined;
  const showInactive = sp.get('showInactive') === 'true';
  const page         = Math.max(1, parseInt(sp.get('page')  ?? '1'));
  const limit        = Math.min(100, parseInt(sp.get('limit') ?? '25'));

  const where = {
    // By default exclude soft-deleted employees unless showInactive=true
    ...(showInactive ? {} : { isActive: true }),
    ...(search ? {
      OR: [
        { name:        { contains: search, mode: 'insensitive' as const } },
        { email:       { contains: search, mode: 'insensitive' as const } },
        { designation: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(department ? { department } : {}),
  };

  try {
    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select:  EMPLOYEE_SELECT,
        orderBy: { name: 'asc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.user.count({ where }),
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
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const {
    firstName, lastName, email, designation, department, role, managerId, phone, employmentType,
    joiningDate, consoleAccess, passwordType, customPassword, mustChangePasswordOnLogin,
  } = parsed.data;
  const fullName = `${firstName} ${lastName}`;

  // Resolve password
  let plainPassword: string | null = null;
  let resolvedHash:  string | null = null;

  if (consoleAccess) {
    if (passwordType === 'CUSTOM') {
      if (!customPassword) return NextResponse.json({ error: 'Custom password is required.' }, { status: 400 });
      const { score } = checkPasswordStrength(customPassword);
      if (score < 2) return NextResponse.json({ error: 'Password too weak. Use uppercase, numbers, and symbols.' }, { status: 400 });
      plainPassword = customPassword;
    } else {
      plainPassword = generateStrongPassword();
    }
    resolvedHash = await hashPassword(plainPassword);
  }

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

  // Validate managerId if provided
  if (managerId) {
    const mgr = await prisma.user.findUnique({ where: { id: managerId } });
    if (!mgr) return NextResponse.json({ error: 'Manager not found' }, { status: 400 });
  }

  try {
    const forceChange = consoleAccess ? (mustChangePasswordOnLogin ?? true) : false;

    const employee = await prisma.user.create({
      data: {
        name:                      fullName,
        email,
        hashedPassword:            resolvedHash,
        passwordHash:              resolvedHash,
        mustChangePasswordOnLogin: forceChange,
        passwordSetBy:             consoleAccess ? 'ADMIN' : null,
        tempPassword:              (consoleAccess && forceChange) ? plainPassword : null,
        role,
        designation,
        department,
        managerId:      managerId ?? null,
        phone:          phone ?? null,
        employmentType: employmentType ?? 'FULL_TIME',
        joiningDate:    joiningDate ? new Date(joiningDate) : null,
        isActive:       true,
      },
      select: EMPLOYEE_SELECT,
    });

    await createAuditLog(user.id, 'EMPLOYEE_CREATED', employee.id, 'Employee');

    const notifyUsers = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true, id: { not: user.id } },
      select: { id: true },
    });
    await Promise.all(
      notifyUsers.map((u) =>
        createNotification(u.id, 'SYSTEM',
          `New employee joined: ${fullName}`,
          `${fullName} has joined the ${department} team.`,
          `/hr/${employee.id}`,
        ),
      ),
    );

    // Welcome email with credentials (fire-and-forget)
    if (consoleAccess && plainPassword) {
      const loginUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      try {
        await sendEmail({
          to:      email,
          subject: welcomeEmployeeEmailSubject,
          html:    welcomeEmployeeEmailHtml({
            name:       fullName,
            email,
            password:   plainPassword,
            loginUrl:   `${loginUrl}/login`,
            mustChange: forceChange,
          }),
        });
      } catch {
        console.error('[onboard] Failed to send welcome email to', email);
      }
    }

    return NextResponse.json({ data: employee }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
