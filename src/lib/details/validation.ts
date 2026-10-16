import { z } from 'zod';

// Shared by the form (browser) and the API (server), so both reject the same mistakes.

export const BLOOD_GROUPS   = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export const GENDERS        = ['Male', 'Female', 'Non-binary', 'Prefer not to say'] as const;
export const MARITAL        = ['Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say'] as const;
export const ACCOUNT_TYPES  = ['SAVINGS', 'CURRENT'] as const;
export const TSHIRT_SIZES   = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] as const;
export const WORK_LOCATIONS = ['OFFICE', 'REMOTE', 'HYBRID'] as const;
export const ASSET_TYPES    = ['LAPTOP', 'PHONE', 'SIM', 'ID_CARD', 'ACCESS_CARD', 'OTHER'] as const;
export const RELATIONSHIPS  = ['Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Son', 'Daughter', 'Friend', 'Other'] as const;

// ── Format checks ─────────────────────────────────────────────────────────────

export const PAN_RE     = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE    = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PIN_RE     = /^[1-9][0-9]{5}$/;
export const UAN_RE     = /^[0-9]{12}$/;
export const ACCOUNT_RE = /^[0-9]{9,18}$/;

// Aadhaar numbers carry a Verhoeff check digit, so most typos are caught without any lookup.
const D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0],
];
const P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];
export function isValidAadhaar(value: string): boolean {
  if (!/^[2-9][0-9]{11}$/.test(value)) return false;
  let c = 0;
  [...value].reverse().forEach((ch, i) => { c = D[c][P[i % 8][Number(ch)]]; });
  return c === 0;
}

/** Normalises what people type: strips spaces/dashes, upper-cases letters. */
export const compact = (v: string) => v.replace(/[\s-]/g, '').toUpperCase();

const PHONE_RE = /^(\+91[\s-]?)?[6-9][0-9]{9}$/;
export const isValidPhone = (v: string) => PHONE_RE.test(v.replace(/[\s-]/g, '').replace(/^(\+91)/, '+91'));

// ── Building blocks ───────────────────────────────────────────────────────────

/** Optional text: trims, and turns "" into null so a cleared box clears the field. */
const text = (max = 120) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v === undefined ? undefined : v || null));

const oneOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal(''), z.null()]).optional().transform((v) => (v === undefined ? undefined : v || null));

const phone = z.string().trim().nullable().optional()
  .refine((v) => !v || isValidPhone(v), 'Enter a valid 10-digit mobile number')
  .transform((v) => (v === undefined ? undefined : v || null));

const dateStr = z.string().nullable().optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date')
  .transform((v) => (v === undefined ? undefined : v || null));

/** A secret value the person types (PAN, Aadhaar, bank account, UAN): undefined = keep what is stored. */
const secretField = (re: RegExp | ((v: string) => boolean), message: string) =>
  z.string().nullable().optional().transform((v) => (v === undefined ? undefined : v ? compact(v) : null))
    .refine((v) => v === undefined || v === null || (typeof re === 'function' ? re(v) : re.test(v)), message);

const address = z.object({
  line1:   text(150), line2: text(150), city: text(60), state: text(60),
  pincode: z.string().trim().nullable().optional()
    .refine((v) => !v || PIN_RE.test(v), 'Enter a valid 6-digit PIN code')
    .transform((v) => (v === undefined ? undefined : v || null)),
}).nullable().optional();

export const nomineeSchema = z.object({
  name:         z.string().trim().min(1, 'Name is required').max(100),
  relationship: z.string().trim().min(1, 'Relationship is required').max(40),
  dateOfBirth:  dateStr,
  sharePercent: z.number().int().min(1, 'Share must be at least 1%').max(100),
  phone,
});

export const assetSchema = z.object({
  type:       z.enum(ASSET_TYPES),
  name:       z.string().trim().min(1, 'Name is required').max(100),
  serial:     text(80),
  issuedOn:   dateStr,
  returnedOn: dateStr,
  notes:      text(200),
});

