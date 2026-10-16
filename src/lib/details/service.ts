import type { EmployeeDetails, Prisma } from '@prisma/client';
import { encryptField, last4, maskedFrom } from './secure';
import { ADMIN_ONLY_KEYS, type EmployeeDetailsInput } from './validation';

// Turns the stored record into what the screens get (secrets masked), and turns what the person
// typed into a database update. Dates are whole days stored at noon UTC, like the rest of the portal.

export type SecretKey = 'bankAccount' | 'pan' | 'aadhaar' | 'uan';

const SECRET_COLUMNS: Record<SecretKey, { enc: keyof EmployeeDetails; last: keyof EmployeeDetails; length: number; label: string }> = {
  bankAccount: { enc: 'bankAccountEnc', last: 'bankAccountLast4', length: 12, label: 'Bank account number' },
  pan:         { enc: 'panEnc',         last: 'panLast4',         length: 10, label: 'PAN' },
  aadhaar:     { enc: 'aadhaarEnc',     last: 'aadhaarLast4',     length: 12, label: 'Aadhaar' },
  uan:         { enc: 'uanEnc',         last: 'uanLast4',         length: 12, label: 'UAN' },
};
export const SECRET_KEYS = Object.keys(SECRET_COLUMNS) as SecretKey[];
export const secretLabel = (k: SecretKey) => SECRET_COLUMNS[k].label;
export const secretEncColumn = (k: SecretKey) => SECRET_COLUMNS[k].enc as 'bankAccountEnc' | 'panEnc' | 'aadhaarEnc' | 'uanEnc';

export const toDay = (s: string | null | undefined): Date | null => (s ? new Date(`${s.slice(0, 10)}T12:00:00.000Z`) : null);
export const fromDay = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

type Row = EmployeeDetails | null;

const addr = (a: EmployeeDetails['currentAddress'] | undefined) => ({
  line1: a?.line1 ?? '', line2: a?.line2 ?? '', city: a?.city ?? '', state: a?.state ?? '', pincode: a?.pincode ?? '',
});

export interface SecretState { set: boolean; masked: string | null }

/** The record as the browser sees it. `admin` adds the HR-only fields. */
export function toClientDetails(row: Row, admin: boolean) {
  const r = row;
  const secret = (k: SecretKey): SecretState => {
    const c = SECRET_COLUMNS[k];
    const last = r ? (r[c.last] as string | null) : null;
    return { set: !!(r && r[c.enc]), masked: maskedFrom(last, c.length) };
  };
  return {
    exists: !!r,
    preferredName: r?.preferredName ?? '', dateOfBirth: fromDay(r?.dateOfBirth), hideBirthday: r?.hideBirthday ?? false,
    gender: r?.gender ?? '', bloodGroup: r?.bloodGroup ?? '', maritalStatus: r?.maritalStatus ?? '',
    nationality: r?.nationality ?? '', personalEmail: r?.personalEmail ?? '', altPhone: r?.altPhone ?? '',
    languages: r?.languages ?? [], tshirtSize: r?.tshirtSize ?? '',
    currentAddress: addr(r?.currentAddress), permanentAddress: addr(r?.permanentAddress), sameAddress: r?.sameAddress ?? false,
    emergencyName: r?.emergencyName ?? '', emergencyRelation: r?.emergencyRelation ?? '', emergencyPhone: r?.emergencyPhone ?? '',
    emergency2Name: r?.emergency2Name ?? '', emergency2Relation: r?.emergency2Relation ?? '', emergency2Phone: r?.emergency2Phone ?? '',
    medicalNotes: r?.medicalNotes ?? '',
    bankHolderName: r?.bankHolderName ?? '', bankName: r?.bankName ?? '', bankBranch: r?.bankBranch ?? '',
    ifsc: r?.ifsc ?? '', accountType: r?.accountType ?? '',
    secrets: { bankAccount: secret('bankAccount'), pan: secret('pan'), aadhaar: secret('aadhaar'), uan: secret('uan') },
    highestQualification: r?.highestQualification ?? '', institute: r?.institute ?? '', passingYear: r?.passingYear ?? null,
    totalExperienceYears: r?.totalExperienceYears ?? null, previousEmployer: r?.previousEmployer ?? '',
    previousRole: r?.previousRole ?? '', previousDuration: r?.previousDuration ?? '', skills: r?.skills ?? '', linkedinUrl: r?.linkedinUrl ?? '',
    nominees: (r?.nominees ?? []).map((n) => ({ name: n.name, relationship: n.relationship, dateOfBirth: fromDay(n.dateOfBirth), sharePercent: n.sharePercent, phone: n.phone ?? '' })),
    // Employees can see what has been issued to them, but cannot change it.
    assets: (r?.assets ?? []).map((a) => ({ type: a.type, name: a.name, serial: a.serial ?? '', issuedOn: fromDay(a.issuedOn), returnedOn: fromDay(a.returnedOn), notes: a.notes ?? '' })),
    ...(admin ? {
      relievingLetterSubmitted: r?.relievingLetterSubmitted ?? false, backgroundCheckDone: r?.backgroundCheckDone ?? false,
      backgroundCheckDate: fromDay(r?.backgroundCheckDate), noticePeriodDays: r?.noticePeriodDays ?? null, workLocation: r?.workLocation ?? '',
    } : {}),
  };
}

