import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  // Self or ADMIN can view an employee's leave history
  const isSelf  = user.id === params.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page')  ?? '1'));
  const limit = Math.min(50,  parseInt(req.nextUrl.searchParams.get('limit') ?? '25'));

  try {
    const [data, total] = await prisma.$transaction([
      prisma.leave.findMany({
        where:   { userId: params.id },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.leave.count({ where: { userId: params.id } }),
    ]);
    return NextResponse.json({ data, total, page, limit });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
