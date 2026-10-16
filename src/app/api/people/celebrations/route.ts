import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { nextOccurrence } from '@/lib/details/celebrations';

// For the dashboard. Admins get the next 14 days of birthdays and work anniversaries. Everyone else
// only gets what is happening TODAY (so the team can wish each other), and people can opt out of the
// birthday list. Only a day and month are ever sent, never the birth year.
const ADMIN_WINDOW_DAYS = 14;

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;
  const WINDOW_DAYS = user.role === 'ADMIN' ? ADMIN_WINDOW_DAYS : 0;

  const now = new Date();
  const users = await prisma.user.findMany({
    where:  { isActive: true },
    select: { id: true, name: true, avatarUrl: true, joiningDate: true, details: { select: { dateOfBirth: true, hideBirthday: true, preferredName: true } } },
  });

  const items: { userId: string; name: string; avatarUrl: string | null; type: 'BIRTHDAY' | 'ANNIVERSARY'; date: string; daysAway: number; years?: number }[] = [];
  for (const u of users) {
    const display = u.details?.preferredName?.trim() || u.name;
    const dob = u.details?.dateOfBirth;
    if (dob && (user.role === 'ADMIN' || !u.details?.hideBirthday)) {
      const n = nextOccurrence(dob, now);
      if (n.daysAway <= WINDOW_DAYS) items.push({ userId: u.id, name: display, avatarUrl: u.avatarUrl, type: 'BIRTHDAY', date: n.date, daysAway: n.daysAway });
    }
    if (u.joiningDate) {
      const n = nextOccurrence(u.joiningDate, now);
      const years = Number(n.date.slice(0, 4)) - u.joiningDate.getUTCFullYear();
      if (years >= 1 && n.daysAway <= WINDOW_DAYS) items.push({ userId: u.id, name: display, avatarUrl: u.avatarUrl, type: 'ANNIVERSARY', date: n.date, daysAway: n.daysAway, years });
    }
  }
  items.sort((x, y) => x.daysAway - y.daysAway || x.name.localeCompare(y.name));
  return NextResponse.json({ data: items });
}