export type ClientDetails = ReturnType<typeof toClientDetails>;

const blankToNull = (a: { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; pincode?: string | null } | null | undefined) =>
  a === undefined ? undefined : a === null ? null : { line1: a.line1 ?? null, line2: a.line2 ?? null, city: a.city ?? null, state: a.state ?? null, pincode: a.pincode ?? null };

export interface BuiltUpdate {
  data: Prisma.EmployeeDetailsUncheckedUpdateInput;
  /** Secret fields that were set or cleared (names only, never values) - used for the audit log. */
  secretsChanged: SecretKey[];
}

/** Builds the database update. Fields that were not sent are left alone; admin-only fields are dropped for non-admins. */
export function buildUpdate(input: Partial<EmployeeDetailsInput>, isAdmin: boolean): BuiltUpdate {
  const i = { ...input } as Record<string, unknown>;
  if (!isAdmin) for (const k of ADMIN_ONLY_KEYS) delete i[k];

  const data: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) data[k] = v; };

  for (const k of [
    'preferredName', 'hideBirthday', 'gender', 'bloodGroup', 'maritalStatus', 'nationality', 'personalEmail', 'altPhone', 'tshirtSize',
    'sameAddress', 'emergencyName', 'emergencyRelation', 'emergencyPhone', 'emergency2Name', 'emergency2Relation', 'emergency2Phone',
    'medicalNotes', 'bankHolderName', 'bankName', 'bankBranch', 'ifsc', 'accountType', 'highestQualification', 'institute', 'passingYear',
    'totalExperienceYears', 'previousEmployer', 'previousRole', 'previousDuration', 'skills', 'linkedinUrl',
    'relievingLetterSubmitted', 'backgroundCheckDone', 'noticePeriodDays', 'workLocation',
  ]) set(k, i[k]);

  if (i.languages !== undefined) set('languages', i.languages);
  if (i.dateOfBirth !== undefined) set('dateOfBirth', toDay(i.dateOfBirth as string | null));
  if (i.backgroundCheckDate !== undefined) set('backgroundCheckDate', toDay(i.backgroundCheckDate as string | null));

  const cur = blankToNull(i.currentAddress as Parameters<typeof blankToNull>[0]);
  set('currentAddress', cur);
  set('permanentAddress', i.sameAddress === true ? cur : blankToNull(i.permanentAddress as Parameters<typeof blankToNull>[0]));

  if (Array.isArray(i.nominees)) {
    set('nominees', (i.nominees as { name: string; relationship: string; dateOfBirth?: string | null; sharePercent: number; phone?: string | null }[])
      .map((n) => ({ name: n.name, relationship: n.relationship, dateOfBirth: toDay(n.dateOfBirth), sharePercent: n.sharePercent, phone: n.phone ?? null })));
  }
  if (Array.isArray(i.assets)) {
    set('assets', (i.assets as { type: string; name: string; serial?: string | null; issuedOn?: string | null; returnedOn?: string | null; notes?: string | null }[])
      .map((a) => ({ type: a.type, name: a.name, serial: a.serial ?? null, issuedOn: toDay(a.issuedOn), returnedOn: toDay(a.returnedOn), notes: a.notes ?? null })));
  }

  const secretsChanged: SecretKey[] = [];
  for (const k of SECRET_KEYS) {
    const v = i[k] as string | null | undefined;
    if (v === undefined) continue;
    const c = SECRET_COLUMNS[k];
    data[c.enc as string] = v ? encryptField(v) : null;
    data[c.last as string] = v ? last4(v) : null;
    secretsChanged.push(k);
  }

  return { data: data as Prisma.EmployeeDetailsUncheckedUpdateInput, secretsChanged };
}

