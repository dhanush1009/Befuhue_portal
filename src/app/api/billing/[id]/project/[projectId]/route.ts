import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { getProjectBillingDetail } from '@/lib/agencyBillingService';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; projectId: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  // Strict backend security: only ADMIN can access project billing information
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin authorization required' }, { status: 403 });
  }

  const { id, projectId } = params;

  try {
    const detail = await getProjectBillingDetail(id, projectId);
    if (!detail) {
      return NextResponse.json({ error: 'Project billing details not found' }, { status: 404 });
    }

    return NextResponse.json({ data: detail });
  } catch (err) {
    console.error('Failed to fetch project billing details:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
