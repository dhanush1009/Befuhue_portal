// Pure maths for Meta Ads data: turning Meta's "actions" lists into results, costs and
// comparisons. No network or database in here, so the rules are unit-tested.

export type ActionMap = Record<string, number>;

export interface MetricRow {
  spend:        number;
  impressions:  number;
  reach:        number;
  clicks:       number;
  linkClicks:   number;
  actions:      ActionMap;
  actionValues: ActionMap;
}

export const EMPTY_ROW: MetricRow = { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, actions: {}, actionValues: {} };

/** Meta sends `[{ action_type, value: "12" }]`; we keep `{ action_type: 12 }`. */
export function parseActions(list: { action_type: string; value: string | number }[] | null | undefined): ActionMap {
  const out: ActionMap = {};
  for (const a of list ?? []) {
    const n = Number(a.value);
    if (a.action_type && Number.isFinite(n)) out[a.action_type] = (out[a.action_type] ?? 0) + n;
  }
  return out;
}

export function mergeActions(a: ActionMap, b: ActionMap): ActionMap {
  const out: ActionMap = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

// ── What counts as a "result" ─────────────────────────────────────────────────
// Meta reports the same conversion under several names (e.g. a purchase as both `purchase` and
// `omni_purchase`), so within one type the FIRST name that is present wins - adding them would double count.

export interface ResultType { key: string; label: string; actions: string[] }

export const RESULT_TYPES: ResultType[] = [
  { key: 'purchases',          label: 'Purchases',          actions: ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'] },
  { key: 'leads',              label: 'Leads',              actions: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'] },
  { key: 'messages',           label: 'Messages started',   actions: ['onsite_conversion.messaging_conversation_started_7d'] },
  { key: 'registrations',      label: 'Registrations',      actions: ['omni_complete_registration', 'complete_registration'] },
  { key: 'add_to_cart',        label: 'Add to cart',        actions: ['omni_add_to_cart', 'add_to_cart'] },
  { key: 'checkouts',          label: 'Checkouts started',  actions: ['omni_initiated_checkout', 'initiate_checkout'] },
  { key: 'landing_page_views', label: 'Landing page views', actions: ['landing_page_view', 'omni_landing_page_view'] },
  { key: 'link_clicks',        label: 'Link clicks',        actions: ['link_click'] },
  { key: 'engagement',         label: 'Post engagement',    actions: ['post_engagement'] },
  { key: 'video_views',        label: 'Video views',        actions: ['video_view'] },
  { key: 'follows',            label: 'Page likes',         actions: ['like'] },
];

/** Used when an admin hasn't chosen: the most "valuable" result the account actually has. */
const AUTO_PRIORITY = ['purchases', 'leads', 'messages', 'registrations', 'link_clicks'];

const CUSTOM_PREFIX = 'offsite_conversion.custom.';

export function customKey(actionType: string): string | null {
  return actionType.startsWith(CUSTOM_PREFIX) ? `custom:${actionType.slice(CUSTOM_PREFIX.length)}` : null;
}

export function resultTypeOf(key: string): ResultType | undefined {
  return RESULT_TYPES.find((r) => r.key === key);
}

export function resultCount(actions: ActionMap, key: string): number {
  const type = resultTypeOf(key);
  if (type) {
    for (const a of type.actions) if (actions[a] !== undefined) return actions[a];
    return 0;
  }
  if (key.startsWith('custom:')) return actions[CUSTOM_PREFIX + key.slice('custom:'.length)] ?? 0;
  return actions[key] ?? 0; // any raw action_type
}

export function resultLabel(key: string, customNames: Record<string, string> = {}): string {
  const type = resultTypeOf(key);
  if (type) return type.label;
  if (key.startsWith('custom:')) return customNames[key.slice('custom:'.length)] ?? 'Custom conversion';
  return key.replace(/^offsite_conversion\./, '').replace(/[_.]/g, ' ');
}

export function detectResultKey(actions: ActionMap): string {
  for (const key of AUTO_PRIORITY) if (resultCount(actions, key) > 0) return key;
  return 'link_clicks';
}

/** Every result type with a non-zero count, plus custom conversions - for the "all results" panel. */
export function allResults(actions: ActionMap, customNames: Record<string, string> = {}): { key: string; label: string; count: number }[] {
  const out: { key: string; label: string; count: number }[] = [];
  for (const t of RESULT_TYPES) {
    const count = resultCount(actions, t.key);
    if (count > 0) out.push({ key: t.key, label: t.label, count });
  }
  for (const [type, value] of Object.entries(actions)) {
    const key = customKey(type);
    if (key && value > 0) out.push({ key, label: resultLabel(key, customNames), count: value });
  }
  return out.sort((a, b) => b.count - a.count);
}

export function purchaseValue(actionValues: ActionMap): number {
  const type = resultTypeOf('purchases')!;
  for (const a of type.actions) if (actionValues[a] !== undefined) return actionValues[a];
  return 0;
}

// ── Totals ────────────────────────────────────────────────────────────────────

export interface Totals {
  spend: number; impressions: number; reach: number; clicks: number; linkClicks: number;
  ctr: number; cpc: number | null; cpm: number | null; frequency: number | null;
  resultKey: string; results: number; costPerResult: number | null;
  purchaseValue: number; roas: number | null;
  actions: ActionMap; actionValues: ActionMap;
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function sumRows(rows: MetricRow[]): MetricRow {
  const out: MetricRow = { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, actions: {}, actionValues: {} };
  for (const r of rows) {
    out.spend += r.spend; out.impressions += r.impressions; out.reach += r.reach;
    out.clicks += r.clicks; out.linkClicks += r.linkClicks;
    out.actions = mergeActions(out.actions, r.actions);
    out.actionValues = mergeActions(out.actionValues, r.actionValues);
  }
  return out;
}

/** `resultKey` null = automatic (detected from the rows' own actions). */
export function summarize(rows: MetricRow[], resultKey: string | null = null): Totals {
  const t = sumRows(rows);
  const key = resultKey ?? detectResultKey(t.actions);
  const results = resultCount(t.actions, key);
  const pv = purchaseValue(t.actionValues);
  return {
    ...t,
    ctr:           t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
    cpc:           div(t.spend, t.clicks),
    cpm:           t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null,
    frequency:     div(t.impressions, t.reach),
    resultKey:     key,
    results,
    costPerResult: div(t.spend, results),
    purchaseValue: pv,
    roas:          t.spend > 0 && pv > 0 ? pv / t.spend : null,
  };
}

// ── Comparing periods ─────────────────────────────────────────────────────────

export function deltaPct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** For costs, down is good; for volume and revenue, up is good. */
export const LOWER_IS_BETTER: ReadonlySet<string> = new Set(['cpc', 'cpm', 'costPerResult', 'frequency']);

export function isGood(metric: string, delta: number | null): boolean | null {
  if (delta === null || delta === 0) return null;
  return LOWER_IS_BETTER.has(metric) ? delta < 0 : delta > 0;
}

function utcDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}
function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDaysKey(key: string, n: number): string {
  const d = utcDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
}

/** Every day from `from` to `to`, inclusive. */
export function fillDays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDaysKey(k, 1)) {
    out.push(k);
    if (out.length > 800) break; // a guard against a runaway range
  }
  return out;
}

/** The period of the same length immediately before [from, to]. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const length = fillDays(from, to).length;
  return { from: addDaysKey(from, -length), to: addDaysKey(from, -1) };
}

export interface SeriesPoint {
  date: string; spend: number; impressions: number; clicks: number; reach: number; results: number;
}

/** One point per day (zeros for days with no data) so charts have a continuous axis. */
export function buildSeries(byDate: Map<string, MetricRow>, from: string, to: string, resultKey: string): SeriesPoint[] {
  return fillDays(from, to).map((date) => {
    const r = byDate.get(date);
    return {
      date,
      spend:       r?.spend ?? 0,
      impressions: r?.impressions ?? 0,
      clicks:      r?.clicks ?? 0,
      reach:       r?.reach ?? 0,
      results:     r ? resultCount(r.actions, resultKey) : 0,
    };
  });
}

export const isDayKey = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(utcDate(v).getTime()) && keyOf(utcDate(v)) === v;
