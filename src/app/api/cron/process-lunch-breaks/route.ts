import { NextRequest, NextResponse } from 'next/server';
import { processDueLunchBreaks } from '@/lib/lunchBreak';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const processed = await processDueLunchBreaks();
    return NextResponse.json({ processed });
  } catch {
    return NextResponse.json({ error: 'Unable to process lunch breaks.' }, { status: 500 });
  }
}
