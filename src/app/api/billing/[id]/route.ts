import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { getAgencyProjects } from '@/lib/agencyBillingService';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  // Strict backend security: only ADMIN can access billing information
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin authorization required' }, { status: 403 });
  }

  const { id } = params;

  try {
    const data = await getAgencyProjects(id);
    if (!data) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        agency: data.agency,
        projects: data.projects,
        // Backward-compat aliases for any legacy card or hook
        entity: {
          id: data.agency.id,
          name: data.agency.name,
          clientType: 'AGENCY',
          billingReference: data.agency.billingReference || `AGY-${data.agency.name.slice(0, 4).toUpperCase()}-REF`,
          currency: data.agency.currency,
        },
        summary: {
          totalProjects: data.agency.totalProjects,
          totalTasks: data.agency.totalTasks,
          completedTasks: data.agency.completedTasks,
          totalBilling: data.agency.totalBilling,
          currency: data.agency.currency,
        },
      },
    });
  } catch (err) {
    console.error('Failed to fetch agency projects:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
