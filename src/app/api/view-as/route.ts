import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { VIEW_AS_COOKIE } from '@/lib/requireAuth';

// "View as": an Admin previews the portal exactly as another person sees it.
// Always checks the REAL signed-in user - a preview can never be used to escalate,
// and the middleware blocks every write request while the cookie is set.

async function realAdmin(): Promise<{ id: string; name: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = ((await auth()) as any)?.user;
  return u?.id && u.role === 'ADMIN' ? { id: u.id as string, name: (u.name as string) ?? '' } : null;
}

const SELECT = { id: true, name: true, email: true, role: true, designation: true, department: true, avatarUrl: true, managerId: true } as const;

// ── GET — who (if anyone) am I currently previewing as? ───────────────────────

export async function GET() {
  const admin = await realAdmin();
  if (!admin) return NextResponse.json({ data: { target: null } });

  const id = cookies().get(VIEW_AS_COOKIE)?.value;
  const target = id && id !== admin.id
    ? await prisma.user.findFirst({ where: { id, isActive: true }, select: SELECT })
    : null;
  return NextResponse.json({ data: { target } });
}

// ── POST — start previewing as someone ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await realAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = z.object({ userId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  if (parsed.data.userId === admin.id) return NextResponse.json({ error: 'Pick someone other than yourself.' }, { status: 400 });

  const target = await prisma.user.findFirst({ where: { id: parsed.data.userId, isActive: true }, select: SELECT });
  if (!target) return NextResponse.json({ error: 'That person was not found.' }, { status: 404 });

  await createAuditLog(admin.id, 'VIEW_AS_STARTED', target.id, 'Employee');

  const res = NextResponse.json({ data: { target } });
  res.cookies.set({
    name:     VIEW_AS_COOKIE,
    value:    target.id,
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    secure:   process.env.NODE_ENV === 'production',
  });
  return res;
}

// ── DELETE — back to being yourself ───────────────────────────────────────────

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set({ name: VIEW_AS_COOKIE, value: '', path: '/', maxAge: 0 });
  return res;
}
