import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { handleBillingExport } from '@/lib/billingExportService';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  // Strict backend security: only ADMIN can export billing statements
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin authorization required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;
  const requestedFilename = searchParams.get('filename') || undefined;

  return handleBillingExport(params.id, {
    requestedFilename,
    status,
    search,
  });
}
