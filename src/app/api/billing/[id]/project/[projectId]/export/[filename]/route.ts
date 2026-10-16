import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { handleProjectBillingExport } from '@/lib/billingExportService';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; projectId: string; filename: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin authorization required' }, { status: 403 });
  }

  const { id, projectId, filename } = params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;

  return handleProjectBillingExport(id, projectId, {
    status,
    search,
    requestedFilename: filename,
  });
}
