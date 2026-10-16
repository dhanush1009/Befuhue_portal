import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { getAllAgencies } from '@/lib/agencyBillingService';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  // Strict data security: Billing section is accessible ONLY to admins
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin authorization required' }, { status: 403 });
  }

  try {
    const agencies = await getAllAgencies();
    return NextResponse.json({ data: agencies });
  } catch (err) {
    console.error('Failed to fetch agency billing summaries:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
