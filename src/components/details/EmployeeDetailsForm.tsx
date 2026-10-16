'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, EyeOff, Loader2, Lock, Plus, Trash2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  lookupIfsc, revealSecret, useEmployeeDetails, useSaveEmployeeDetails,
  type ClientDetails, type SecretKey,
} from '@/hooks/useEmployeeDetails';
import {
  ACCOUNT_TYPES, ASSET_TYPES, BLOOD_GROUPS, GENDERS, MARITAL, RELATIONSHIPS, TSHIRT_SIZES, WORK_LOCATIONS,
  adminDetailsSchema, employeeDetailsSchema, IFSC_RE,
} from '@/lib/details/validation';

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 disabled:opacity-60';
const LC = 'text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block';

type SecretMode = 'keep' | 'change' | 'clear';
type Form = Omit<ClientDetails, 'exists' | 'secrets'> & {
  pan: string; aadhaar: string; uan: string; bankAccount: string; bankAccountConfirm: string;
  mode: Record<SecretKey, SecretMode>;
};

const blankMode: Record<SecretKey, SecretMode> = { bankAccount: 'keep', pan: 'keep', aadhaar: 'keep', uan: 'keep' };

function toForm(d: ClientDetails): Form {
  const { exists: _e, secrets: _s, ...rest } = d;
  void _e; void _s;
  return { ...rest, pan: '', aadhaar: '', uan: '', bankAccount: '', bankAccountConfirm: '', mode: { ...blankMode } };
}

const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

// ── Small pieces ──────────────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {hint && <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">{hint}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <label className={LC}>{label}</label>
      {children}
      {error && <p className="text-xs text-status-absent mt-1">{error}</p>}
    </div>
  );
}

function Select({ value, onChange, options, disabled, placeholder = 'Select…' }: { value: string; onChange: (v: string) => void; options: readonly string[]; disabled?: boolean; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={IC}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center gap-2 text-sm text-gray-700 dark:text-violet-200/70', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded accent-[var(--color-brand,#7c3aed)]" />
      {label}
    </label>
  );
}

