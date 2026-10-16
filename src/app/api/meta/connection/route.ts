import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { createAuditLog } from '@/lib/audit';
import { disconnect } from '@/lib/meta/connection';

// ── DELETE - forget the connected Meta login (admin) ──────────────────────────
// Stored data and account mappings stay; syncing simply pauses until Meta is connected again.

export async function DELETE() {
  const { user, error } = await requireAdmin();
  if (error) return error;
  try {
    const removed = await disconnect();
    if (removed) await createAuditLog(user.id, 'META_DISCONNECTED', 'meta', 'MetaConnection');
    return NextResponse.json({ success: true, removed });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
