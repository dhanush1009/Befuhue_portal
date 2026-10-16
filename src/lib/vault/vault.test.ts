import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto';
import { accessState, canAttachToTask, canDecide, canManageCredential, createCredentialSchema, decideSchema, normalizeDomain, requestAccessSchema, updateCredentialSchema, windowEnd } from './rules';
import { checkRequestedDate, createJoiningRequestSchema, istDay } from '../joiningDate';

describe('vault encryption', () => {
  it('round-trips and never stores the plain value', () => {
    const enc = encryptSecret('P@ssw0rd!', 'k1');
    expect(enc).not.toContain('P@ssw0rd');
    expect(decryptSecret(enc, 'k1')).toBe('P@ssw0rd!');
  });
  it('gives a different ciphertext each time for the same password', () => {
    expect(encryptSecret('same', 'k1')).not.toBe(encryptSecret('same', 'k1'));
  });
  it('cannot be read with another key or after tampering', () => {
    const enc = encryptSecret('secret', 'k1');
    expect(() => decryptSecret(enc, 'k2')).toThrow();
    const parts = enc.split('.'); parts[3] = Buffer.from('x').toString('base64url');
    expect(() => decryptSecret(parts.join('.'), 'k1')).toThrow();
  });
  it('keeps vault keys separate from the HR-details key (same secret, different data)', async () => {
    const { encryptField, decryptField } = await import('../details/secure');
    const hr = encryptField('abc', 'same-secret');
    expect(() => decryptSecret(hr, 'same-secret')).toThrow();
    expect(decryptField(hr, 'same-secret')).toBe('abc');
  });
});

describe('domains', () => {
  it('normalises whatever was pasted', () => {
    expect(normalizeDomain('https://www.Hostinger.com/panel?x=1')).toBe('hostinger.com');
    expect(normalizeDomain('hpanel.hostinger.com:8443')).toBe('hpanel.hostinger.com');
    expect(normalizeDomain('  ')).toBeNull();
  });
});

describe('creating an entry', () => {
  const ok = { clientId: 'c1', service: 'Hostinger', domain: 'https://hostinger.com', username: 'admin@x.in', password: 'pw' };
  it('accepts a normal entry and cleans the domain', () => {
    const v = createCredentialSchema.parse(ok);
    expect(v.domain).toBe('hostinger.com');
  });
  it('needs a brand, service, username and password', () => {
    for (const k of ['clientId', 'service', 'username', 'password'] as const) {
      expect(createCredentialSchema.safeParse({ ...ok, [k]: '' }).success).toBe(false);
    }
  });
  it('rejects a bad domain or login link', () => {
    expect(createCredentialSchema.safeParse({ ...ok, domain: 'not a domain' }).success).toBe(false);
    expect(createCredentialSchema.safeParse({ ...ok, loginUrl: 'javascript:alert(1)' }).success).toBe(false);
  });
  it('on edit, leaves the secrets alone unless they are sent', () => {
    const v = updateCredentialSchema.parse({ service: 'Hostinger VPS' });
    expect(v.username).toBeUndefined();
    expect(v.password).toBeUndefined();
  });
});

describe('requests', () => {
  it('needs a real reason', () => {
    expect(requestAccessSchema.safeParse({ reason: 'hi' }).success).toBe(false);
    expect(requestAccessSchema.safeParse({ reason: 'Deploying the backbone site' }).success).toBe(true);
  });
  it('only allows 1, 4 or 24 hour windows', () => {
    expect(decideSchema.safeParse({ decision: 'APPROVE', hours: 4 }).success).toBe(true);
    expect(decideSchema.safeParse({ decision: 'APPROVE', hours: 100 }).success).toBe(false);
    expect(decideSchema.safeParse({ decision: 'MAYBE' }).success).toBe(false);
  });
  const now = new Date('2026-10-13T10:00:00Z');
  it('an approval is only usable while its window is open', () => {
    expect(accessState({ status: 'APPROVED', expiresAt: windowEnd(now, 4) }, now)).toBe('READY');
    expect(accessState({ status: 'APPROVED', expiresAt: new Date(now.getTime() - 1) }, now)).toBe('EXPIRED');
    expect(accessState({ status: 'APPROVED', expiresAt: null }, now)).toBe('EXPIRED');
    expect(accessState({ status: 'USED', expiresAt: windowEnd(now, 4) }, now)).toBe('USED');
    expect(accessState({ status: 'PENDING', expiresAt: null }, now)).toBe('PENDING');
  });
  it('an admin cannot approve their own request', () => {
    expect(canDecide('a1', 'a1')).toBe(false);
    expect(canDecide('a2', 'a1')).toBe(true);
  });
  it('anyone can add a login but only its creator or an admin can change it', () => {
    expect(canManageCredential('e1', false, 'e1')).toBe(true);
    expect(canManageCredential('e2', false, 'e1')).toBe(false);
    expect(canManageCredential('a1', true, 'e1')).toBe(true);
  });
  it('only admins, the creator and the assignee may attach to a task', () => {
    const t = { reporterId: 'r', assigneeId: 'a' };
    expect(canAttachToTask(t, 'r', false)).toBe(true);
    expect(canAttachToTask(t, 'a', false)).toBe(true);
    expect(canAttachToTask(t, 'x', false)).toBe(false);
    expect(canAttachToTask(t, 'x', true)).toBe(true);
  });
});

describe('joining date requests', () => {
  const now = new Date('2026-10-13T10:00:00Z');
  const current = new Date('2025-03-10T12:00:00Z');
  it('accepts an earlier date', () => { expect(checkRequestedDate('2025-03-01', current, now)).toBeNull(); });
  it('rejects a future date, an unchanged date and a date before 2000', () => {
    expect(checkRequestedDate('2026-12-01', current, now)).toMatch(/future/);
    expect(checkRequestedDate('2025-03-10', current, now)).toMatch(/already/);
    expect(checkRequestedDate('1999-12-31', current, now)).toMatch(/past/);
  });
  it('counts "today" in India time', () => {
    expect(istDay(new Date('2026-10-13T20:00:00Z'))).toBe('2026-10-14');
    expect(checkRequestedDate('2026-10-14', current, new Date('2026-10-13T20:00:00Z'))).toBeNull();
  });
  it('needs a reason', () => {
    expect(createJoiningRequestSchema.safeParse({ requestedDate: '2025-03-01', reason: 'x' }).success).toBe(false);
    expect(createJoiningRequestSchema.safeParse({ requestedDate: 'soon', reason: 'Offer letter says March' }).success).toBe(false);
  });
});
