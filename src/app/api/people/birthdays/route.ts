import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { nextOccurrence } from '@/lib/details/celebrations';

// Admin only: every birthday and work anniversary over the coming year, plus who has not given a date
// of birth yet. People who hid their birthday from the team still show up here.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const now = new Date();
  const users = await prisma.user.findMany({
    where:  { isActive: true },
    select: {
      id: true, name: true, avatarUrl: true, designation: true, department: true, joiningDate: true,
      details: { select: { dateOfBirth: true, hideBirthday: true } },
    },
  });

  const birthdays: { userId: string; name: string; avatarUrl: string | null; designation: string | null; department: string | null; date: string; daysAway: number; turns: number; hidden: boolean }[] = [];
  const anniversaries: { userId: string; name: string; avatarUrl: string | null; designation: string | null; date: string; daysAway: number; years: number }[] = [];
  const missing: { userId: string; name: string }[] = [];

  for (const u of users) {
    const dob = u.details?.dateOfBirth;
    if (dob) {
      const n = nextOccurrence(dob, now);
      birthdays.push({
        userId: u.id, name: u.name, avatarUrl: u.avatarUrl, designation: u.designation, department: u.department,
        date: n.date, daysAway: n.daysAway, turns: Number(n.date.slice(0, 4)) - dob.getUTCFullYear(), hidden: !!u.details?.hideBirthday,
      });
    } else {
      missing.push({ userId: u.id, name: u.name });
    }
    if (u.joiningDate) {
      const n = nextOccurrence(u.joiningDate, now);
      const years = Number(n.date.slice(0, 4)) - u.joiningDate.getUTCFullYear();
      if (years >= 1) anniversaries.push({ userId: u.id, name: u.name, avatarUrl: u.avatarUrl, designation: u.designation, date: n.date, daysAway: n.daysAway, years });
    }
  }
  birthdays.sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name));
  anniversaries.sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name));
  return NextResponse.json({ data: { birthdays, anniversaries, missing } });
}
