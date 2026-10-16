import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const data = await prisma.user.findMany({
      select:  { id: true, name: true, avatarUrl: true, designation: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
