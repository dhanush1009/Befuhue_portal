import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

/**
 * Root page — middleware already blocks unauthenticated access.
 * If we reach here the user IS authenticated, so send them to dashboard.
 * If auth() somehow fails, redirect to login as fallback.
 */
export default async function RootPage() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await auth() as any;
    if (session?.user?.id) {
      redirect('/dashboard');
    }
  } catch {
    // fall through
  }
  redirect('/login');
}
