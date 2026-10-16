import type { Credential, CredentialAccess, Client } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from './crypto';
import { accessState, type AccessState } from './rules';

// Database side of the password vault. Nothing in here ever returns a username, password or note
// except `consumeAccess` (one viewing, used up) and `adminReveal` (audit-logged by the caller).

export interface CredentialMeta {
  id: string; clientId: string; brand: string; brandLogo: string | null;
  service: string; domain: string | null; label: string | null; loginUrl: string | null; createdAt: string;
}

export const toMeta = (c: Credential & { client: Pick<Client, 'name' | 'logoUrl'> }): CredentialMeta => ({
  id: c.id, clientId: c.clientId, brand: c.client.name, brandLogo: c.client.logoUrl,
  service: c.service, domain: c.domain, label: c.label, loginUrl: c.loginUrl, createdAt: c.createdAt.toISOString(),
});

export interface MyAccess { requestId: string; state: AccessState; expiresAt: string | null; taskId: string | null }

/** For one person: the most recent request they made per entry, as it stands right now. */
export async function accessFor(userId: string, credentialIds: string[]): Promise<Record<string, MyAccess>> {
  if (credentialIds.length === 0) return {};
  const rows = await prisma.credentialAccess.findMany({
    where: { requesterId: userId, credentialId: { in: credentialIds } },
    orderBy: { createdAt: 'desc' },
  });
  const now = new Date();
  const out: Record<string, MyAccess> = {};
  for (const r of rows) {
    const state = accessState(r, now);
    const prev = out[r.credentialId];
    // A usable (READY) request always wins over older/newer finished ones; otherwise the newest request is shown.
    if (!prev || (state === 'READY' && prev.state !== 'READY')) {
      out[r.credentialId] = { requestId: r.id, state, expiresAt: r.expiresAt?.toISOString() ?? null, taskId: r.taskId };
    }
  }
  return out;
}

export type RevealResult =
  | { ok: true; secrets: { username: string; password: string; notes: string | null; loginUrl: string | null; service: string; domain: string | null } }
  | { ok: false; reason: 'not_found' | 'no_access' | 'used' | 'expired' | 'pending' | 'denied' | 'unreadable' };

const open = (c: Credential, username: string, password: string, notes: string | null) => ({
  username, password, notes, loginUrl: c.loginUrl, service: c.service, domain: c.domain,
});

function decryptAll(c: Credential) {
  return open(c, decryptSecret(c.usernameEnc), decryptSecret(c.passwordEnc), c.notesEnc ? decryptSecret(c.notesEnc) : null);
}

/** An admin looking at an entry directly (the caller writes the audit entry). */
export async function adminReveal(credentialId: string): Promise<RevealResult> {
  const c = await prisma.credential.findUnique({ where: { id: credentialId } });
  if (!c) return { ok: false, reason: 'not_found' };
  try { return { ok: true, secrets: decryptAll(c) }; } catch { return { ok: false, reason: 'unreadable' }; }
}

/**
 * Uses up one approved viewing. The status change happens in a single conditional update, so two
 * clicks (or two tabs) can never both get the password: only the first one finds it still APPROVED.
 */
export async function consumeAccess(credentialId: string, requestId: string, userId: string): Promise<RevealResult> {
  const c = await prisma.credential.findUnique({ where: { id: credentialId } });
  if (!c) return { ok: false, reason: 'not_found' };

  const now = new Date();
  const claimed = await prisma.credentialAccess.updateMany({
    where: { id: requestId, credentialId, requesterId: userId, status: 'APPROVED', expiresAt: { gt: now } },
    data:  { status: 'USED', usedAt: now },
  });
  if (claimed.count !== 1) {
    const r: CredentialAccess | null = await prisma.credentialAccess.findUnique({ where: { id: requestId } });
    if (!r || r.requesterId !== userId || r.credentialId !== credentialId) return { ok: false, reason: 'no_access' };
    const s = accessState(r, now);
    return { ok: false, reason: s === 'USED' ? 'used' : s === 'EXPIRED' ? 'expired' : s === 'PENDING' ? 'pending' : s === 'DENIED' ? 'denied' : 'no_access' };
  }
  try {
    return { ok: true, secrets: decryptAll(c) };
  } catch {
    // The entry cannot be read (the key changed), so do not burn their approval.
    await prisma.credentialAccess.update({ where: { id: requestId }, data: { status: 'APPROVED', usedAt: null } });
    return { ok: false, reason: 'unreadable' };
  }
}

export const REVEAL_MESSAGES: Record<Exclude<RevealResult, { ok: true }>['reason'], string> = {
  not_found: 'That entry no longer exists.',
  no_access: 'You do not have approved access to this entry. Request access first.',
  used: 'This one-time view has already been used. Request access again if you still need it.',
  expired: 'This approval has expired. Request access again if you still need it.',
  pending: 'This request has not been approved yet.',
  denied: 'This request was denied.',
  unreadable: 'This entry cannot be read right now. Ask an admin to save it again.',
};
