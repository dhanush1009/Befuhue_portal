import { useSession } from 'next-auth/react';
import type { Role } from '@prisma/client';
import { useViewAsStore } from '@/store/useViewAsStore';

export function useAuth() {
  const { data: session, status } = useSession();
  const target = useViewAsStore((s) => s.target);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionUser = (session as any)?.user;

  const realRole = (sessionUser?.role as Role | undefined) ?? null;
  // An Admin previewing the portal as someone else sees that person's profile, role and data.
  const previewing = !!target && realRole === 'ADMIN';
  const user = sessionUser ? (previewing ? { ...sessionUser, ...target } : sessionUser) : null;
  const role = (user?.role as Role | undefined) ?? null;

  return {
    user,
    role,
    isLoading:       status === 'loading',
    isAuthenticated: status === 'authenticated',
    isAdmin:         role === 'ADMIN',
    /** The signed-in person's real role, ignoring any preview - use for the preview controls themselves. */
    realIsAdmin:     realRole === 'ADMIN',
    isPreviewing:    previewing,
  };
}

/** Effective role string for components that only had the raw session (reports pages). */
export function useEffectiveRole(): string | undefined {
  return useAuth().role ?? undefined;
}