/** A number that is stored encrypted: shown masked, with show / change / remove. */
function SecretInput({
  label, hint, state, mode, setMode, value, onValue, ownerId, field, placeholder, error, upper, inputMode,
}: {
  label: string; hint?: string; state: { set: boolean; masked: string | null }; mode: SecretMode; setMode: (m: SecretMode) => void;
  value: string; onValue: (v: string) => void; ownerId: string; field: SecretKey; placeholder: string; error?: string; upper?: boolean; inputMode?: 'numeric' | 'text';
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function reveal() {
    if (shown) { setShown(null); return; }
    setBusy(true); setRevealError(null);
    try {
      setShown(await revealSecret(ownerId, field));
      timer.current = setTimeout(() => setShown(null), 20_000); // hides itself again
    } catch (e) { setRevealError((e as Error).message); } finally { setBusy(false); }
  }

  const editing = mode === 'change' || !state.set;
  return (
    <div>
      <label className={LC}>{label}</label>
      {state.set && mode !== 'change' ? (
        <div className="flex items-center gap-2">
          <div className={cn(IC, 'flex-1 flex items-center justify-between font-mono tracking-wider', mode === 'clear' && 'line-through opacity-60')}>
            <span>{shown ?? state.masked}</span>
            <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </div>
          <button type="button" onClick={() => void reveal()} disabled={busy || mode === 'clear'} title={shown ? 'Hide' : 'Show full number'}
            className="h-9 w-9 shrink-0 rounded-lg border border-gray-200 dark:border-violet-900/40 grid place-items-center text-gray-500 hover:text-gray-900 dark:hover:text-white">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button type="button" onClick={() => { onValue(''); setMode('change'); }} className="text-xs font-medium text-brand hover:underline shrink-0">Change</button>
          <button type="button" onClick={() => setMode(mode === 'clear' ? 'keep' : 'clear')} className="text-xs font-medium text-status-absent hover:underline shrink-0">{mode === 'clear' ? 'Undo' : 'Remove'}</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input value={value} onChange={(e) => onValue(upper ? e.target.value.toUpperCase() : e.target.value)} placeholder={placeholder} inputMode={inputMode}
            autoComplete="off" className={cn(IC, 'font-mono tracking-wider', error && 'border-status-absent')} />
          {editing && state.set && <button type="button" onClick={() => { onValue(''); setMode('keep'); }} className="text-xs font-medium text-gray-500 hover:underline shrink-0">Cancel</button>}
        </div>
      )}
      {hint && <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">{hint}</p>}
      {revealError && <p className="text-xs text-status-absent mt-1">{revealError}</p>}
      {error && <p className="text-xs text-status-absent mt-1">{error}</p>}
    </div>
  );
}

// ── The form ──────────────────────────────────────────────────────────────────

export function EmployeeDetailsForm({ employeeId, isSelf }: { employeeId: string; isSelf: boolean }) {
  const q = useEmployeeDetails(employeeId);
  const save = useSaveEmployeeDetails(employeeId);
  const [form, setForm] = useState<Form | null>(null);
  const [initial, setInitial] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ifscNote, setIfscNote] = useState<string | null>(null);

  const isAdminForm = q.data?.canEditAdminFields ?? false;
  const secrets = q.data?.details.secrets;

  // (Re)load the form when the saved data arrives or changes.
  useEffect(() => {
    if (!q.data) return;
    const f = toForm(q.data.details);
    setForm(f); setInitial(JSON.stringify(f)); setErrors({});
  }, [q.data]);

  const dirty = useMemo(() => !!form && JSON.stringify(form) !== initial, [form, initial]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (q.isLoading || !form || !q.data || !secrets) {
    return <div className="h-64 rounded-xl bg-gray-100 dark:bg-surface-dark-3 animate-pulse" />;
  }
  if (q.isError) return <p className="text-sm text-status-absent">Could not load these details. Please refresh.</p>;

  const c = q.data.completeness;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setAddr = (which: 'currentAddress' | 'permanentAddress', k: keyof Form['currentAddress'], v: string) =>
    setForm((f) => (f ? { ...f, [which]: { ...f[which], [k]: v } } : f));
  const setMode = (k: SecretKey, m: SecretMode) => setForm((f) => (f ? { ...f, mode: { ...f.mode, [k]: m } } : f));
  const err = (k: string) => errors[k];

  async function onIfsc(raw: string) {
    const code = raw.replace(/\s/g, '').toUpperCase();
    set('ifsc', code);
    setIfscNote(null);
    if (IFSC_RE.test(code)) {
      const r = await lookupIfsc(code);
      if (r) { setForm((f) => (f ? { ...f, ifsc: code, bankName: r.bank || f.bankName, bankBranch: r.branch || f.bankBranch } : f)); setIfscNote(`${r.bank}, ${r.branch}`); }
      else setIfscNote('Could not look this up. You can type the bank name yourself.');
    }
  }

  function payload() {
    const f = form!;
    const p: Record<string, unknown> = {
      preferredName: f.preferredName, dateOfBirth: f.dateOfBirth || null, hideBirthday: f.hideBirthday, gender: f.gender, bloodGroup: f.bloodGroup,
      maritalStatus: f.maritalStatus, nationality: f.nationality, personalEmail: f.personalEmail, altPhone: f.altPhone,
      languages: f.languages, tshirtSize: f.tshirtSize, currentAddress: f.currentAddress, permanentAddress: f.permanentAddress, sameAddress: f.sameAddress,
      emergencyName: f.emergencyName, emergencyRelation: f.emergencyRelation, emergencyPhone: f.emergencyPhone,
      emergency2Name: f.emergency2Name, emergency2Relation: f.emergency2Relation, emergency2Phone: f.emergency2Phone, medicalNotes: f.medicalNotes,
      bankHolderName: f.bankHolderName, bankName: f.bankName, bankBranch: f.bankBranch, ifsc: f.ifsc, accountType: f.accountType,
      highestQualification: f.highestQualification, institute: f.institute, passingYear: f.passingYear,
      totalExperienceYears: f.totalExperienceYears, previousEmployer: f.previousEmployer, previousRole: f.previousRole,
      previousDuration: f.previousDuration, skills: f.skills, linkedinUrl: f.linkedinUrl,
      nominees: f.nominees.map((n) => ({ ...n, dateOfBirth: n.dateOfBirth || null, phone: n.phone || null })),
    };
    // A secret is only sent when it was changed or removed; otherwise the stored one stays as it is.
    (['pan', 'aadhaar', 'uan'] as const).forEach((k) => {
      if (f.mode[k] === 'clear') p[k] = '';
      else if (f.mode[k] === 'change' || !secrets![k].set) { if (f[k].trim()) p[k] = f[k]; }
    });
    if (f.mode.bankAccount === 'clear') p.bankAccount = '';
    else if (f.mode.bankAccount === 'change' || !secrets!.bankAccount.set) {
      if (f.bankAccount.trim() || f.bankAccountConfirm.trim()) { p.bankAccount = f.bankAccount; p.bankAccountConfirm = f.bankAccountConfirm; }
    }
    if (isAdminForm) {
      Object.assign(p, {
        relievingLetterSubmitted: f.relievingLetterSubmitted, backgroundCheckDone: f.backgroundCheckDone,
        backgroundCheckDate: f.backgroundCheckDate || null, noticePeriodDays: f.noticePeriodDays, workLocation: f.workLocation,
        assets: f.assets.map((a) => ({ ...a, issuedOn: a.issuedOn || null, returnedOn: a.returnedOn || null })),
      });
    }
    return p;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = payload();
    const parsed = (isAdminForm ? adminDetailsSchema : employeeDetailsSchema).safeParse(p);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const i of parsed.error.issues) { const k = i.path.join('.'); if (!map[k]) map[k] = i.message; }
      setErrors(map);
      document.querySelector('[data-error-anchor]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setErrors({});
    save.mutate(p);
  }

  const disabled = save.isPending;

  return (
    <form onSubmit={submit} className="space-y-8 pb-20">

      {/* Progress */}
      <div className="rounded-xl border border-gray-200 dark:border-violet-900/40 p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{isSelf ? 'Your details' : 'Details'} are {c.percent}% complete</p>
          {c.percent === 100 && <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><Check className="w-3.5 h-3.5" /> All done</span>}
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${c.percent}%` }} /></div>
        {c.missing.length > 0 && <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-2">Still needed: {c.missing.join(', ')}</p>}
        <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-violet-300/45 mt-2"><ShieldCheck className="w-3.5 h-3.5" /> Bank, PAN, Aadhaar and UAN numbers are stored encrypted and only you and the admins can see them.</p>
      </div>

      {Object.keys(errors).length > 0 && (
        <div data-error-anchor className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-600 dark:text-red-400">
          Please fix the highlighted fields: {Object.values(errors).slice(0, 3).join(' · ')}
        </div>
      )}

      <Section title="Personal" hint="Basic details about you.">
        <Field label="Preferred name" error={err('preferredName')}><input value={form.preferredName} onChange={(e) => set('preferredName', e.target.value)} placeholder="What people call you" className={IC} /></Field>
        <Field label="Date of birth" error={err('dateOfBirth')}><input type="date" value={form.dateOfBirth ?? ''} onChange={(e) => set('dateOfBirth', e.target.value || null)} className={IC} /></Field>
        <Field label="Gender"><Select value={form.gender} onChange={(v) => set('gender', v)} options={GENDERS} /></Field>
        <Field label="Blood group"><Select value={form.bloodGroup} onChange={(v) => set('bloodGroup', v)} options={BLOOD_GROUPS} /></Field>
        <Field label="Marital status"><Select value={form.maritalStatus} onChange={(v) => set('maritalStatus', v)} options={MARITAL} /></Field>
        <Field label="Nationality"><input value={form.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="Indian" className={IC} /></Field>
        <Field label="Personal email" error={err('personalEmail')}><input type="email" value={form.personalEmail} onChange={(e) => set('personalEmail', e.target.value)} className={IC} /></Field>
        <Field label="Alternate phone" error={err('altPhone')}><input value={form.altPhone} onChange={(e) => set('altPhone', e.target.value)} placeholder="+91 98765 43210" className={IC} /></Field>
        <Field label="Languages you speak" wide><input value={form.languages.join(', ')} onChange={(e) => set('languages', e.target.value.split(',').map((s) => s.trimStart()))} onBlur={() => set('languages', form.languages.map((s) => s.trim()).filter(Boolean))} placeholder="English, Tamil, Hindi" className={IC} /></Field>
        <Field label="T-shirt size"><Select value={form.tshirtSize} onChange={(v) => set('tshirtSize', v)} options={TSHIRT_SIZES} /></Field>
        <div className="flex items-end pb-2"><Toggle checked={form.hideBirthday} onChange={(v) => set('hideBirthday', v)} label="Don't show my birthday to the team" /></div>
      </Section>

      <Section title="Address">
        <div className="md:col-span-2 text-xs font-semibold text-gray-700 dark:text-violet-200/70">Current address</div>
        <Field label="Address line 1" wide error={err('currentAddress.line1')}><input value={form.currentAddress.line1} onChange={(e) => setAddr('currentAddress', 'line1', e.target.value)} className={IC} /></Field>
        <Field label="Address line 2" wide><input value={form.currentAddress.line2} onChange={(e) => setAddr('currentAddress', 'line2', e.target.value)} className={IC} /></Field>
        <Field label="City"><input value={form.currentAddress.city} onChange={(e) => setAddr('currentAddress', 'city', e.target.value)} className={IC} /></Field>
        <Field label="State"><input value={form.currentAddress.state} onChange={(e) => setAddr('currentAddress', 'state', e.target.value)} className={IC} /></Field>
        <Field label="PIN code" error={err('currentAddress.pincode')}><input value={form.currentAddress.pincode} inputMode="numeric" maxLength={6} onChange={(e) => setAddr('currentAddress', 'pincode', e.target.value.replace(/\D/g, ''))} className={IC} /></Field>
        <div className="md:col-span-2 text-xs font-semibold text-gray-700 dark:text-violet-200/70 pt-2">Permanent address</div>
        <div className="md:col-span-2"><Toggle checked={form.sameAddress} onChange={(v) => set('sameAddress', v)} label="Same as current address" /></div>
        {!form.sameAddress && (
          <>
            <Field label="Address line 1" wide><input value={form.permanentAddress.line1} onChange={(e) => setAddr('permanentAddress', 'line1', e.target.value)} className={IC} /></Field>
            <Field label="Address line 2" wide><input value={form.permanentAddress.line2} onChange={(e) => setAddr('permanentAddress', 'line2', e.target.value)} className={IC} /></Field>
            <Field label="City"><input value={form.permanentAddress.city} onChange={(e) => setAddr('permanentAddress', 'city', e.target.value)} className={IC} /></Field>
            <Field label="State"><input value={form.permanentAddress.state} onChange={(e) => setAddr('permanentAddress', 'state', e.target.value)} className={IC} /></Field>
            <Field label="PIN code" error={err('permanentAddress.pincode')}><input value={form.permanentAddress.pincode} inputMode="numeric" maxLength={6} onChange={(e) => setAddr('permanentAddress', 'pincode', e.target.value.replace(/\D/g, ''))} className={IC} /></Field>
          </>
        )}
      </Section>

      <Section title="Emergency contact" hint="Who we should call if something happens.">
        <Field label="Name"><input value={form.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} className={IC} /></Field>
        <Field label="Relationship"><Select value={form.emergencyRelation} onChange={(v) => set('emergencyRelation', v)} options={RELATIONSHIPS} /></Field>
        <Field label="Phone" error={err('emergencyPhone')} wide><input value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} placeholder="+91 98765 43210" className={IC} /></Field>
        <div className="md:col-span-2 text-xs font-semibold text-gray-700 dark:text-violet-200/70 pt-2">Second contact (optional)</div>
        <Field label="Name"><input value={form.emergency2Name} onChange={(e) => set('emergency2Name', e.target.value)} className={IC} /></Field>
        <Field label="Relationship"><Select value={form.emergency2Relation} onChange={(v) => set('emergency2Relation', v)} options={RELATIONSHIPS} /></Field>
        <Field label="Phone" error={err('emergency2Phone')} wide><input value={form.emergency2Phone} onChange={(e) => set('emergency2Phone', e.target.value)} className={IC} /></Field>
        <Field label="Medical conditions or allergies (optional)" wide><textarea value={form.medicalNotes} onChange={(e) => set('medicalNotes', e.target.value)} rows={2} className={IC} placeholder="Anything first-aiders should know" /></Field>
      </Section>

      <Section title="Bank details" hint="Used only for salary payments.">
        <Field label="Account holder name"><input value={form.bankHolderName} onChange={(e) => set('bankHolderName', e.target.value)} placeholder="As printed on the passbook" className={IC} /></Field>
        <Field label="IFSC code" error={err('ifsc')}>
          <input value={form.ifsc} onChange={(e) => void onIfsc(e.target.value)} maxLength={11} placeholder="HDFC0001234" className={cn(IC, 'font-mono uppercase', err('ifsc') && 'border-status-absent')} />
          {ifscNote && <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">{ifscNote}</p>}
        </Field>
        <Field label="Bank name"><input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} className={IC} /></Field>
        <Field label="Branch"><input value={form.bankBranch} onChange={(e) => set('bankBranch', e.target.value)} className={IC} /></Field>
        <Field label="Account type"><Select value={form.accountType} onChange={(v) => set('accountType', v)} options={ACCOUNT_TYPES} /></Field>
        <div />
        <div className="md:col-span-2">
          <SecretInput label="Account number" state={secrets.bankAccount} mode={form.mode.bankAccount} setMode={(m) => setMode('bankAccount', m)}
            value={form.bankAccount} onValue={(v) => set('bankAccount', v.replace(/\D/g, ''))} ownerId={employeeId} field="bankAccount" placeholder="Account number" inputMode="numeric" error={err('bankAccount')} />
        </div>
        {(form.mode.bankAccount === 'change' || !secrets.bankAccount.set) && (
          <Field label="Confirm account number" wide error={err('bankAccountConfirm')}>
            <input value={form.bankAccountConfirm} onChange={(e) => set('bankAccountConfirm', e.target.value.replace(/\D/g, ''))} onPaste={(e) => e.preventDefault()} inputMode="numeric" autoComplete="off" placeholder="Type it again (pasting is turned off)" className={cn(IC, 'font-mono tracking-wider', err('bankAccountConfirm') && 'border-status-absent')} />
          </Field>
        )}
      </Section>

      <Section title="Government IDs" hint="Needed for payroll and statutory records.">
        <SecretInput label="PAN" state={secrets.pan} mode={form.mode.pan} setMode={(m) => setMode('pan', m)} value={form.pan} onValue={(v) => set('pan', v)} ownerId={employeeId} field="pan" placeholder="ABCDE1234F" upper error={err('pan')} />
        <SecretInput label="Aadhaar" state={secrets.aadhaar} mode={form.mode.aadhaar} setMode={(m) => setMode('aadhaar', m)} value={form.aadhaar} onValue={(v) => set('aadhaar', v.replace(/[^\d\s]/g, ''))} ownerId={employeeId} field="aadhaar" placeholder="1234 5678 9012" inputMode="numeric" error={err('aadhaar')} />
        <SecretInput label="UAN (PF number), if you have one" hint="From a previous job. Leave empty if you don't have one." state={secrets.uan} mode={form.mode.uan} setMode={(m) => setMode('uan', m)} value={form.uan} onValue={(v) => set('uan', v.replace(/\D/g, ''))} ownerId={employeeId} field="uan" placeholder="12-digit UAN" inputMode="numeric" error={err('uan')} />
      </Section>

      <Section title="Education & experience">
        <Field label="Highest qualification"><input value={form.highestQualification} onChange={(e) => set('highestQualification', e.target.value)} placeholder="B.E. Computer Science" className={IC} /></Field>
        <Field label="Institute"><input value={form.institute} onChange={(e) => set('institute', e.target.value)} className={IC} /></Field>
        <Field label="Year of passing" error={err('passingYear')}><input type="number" value={form.passingYear ?? ''} onChange={(e) => set('passingYear', num(e.target.value))} className={IC} /></Field>
        <Field label="Total experience (years)" error={err('totalExperienceYears')}><input type="number" step="0.5" min={0} value={form.totalExperienceYears ?? ''} onChange={(e) => set('totalExperienceYears', num(e.target.value))} className={IC} /></Field>
        <Field label="Previous employer"><input value={form.previousEmployer} onChange={(e) => set('previousEmployer', e.target.value)} className={IC} /></Field>
        <Field label="Previous role"><input value={form.previousRole} onChange={(e) => set('previousRole', e.target.value)} className={IC} /></Field>
        <Field label="Duration there" wide><input value={form.previousDuration} onChange={(e) => set('previousDuration', e.target.value)} placeholder="e.g. 2 years 3 months" className={IC} /></Field>
        <Field label="Skills" wide><input value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder="Figma, Meta Ads, React…" className={IC} /></Field>
        <Field label="LinkedIn or portfolio link" wide error={err('linkedinUrl')}><input value={form.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} placeholder="https://" className={IC} /></Field>
      </Section>

      <section>
        <div className="pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Nominees</h3>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">For PF and insurance. Shares must add up to 100%.</p>
          </div>
          {form.nominees.length < 6 && (
            <button type="button" onClick={() => set('nominees', [...form.nominees, { name: '', relationship: '', dateOfBirth: null, sharePercent: form.nominees.length ? 0 : 100, phone: '' }])}
              className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"><Plus className="w-3.5 h-3.5" /> Add nominee</button>
          )}
        </div>
        {err('nominees') && <p className="text-xs text-status-absent mb-2">{err('nominees')}</p>}
        <div className="space-y-3">
          {form.nominees.map((n, i) => (
            <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end rounded-lg border border-gray-200 dark:border-violet-900/40 p-3">
              <Field label="Name" error={err(`nominees.${i}.name`)}><input value={n.name} onChange={(e) => set('nominees', form.nominees.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={IC} /></Field>
              <Field label="Relationship" error={err(`nominees.${i}.relationship`)}><Select value={n.relationship} onChange={(v) => set('nominees', form.nominees.map((x, j) => (j === i ? { ...x, relationship: v } : x)))} options={RELATIONSHIPS} /></Field>
              <Field label="Date of birth"><input type="date" value={n.dateOfBirth ?? ''} onChange={(e) => set('nominees', form.nominees.map((x, j) => (j === i ? { ...x, dateOfBirth: e.target.value || null } : x)))} className={IC} /></Field>
              <Field label="Share %" error={err(`nominees.${i}.sharePercent`)}><input type="number" min={1} max={100} value={n.sharePercent} onChange={(e) => set('nominees', form.nominees.map((x, j) => (j === i ? { ...x, sharePercent: Number(e.target.value) } : x)))} className={IC} /></Field>
              <button type="button" onClick={() => set('nominees', form.nominees.filter((_, j) => j !== i))} className="h-9 text-status-absent text-xs flex items-center gap-1 justify-center"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
            </div>
          ))}
          {form.nominees.length === 0 && <p className="text-xs text-gray-400 dark:text-violet-300/45">No nominees added.</p>}
        </div>
      </section>

      {/* Company records: employees can see what was issued to them; only admins edit */}
      {(form.assets.length > 0 || isAdminForm) && (
        <section>
          <div className="pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-4 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Company assets</h3>
              <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">{isAdminForm ? 'Equipment issued to this person.' : 'Equipment issued to you. Only admins can change this list.'}</p>
            </div>
            {isAdminForm && form.assets.length < 30 && (
              <button type="button" onClick={() => set('assets', [...form.assets, { type: 'LAPTOP', name: '', serial: '', issuedOn: null, returnedOn: null, notes: '' }])}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"><Plus className="w-3.5 h-3.5" /> Add asset</button>
            )}
          </div>
          <div className="space-y-3">
            {form.assets.map((a, i) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end rounded-lg border border-gray-200 dark:border-violet-900/40 p-3">
                <Field label="Type"><Select value={a.type} onChange={(v) => set('assets', form.assets.map((x, j) => (j === i ? { ...x, type: v } : x)))} options={ASSET_TYPES} disabled={!isAdminForm} /></Field>
                <Field label="Name" error={err(`assets.${i}.name`)}><input disabled={!isAdminForm} value={a.name} onChange={(e) => set('assets', form.assets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={IC} /></Field>
                <Field label="Serial / number"><input disabled={!isAdminForm} value={a.serial} onChange={(e) => set('assets', form.assets.map((x, j) => (j === i ? { ...x, serial: e.target.value } : x)))} className={IC} /></Field>
                <Field label="Issued on"><input type="date" disabled={!isAdminForm} value={a.issuedOn ?? ''} onChange={(e) => set('assets', form.assets.map((x, j) => (j === i ? { ...x, issuedOn: e.target.value || null } : x)))} className={IC} /></Field>
                <Field label="Returned on"><input type="date" disabled={!isAdminForm} value={a.returnedOn ?? ''} onChange={(e) => set('assets', form.assets.map((x, j) => (j === i ? { ...x, returnedOn: e.target.value || null } : x)))} className={IC} /></Field>
                {isAdminForm && <button type="button" onClick={() => set('assets', form.assets.filter((_, j) => j !== i))} className="h-9 text-status-absent text-xs flex items-center gap-1 justify-center"><Trash2 className="w-3.5 h-3.5" /> Remove</button>}
              </div>
            ))}
            {form.assets.length === 0 && <p className="text-xs text-gray-400 dark:text-violet-300/45">Nothing issued yet.</p>}
          </div>
        </section>
      )}

      {isAdminForm && (
        <Section title="HR records (admin only)" hint="Employees cannot see this section.">
          <Field label="Work location"><Select value={form.workLocation ?? ''} onChange={(v) => set('workLocation', v)} options={WORK_LOCATIONS} /></Field>
          <Field label="Notice period (days)" error={err('noticePeriodDays')}><input type="number" min={0} value={form.noticePeriodDays ?? ''} onChange={(e) => set('noticePeriodDays', num(e.target.value))} className={IC} /></Field>
          <div><Toggle checked={!!form.relievingLetterSubmitted} onChange={(v) => set('relievingLetterSubmitted', v)} label="Previous relieving letter submitted" /></div>
          <div className="space-y-2">
            <Toggle checked={!!form.backgroundCheckDone} onChange={(v) => set('backgroundCheckDone', v)} label="Background check done" />
            {form.backgroundCheckDone && <input type="date" value={form.backgroundCheckDate ?? ''} onChange={(e) => set('backgroundCheckDate', e.target.value || null)} className={IC} />}
          </div>
        </Section>
      )}

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-white/90 dark:bg-surface-dark-3/90 backdrop-blur border-t border-gray-100 dark:border-violet-900/40 flex items-center justify-between gap-3">
        <span className="text-xs text-amber-600 dark:text-amber-400 min-h-[1rem]">{dirty ? 'You have unsaved changes' : ''}</span>
        <div className="flex items-center gap-3">
          {dirty && <button type="button" onClick={() => { const f = toForm(q.data!.details); setForm(f); setErrors({}); }} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white">Discard</button>}
          <button type="submit" disabled={!dirty || disabled} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 active:scale-[0.98]">
            {disabled && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save details
          </button>
        </div>
      </div>
    </form>
  );
}
