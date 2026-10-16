import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { IFSC_RE } from '@/lib/details/validation';

// Looks up the bank and branch for an IFSC code so people do not have to type them. IFSC codes are
// public, nothing about the person is sent. If the lookup fails the form just lets them type it.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const code = (req.nextUrl.searchParams.get('code') ?? '').trim().toUpperCase();
  if (!IFSC_RE.test(code)) return NextResponse.json({ error: 'Invalid IFSC' }, { status: 400 });

  try {
    const res = await fetch(`https://ifsc.razorpay.com/${code}`, { signal: AbortSignal.timeout(4000), next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json({ error: 'IFSC not found' }, { status: 404 });
    const j = await res.json() as { BANK?: string; BRANCH?: string; CITY?: string };
    return NextResponse.json({ data: { bank: j.BANK ?? '', branch: j.BRANCH ?? '', city: j.CITY ?? '' } });
  } catch {
    return NextResponse.json({ error: 'Lookup unavailable' }, { status: 502 });
  }
}
