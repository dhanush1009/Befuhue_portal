// Pure helpers for the company holiday calendar. No Prisma/React in here so the
// parsing rules the admin's "paste your list" box relies on are unit-tested.
//
// Day keys are 'yyyy-MM-dd' strings (the IST calendar day). A Holiday row stores
// its date at noon-UTC of that day, like Attendance.date, so the UTC date portion
// of the stored value *is* the day key.

export interface ParsedHoliday { date: string; name: string; note: string | null }
export interface ParseError    { line: number; text: string; message: string }
export interface ParseResult   { rows: ParsedHoliday[]; errors: ParseError[]; duplicates: string[] }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;

export function toDayKey(y: number, m: number, d: number): string | null {
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // e.g. 31 Feb
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** The 'yyyy-MM-dd' a stored holiday Date represents. */
export function holidayDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Stored form of a day key: noon UTC, like Attendance.date. */
export function holidayStoredDate(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

function monthIndex(word: string): number {
  return MONTHS.indexOf(word.slice(0, 3).toLowerCase()) + 1; // 0 when not a month
}

function fullYear(y: string, fallback: number): number {
  if (!y) return fallback;
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

// Each pattern is a source without anchors so it can be tried at the start or the end of a line.
// Groups are resolved by `resolve`, which returns a day key or null.
interface DatePattern { source: string; resolve: (g: string[], defaultYear: number) => string | null }

const PATTERNS: DatePattern[] = [
  // 2026-11-08  /  2026/11/08
  { source: '(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})', resolve: (g) => toDayKey(+g[1], +g[2], +g[3]) },
  // 08/11/2026  08-11-2026  08.11.26 — day first, the Indian convention
  { source: '(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4}|\\d{2})', resolve: (g, y) => toDayKey(fullYear(g[3], y), +g[2], +g[1]) },
  // 8 Nov 2026  /  8th November  /  08-Nov-2026
  { source: '(\\d{1,2})(?:st|nd|rd|th)?[\\s-]+([A-Za-z]{3,9})\\.?,?(?:[\\s-]+(\\d{4}))?', resolve: (g, y) => {
      const m = monthIndex(g[2]); return m ? toDayKey(fullYear(g[3] ?? '', y), m, +g[1]) : null;
  } },
  // Nov 8, 2026  /  November 8th
  { source: '([A-Za-z]{3,9})\\.?[\\s-]+(\\d{1,2})(?:st|nd|rd|th)?(?:,?[\\s-]+(\\d{4}))?(?!\\d)', resolve: (g, y) => {
      const m = monthIndex(g[1]); return m ? toDayKey(fullYear(g[3] ?? '', y), m, +g[2]) : null;
  } },
];

function matchDate(text: string, defaultYear: number): { key: string | null; rest: string } | null {
  for (const p of PATTERNS) {
    // date at the start of the line…
    const start = new RegExp(`^\\s*${p.source}`).exec(text);
    if (start) {
      const key = p.resolve(start, defaultYear);
      if (key) return { key, rest: text.slice(start[0].length) };
    }
  }
  for (const p of PATTERNS) {
    // …or at the end ("Diwali - 8 Nov 2026")
    const end = new RegExp(`${p.source}\\s*$`).exec(text);
    if (end) {
      const key = p.resolve(end, defaultYear);
      if (key) return { key, rest: text.slice(0, end.index) };
    }
  }
  // Something date-shaped that isn't a real date (e.g. 31/02/2026)
  const looksLikeDate = PATTERNS.some((p) => new RegExp(`^\\s*${p.source}`).test(text));
  return looksLikeDate ? { key: null, rest: text } : null;
}

const LEADING_JUNK  = /^[\s,;:|\t–—-]+/;
const TRAILING_JUNK = /[\s,;:|\t–—-]+$/;
const HEADER        = /^\s*"?(date|day)"?\s*[,;\t|]\s*"?(holiday|name|occasion|festival|description)/i;

function splitQuoted(rest: string): string[] {
  // "Diwali, Deepavali" stays one column; otherwise split on tab / pipe / comma / semicolon.
  const cols: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of rest) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (!quoted && (ch === ',' || ch === '\t' || ch === '|' || ch === ';')) { cols.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur);
  return cols.map((c) => c.trim()).filter(Boolean);
}

/**
 * Turns pasted text (or a CSV) into holidays. One holiday per line, date first or last:
 *   2026-11-08, Diwali            08/11/2026  Diwali           8 Nov 2026 - Diwali
 *   Jan 14, Pongal                Diwali - 8 Nov 2026          15-Jan-2027<TAB>Pongal<TAB>Harvest festival
 * A third column becomes the note. Lines without a year use `defaultYear`.
 */
export function parseHolidayText(text: string, defaultYear: number): ParseResult {
  const rows = new Map<string, ParsedHoliday>();
  const errors: ParseError[] = [];
  const duplicates: string[] = [];

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || HEADER.test(trimmed)) return;

    const m = matchDate(trimmed, defaultYear);
    if (!m) { errors.push({ line, text: trimmed, message: 'Could not find a date on this line' }); return; }
    if (!m.key) { errors.push({ line, text: trimmed, message: 'That is not a real calendar date' }); return; }

    const cols = splitQuoted(m.rest.replace(LEADING_JUNK, '').replace(TRAILING_JUNK, ''));
    // A bare " - " between date and name is a separator, not part of the name.
    const name = (cols[0] ?? '').replace(LEADING_JUNK, '').replace(TRAILING_JUNK, '');
    const note = cols.length > 1 ? cols.slice(1).join(', ') : null;

    if (name.length < 2) { errors.push({ line, text: trimmed, message: 'Add a name for this holiday' }); return; }
    if (name.length > 80) { errors.push({ line, text: trimmed, message: 'Name is too long (max 80 characters)' }); return; }

    if (rows.has(m.key)) duplicates.push(m.key); // the later line wins
    rows.set(m.key, { date: m.key, name, note: note && note.length <= 200 ? note : note ? note.slice(0, 200) : null });
  });

  return { rows: [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)), errors, duplicates };
}

// ── Day counting ──────────────────────────────────────────────────────────────

/** Local 'yyyy-MM-dd' of a Date, matching how leave day-counting walks the calendar. */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function holidayKeySet(dates: Date[]): Set<string> {
  return new Set(dates.map(holidayDayKey));
}
