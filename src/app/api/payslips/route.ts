import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const isAdmin = user.role === 'ADMIN';
  const { searchParams } = req.nextUrl;
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
  const year  = searchParams.get('year')  ? parseInt(searchParams.get('year')!)  : undefined;

  const where = {
    // Always scope to the logged-in user's own payslips.
    // Admins browsing ALL payslips use /api/admin/payroll routes, not this endpoint.
    userId: user.id as string,
    // Employees only see PUBLISHED; admins can see their own drafts too
    ...(!isAdmin ? { status: 'PUBLISHED' as const } : {}),
    ...(month !== undefined ? { month } : {}),
    ...(year  !== undefined ? { year  } : {}),
  };

  const payslips = await prisma.payslip.findMany({
    where,
    include: { user: { select: { id: true, name: true, avatarUrl: true, designation: true, department: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  return NextResponse.json({ data: payslips });
}
