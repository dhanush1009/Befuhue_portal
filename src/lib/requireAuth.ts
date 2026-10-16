import { auth } from '@/lib/auth';
import { headers, cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import type { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id:          string;
  name:        string;
  role:        Role;
  managerId:   string | null;
  designation: string | null;
  department:  string | null;
  avatarUrl:   string | null;
  /** Set when an Admin is previewing the portal as this person ("View as"): they are read-only. */
  viewingAs?:  { adminId: string };
}

/** Cookie holding the id of the person an Admin is previewing the portal as. */
export const VIEW_AS_COOKIE = 'di-view-as';

/**
 * "View as": a real Admin can preview the portal exactly as another person sees it.
 * The cookie is only ever honoured for a signed-in Admin, and the middleware refuses
 * every write while it is set, so a preview can read but never change anything.
 */
async function resolveViewAs(adminId: string): Promise<AuthenticatedUser | null> {
  const targetId = cookies().get(VIEW_AS_COOKIE)?.value;
  if (!targetId || targetId === adminId) return null;
  const t = await prisma.user.findFirst({
    where:  { id: targetId, isActive: true },
    select: { id: true, name: true, role: true, managerId: true, designation: true, department: true, avatarUrl: true },
  });
  if (!t) return null;
  return {
    id: t.id, name: t.name, role: t.role, managerId: t.managerId,
    designation: t.designation, department: t.department, avatarUrl: t.avatarUrl,
    viewingAs: { adminId },
  };
}

/**
 * Asserts the request is authenticated and returns the typed user.
 * Returns null + a 401 NextResponse if not authenticated.
 *
 * Accepts either a browser session cookie, or an `Authorization: Bearer
 * <token>` header (a personal access token — see src/lib/apiTokens.ts) so
 * external clients like an MCP server can act as the token's owner.
 */
export async function requireAuth(): Promise<
  { user: AuthenticatedUser; error: null } |
  { user: null; error: NextResponse }
> {
  const authHeader = headers().get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const { resolveApiToken } = await import('@/lib/apiTokens');
    const user = await resolveApiToken(authHeader.slice(7).trim());
    if (!user) {
      return { user: null, error: NextResponse.json({ error: 'Invalid or revoked API token' }, { status: 401 }) };
    }
    return { user, error: null };
  }

  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = (session as any)?.user;
  if (!u?.id) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if ((u.role as Role) === 'ADMIN') {
    const previewed = await resolveViewAs(u.id as string);
    if (previewed) return { user: previewed, error: null };
  }
  return {
    user: {
      id:          u.id          as string,
      name:        u.name        as string ?? '',
      role:        u.role        as Role,
      managerId:   u.managerId   as string | null ?? null,
      designation: u.designation as string | null ?? null,
      department:  u.department  as string | null ?? null,
      avatarUrl:   u.avatarUrl   as string | null ?? null,
    },
    error: null,
  };
}
