import { describe, expect, it } from 'vitest';
import { decryptField, encryptField, last4, maskedFrom } from './secure';
import { adminDetailsSchema, employeeDetailsSchema, isValidAadhaar, isValidPhone } from './validation';
import { buildUpdate, completeness, forCreate, forUpdate, toClientDetails } from './service';
import { nextOccurrence } from './celebrations';

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-for-details-testing';

// Builds a valid 12-digit Aadhaar by appending the Verhoeff check digit, so the test needs no real number.
const D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0],
];
const P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];
const INV = [0,4,3,2,1,5,6,7,8,9];
function withCheckDigit(first11: string): string {
  let c = 0;
  [...first11].reverse().forEach((ch, i) => { c = D[c][P[(i + 1) % 8][Number(ch)]]; });
  return first11 + INV[c];
}

describe('secure fields', () => {
  it('round-trips and never stores the plain value', () => {
    const enc = encryptField('123456789012', 'secret-a');
    expect(enc).not.toContain('123456789012');
    expect(decryptField(enc, 'secret-a')).toBe('123456789012');
  });
  it('cannot be read with a different secret or after tampering', () => {
    const enc = encryptField('ABCDE1234F', 'secret-a');
    expect(() => decryptField(enc, 'secret-b')).toThrow();
    const parts = enc.split('.'); parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptField(parts.join('.'), 'secret-a')).toThrow();
  });
  it('masks to the last four characters', () => {
    expect(last4('123456789012')).toBe('9012');
    expect(maskedFrom('9012', 12)).toBe('XXXXXXXX9012');
    expect(maskedFrom(null, 12)).toBeNull();
  });
});

describe('validation', () => {
  it('checks the Aadhaar check digit', () => {
    const good = withCheckDigit('23456789012');
    expect(isValidAadhaar(good)).toBe(true);
    const bad = good.slice(0, 11) + ((Number(good[11]) + 1) % 10);
    expect(isValidAadhaar(bad)).toBe(false);
    expect(isValidAadhaar('123456789012')).toBe(false); // cannot start with 1
  });
  it('accepts normal Indian mobile formats only', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('+91 98765 43210')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
  });
  it('normalises and validates PAN, IFSC and the account number', () => {
    const ok = employeeDetailsSchema.parse({ pan: 'abcde 1234 f', ifsc: 'hdfc0001234', bankAccount: '123 456 789 0', bankAccountConfirm: '1234567890' });
    expect(ok.pan).toBe('ABCDE1234F');
    expect(ok.ifsc).toBe('HDFC0001234');
    expect(ok.bankAccount).toBe('1234567890');
    expect(employeeDetailsSchema.safeParse({ pan: 'ABCDE12345' }).success).toBe(false);
    expect(employeeDetailsSchema.safeParse({ ifsc: 'HDFC1001234' }).success).toBe(false);
  });
  it('requires the account number twice', () => {
    expect(employeeDetailsSchema.safeParse({ bankAccount: '1234567890', bankAccountConfirm: '1234567891' }).success).toBe(false);
    expect(employeeDetailsSchema.safeParse({ bankAccount: '1234567890' }).success).toBe(false);
  });
  it('keeps nominee shares at exactly 100%', () => {
    const n = (sharePercent: number) => ({ name: 'A', relationship: 'Mother', sharePercent });
    expect(employeeDetailsSchema.safeParse({ nominees: [n(60), n(40)] }).success).toBe(true);
    expect(employeeDetailsSchema.safeParse({ nominees: [n(60), n(30)] }).success).toBe(false);
  });
  it('treats an empty box as a cleared field and a missing key as untouched', () => {
    const p = employeeDetailsSchema.parse({ preferredName: '', gender: '' });
    expect(p.preferredName).toBeNull();
    expect(p.gender).toBeNull();
    expect('bloodGroup' in p && p.bloodGroup !== undefined).toBe(false);
  });
});

