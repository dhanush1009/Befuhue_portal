import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { MetaApiError } from '@/lib/meta/graph';
import { getGraph, isMetaConfigured } from '@/lib/meta/connection';
import { discoverAccounts } from '@/lib/meta/sync';

export const maxDuration = 60;

// ── POST - ask Meta which ad accounts the token can see (admin) ───────────────
// New accounts arrive switched off and unmapped; existing ones keep the admin's choices.

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;
  if (!(await isMetaConfigured())) return NextResponse.json({ error: 'Meta is not connected yet. Click Connect Meta first.', code: 'NOT_CONFIGURED' }, { status: 409 });

  try {
    return NextResponse.json({ data: await discoverAccounts(await getGraph()) });
  } catch (e) {
    if (e instanceof MetaApiError) return NextResponse.json({ error: e.message, code: e.isAuthError ? 'AUTH' : 'META' }, { status: 502 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
