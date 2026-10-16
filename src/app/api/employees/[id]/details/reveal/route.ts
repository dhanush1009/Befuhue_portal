import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createAuditLog } from '@/lib/audit';
import { decryptField } from '@/lib/details/secure';
import { SECRET_KEYS, secretEncColumn, secretLabel, type SecretKey } from '@/lib/details/service';

// Shows one hidden number (bank account, PAN, Aadhaar, UAN) in full. The person can always look at
// their own; an Admin looking at someone else's is written to the audit log every time.
// This is a POST on purpose: it never gets cached, and "View as" previews cannot call it.

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;
  if (user.id !== params.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { field?: string };
  const field = body.field as SecretKey;
  if (!SECRET_KEYS.includes(field)) return NextResponse.json({ error: 'Unknown field' }, { status: 400 });

  const row = await prisma.employeeDetails.findUnique({ where: { userId: params.id } });
  const stored = row?.[secretEncColumn(field)];
  if (!stored) return NextResponse.json({ data: { value: null } });

  let value: string;
  try { value = decryptField(stored); } catch {
    return NextResponse.json({ error: 'This value can no longer be read. Please ask the employee to enter it again.' }, { status: 409 });
  }

  if (user.id !== params.id) await createAuditLog(user.id, 'DETAILS_REVEALED', params.id, 'EmployeeDetails', { [secretLabel(field)]: { before: 'hidden', after: 'viewed' } });
  return NextResponse.json({ data: { value } }, { headers: { 'Cache-Control': 'no-store' } });
}