// ── How complete is it? ───────────────────────────────────────────────────────

export interface Completeness {
  percent: number;
  sections: { id: string; label: string; done: number; total: number }[];
  missing: string[];
}

export function completeness(d: ClientDetails): Completeness {
  const has = (v: unknown) => (typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined);
  const sections: { id: string; label: string; items: [string, boolean][] }[] = [
    { id: 'personal', label: 'Personal', items: [
      ['Date of birth', has(d.dateOfBirth)], ['Gender', has(d.gender)], ['Blood group', has(d.bloodGroup)], ['Marital status', has(d.maritalStatus)],
      ['Current address', has(d.currentAddress.line1) && has(d.currentAddress.city) && has(d.currentAddress.pincode)],
    ] },
    { id: 'emergency', label: 'Emergency contact', items: [['Emergency contact', has(d.emergencyName) && has(d.emergencyPhone)]] },
    { id: 'bank', label: 'Bank details', items: [
      ['Account holder name', has(d.bankHolderName)], ['Bank name', has(d.bankName)], ['IFSC', has(d.ifsc)],
      ['Account number', d.secrets.bankAccount.set], ['Account type', has(d.accountType)],
    ] },
    { id: 'ids', label: 'Government IDs', items: [['PAN', d.secrets.pan.set], ['Aadhaar', d.secrets.aadhaar.set]] },
    { id: 'education', label: 'Education', items: [['Highest qualification', has(d.highestQualification)]] },
  ];
  let done = 0, total = 0;
  const missing: string[] = [];
  const out = sections.map((s) => {
    const d1 = s.items.filter(([, ok]) => ok).length;
    done += d1; total += s.items.length;
    s.items.forEach(([label, ok]) => { if (!ok) missing.push(label); });
    return { id: s.id, label: s.label, done: d1, total: s.items.length };
  });
  return { percent: Math.round((done / total) * 100), sections: out, missing };
}

// Prisma wants composite (embedded) values wrapped when updating an existing record; creating takes them as they are.
const COMPOSITE_KEYS = ['currentAddress', 'permanentAddress', 'nominees', 'assets'] as const;

export function forUpdate(data: BuiltUpdate['data']): Prisma.EmployeeDetailsUncheckedUpdateInput {
  const out: Record<string, unknown> = { ...data };
  for (const k of COMPOSITE_KEYS) {
    if (!(k in out)) continue;
    const v = out[k];
    out[k] = v === null ? { unset: true } : { set: v };
  }
  return out as Prisma.EmployeeDetailsUncheckedUpdateInput;
}

export function forCreate(userId: string, data: BuiltUpdate['data']): Prisma.EmployeeDetailsUncheckedCreateInput {
  const out: Record<string, unknown> = { userId, ...data };
  for (const k of COMPOSITE_KEYS) if (out[k] === null) delete out[k];
  return out as Prisma.EmployeeDetailsUncheckedCreateInput;
}
