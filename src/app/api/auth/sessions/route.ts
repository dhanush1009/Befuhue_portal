import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  // Full multi-session tracking requires a sessions table (future work).
  // Return the current session as the only entry.
  return NextResponse.json({
    data: [
      {
        id:         user.id,
        device:     'Current browser',
        ip:         '—',
        lastActive: new Date().toISOString(),
        isCurrent:  true,
      },
    ],
  });
}
