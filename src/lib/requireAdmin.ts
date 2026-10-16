import { NextResponse } from 'next/server';
import { requireAuth, type AuthenticatedUser } from '@/lib/requireAuth';

/** requireAuth, plus: the caller must be an Admin (a "View as" preview is never an admin). */
export async function requireAdmin(): Promise<
  { user: AuthenticatedUser; error: null } | { user: null; error: NextResponse }
> {
  const auth = await requireAuth();
  if (auth.error) return auth;
  if (auth.user.role !== 'ADMIN') {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return auth;
}