describe('building updates', () => {
  it('drops admin-only fields for an employee, keeps them for an admin', () => {
    const input = adminDetailsSchema.parse({ preferredName: 'Viki', noticePeriodDays: 30, workLocation: 'HYBRID' });
    expect('noticePeriodDays' in buildUpdate(input, false).data).toBe(false);
    expect(buildUpdate(input, true).data).toMatchObject({ noticePeriodDays: 30, workLocation: 'HYBRID' });
  });
  it('encrypts secrets, keeps only the last four, and reports which changed', () => {
    const input = employeeDetailsSchema.parse({ pan: 'ABCDE1234F', bankAccount: '1234567890', bankAccountConfirm: '1234567890' });
    const { data, secretsChanged } = buildUpdate(input, false);
    expect(secretsChanged.sort()).toEqual(['bankAccount', 'pan']);
    expect(data).toMatchObject({ panLast4: '234F', bankAccountLast4: '7890' });
    expect(JSON.stringify(data)).not.toContain('ABCDE1234F');
    expect(JSON.stringify(data)).not.toContain('1234567890');
    expect(decryptField((data as { panEnc: string }).panEnc)).toBe('ABCDE1234F');
  });
  it('clears a secret when sent empty and ignores it when not sent', () => {
    expect(buildUpdate(employeeDetailsSchema.parse({ pan: '' }), false).data).toMatchObject({ panEnc: null, panLast4: null });
    expect(buildUpdate(employeeDetailsSchema.parse({ preferredName: 'A' }), false).secretsChanged).toEqual([]);
  });
  it('copies the current address when "same as current" is on', () => {
    const input = employeeDetailsSchema.parse({ sameAddress: true, currentAddress: { line1: '1 MG Road', city: 'Chennai', pincode: '600001' } });
    const { data } = buildUpdate(input, false);
    expect(data.permanentAddress).toEqual(data.currentAddress);
  });
  it('wraps embedded values only for updates', () => {
    const { data } = buildUpdate(employeeDetailsSchema.parse({ currentAddress: { city: 'Chennai' } }), false);
    expect(forUpdate(data).currentAddress).toEqual({ set: expect.objectContaining({ city: 'Chennai' }) });
    expect(forCreate('u1', data)).toMatchObject({ userId: 'u1', currentAddress: expect.objectContaining({ city: 'Chennai' }) });
  });
});

describe('what the browser gets', () => {
  it('never contains a secret value, only whether it is set and the masked form', () => {
    const { data } = buildUpdate(employeeDetailsSchema.parse({ pan: 'ABCDE1234F' }), false);
    const view = toClientDetails({ ...(data as object), id: 'x', userId: 'u' } as never, false);
    expect(view.secrets.pan).toEqual({ set: true, masked: 'XXXXXX234F' });
    expect(JSON.stringify(view)).not.toContain('ABCDE1234F');
    expect(JSON.stringify(view)).not.toContain('Enc');
    expect('noticePeriodDays' in view).toBe(false);
  });
  it('scores completeness from the key fields', () => {
    const empty = completeness(toClientDetails(null, false));
    expect(empty.percent).toBe(0);
    expect(empty.missing).toContain('PAN');
  });
});

describe('celebrations', () => {
  const at = (iso: string) => new Date(iso);
  it('finds the next birthday, today counting as 0 days', () => {
    const dob = at('1998-10-15T12:00:00Z');
    expect(nextOccurrence(dob, at('2026-10-11T05:00:00Z'))).toEqual({ date: '2026-10-15', daysAway: 4 });
    expect(nextOccurrence(dob, at('2026-10-15T05:00:00Z'))).toEqual({ date: '2026-10-15', daysAway: 0 });
    expect(nextOccurrence(dob, at('2026-10-16T05:00:00Z')).date).toBe('2027-10-15');
  });
  it('uses India time for "today"', () => {
    // 20:00 UTC on the 14th is already the 15th in India
    expect(nextOccurrence(at('1998-10-15T12:00:00Z'), at('2026-10-14T20:00:00Z')).daysAway).toBe(0);
  });
  it('moves a 29 Feb date to 28 Feb in non-leap years', () => {
    expect(nextOccurrence(at('2000-02-29T12:00:00Z'), at('2027-02-01T05:00:00Z')).date).toBe('2027-02-28');
  });
});