// ── What an employee (or an admin) can save ───────────────────────────────────

const employeeShape = {
  // personal
  preferredName: text(40),
  dateOfBirth:   dateStr,
  hideBirthday:  z.boolean().optional(),
  gender:        oneOf(GENDERS),
  bloodGroup:    oneOf(BLOOD_GROUPS),
  maritalStatus: oneOf(MARITAL),
  nationality:   text(40),
  personalEmail: z.string().trim().max(120).nullable().optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, 'Enter a valid email')
    .transform((v) => (v === undefined ? undefined : v || null)),
  altPhone:      phone,
  languages:     z.array(z.string().trim().min(1).max(30)).max(12).optional(),
  tshirtSize:    oneOf(TSHIRT_SIZES),
  currentAddress:   address,
  permanentAddress: address,
  sameAddress:      z.boolean().optional(),
  // emergency
  emergencyName: text(100), emergencyRelation: text(40), emergencyPhone: phone,
  emergency2Name: text(100), emergency2Relation: text(40), emergency2Phone: phone,
  medicalNotes: text(300),
  // bank
  bankHolderName: text(100), bankName: text(100), bankBranch: text(100),
  ifsc: z.string().trim().nullable().optional()
    .transform((v) => (v === undefined ? undefined : v ? compact(v) : null))
    .refine((v) => !v || IFSC_RE.test(v), 'Enter a valid IFSC (e.g. HDFC0001234)'),
  accountType: oneOf(ACCOUNT_TYPES),
  bankAccount:        secretField(ACCOUNT_RE, 'Account number must be 9-18 digits'),
  bankAccountConfirm: z.string().nullable().optional(),
  // ids
  pan:     secretField(PAN_RE, 'Enter a valid PAN (e.g. ABCDE1234F)'),
  aadhaar: secretField(isValidAadhaar, 'Enter a valid 12-digit Aadhaar number'),
  uan:     secretField(UAN_RE, 'UAN is 12 digits'),
  // education & experience
  highestQualification: text(100), institute: text(120),
  passingYear: z.number().int().min(1960).max(2100).nullable().optional(),
  totalExperienceYears: z.number().min(0).max(60).nullable().optional(),
  previousEmployer: text(120), previousRole: text(100), previousDuration: text(60),
  skills: text(300),
  linkedinUrl: z.string().trim().max(200).nullable().optional()
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), 'Enter a full link starting with https://')
    .transform((v) => (v === undefined ? undefined : v || null)),
  nominees: z.array(nomineeSchema).max(6).optional(),
};

const adminShape = {
  relievingLetterSubmitted: z.boolean().optional(),
  backgroundCheckDone:      z.boolean().optional(),
  backgroundCheckDate:      dateStr,
  noticePeriodDays:         z.number().int().min(0).max(365).nullable().optional(),
  workLocation:             oneOf(WORK_LOCATIONS),
  assets:                   z.array(assetSchema).max(30).optional(),
};

function crossChecks(v: { nominees?: { sharePercent: number }[]; bankAccount?: string | null; bankAccountConfirm?: string | null }, ctx: z.RefinementCtx) {
  if (v.nominees?.length && v.nominees.reduce((s, n) => s + n.sharePercent, 0) !== 100) {
    ctx.addIssue({ code: 'custom', path: ['nominees'], message: 'Nominee shares must add up to 100%' });
  }
  if (v.bankAccount && compact(v.bankAccountConfirm ?? '') !== v.bankAccount) {
    ctx.addIssue({ code: 'custom', path: ['bankAccountConfirm'], message: 'Account numbers do not match' });
  }
}

export const employeeDetailsSchema = z.object(employeeShape).superRefine(crossChecks);
export const adminDetailsSchema    = z.object({ ...employeeShape, ...adminShape }).superRefine(crossChecks);

export type EmployeeDetailsInput = z.infer<typeof adminDetailsSchema>;
export const ADMIN_ONLY_KEYS = Object.keys(adminShape) as (keyof typeof adminShape)[];
