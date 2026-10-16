// Number formatting shared by the dashboards. Indian digit grouping for INR; compact (1.2K, 3.4M) for tiles.

export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${trim(n / 1e7)}Cr`;   // crore
  if (abs >= 1e5) return `${trim(n / 1e5)}L`;    // lakh
  if (abs >= 1e3) return `${trim(n / 1e3)}K`;
  return trim(n);
}

function trim(n: number): string {
  const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return String(r);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', AUD: 'A$', CAD: 'C$', SGD: 'S$' };

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? `${code} `;
}

/** 12345.6 + INR → ₹12,346 ; compact → ₹12.3K. Small amounts keep their paise/cents. */
export function formatMoney(n: number | null, currency: string, compact = false): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const sym = currencySymbol(currency);
  if (compact) return `${sym}${formatCompact(n)}`;
  const digits = Math.abs(n) < 100 ? 2 : 0;
  return `${sym}${new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)}`;
}

export function formatPct(n: number | null, digits = 1): string {
  return n === null || !Number.isFinite(n) ? '—' : `${n.toFixed(digits)}%`;
}

export function formatDelta(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(Math.abs(n) >= 100 ? 0 : 1)}%`;
}

/** Round a chart's top value up to a "nice" number (1, 2, 5 × 10^n) so gridlines read cleanly. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  const f = v / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * base;
}
