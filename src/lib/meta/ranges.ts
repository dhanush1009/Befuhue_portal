import { addDaysKey, fillDays } from './metrics';

// Date-range presets for the Meta screens. Pure (takes "today" as a day key), so they are tested.

export type RangePreset = 'last7' | 'last14' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'custom';

export const PRESET_LABELS: Record<Exclude<RangePreset, 'custom'>, string> = {
  last7: 'Last 7 days', last14: 'Last 14 days', last30: 'Last 30 days', last90: 'Last 90 days',
  thisMonth: 'This month', lastMonth: 'Last month',
};

function monthStart(key: string): string { return `${key.slice(0, 8)}01`; }

export function presetRange(preset: Exclude<RangePreset, 'custom'>, today: string): { from: string; to: string } {
  switch (preset) {
    case 'last7':  return { from: addDaysKey(today, -6),  to: today };
    case 'last14': return { from: addDaysKey(today, -13), to: today };
    case 'last30': return { from: addDaysKey(today, -29), to: today };
    case 'last90': return { from: addDaysKey(today, -89), to: today };
    case 'thisMonth': return { from: monthStart(today), to: today };
    case 'lastMonth': {
      const lastDayPrev = addDaysKey(monthStart(today), -1);
      return { from: monthStart(lastDayPrev), to: lastDayPrev };
    }
  }
}

/** "7 Oct – 13 Oct 2026" style label (UTC-safe: built from the keys, not Date objects in local time). */
export function rangeLabel(from: string, to: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const part = (k: string) => `${Number(k.slice(8, 10))} ${MONTHS[Number(k.slice(5, 7)) - 1]}`;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${part(from)}${sameYear ? '' : ` ${from.slice(0, 4)}`} – ${part(to)} ${to.slice(0, 4)}`;
}

export function dayCount(from: string, to: string): number {
  return fillDays(from, to).length;
}

/** Splits a long backfill into windows the sync endpoint accepts (it takes at most 31 days at a time). */
export function backfillWindows(from: string, to: string, maxDays = 31): { since: string; until: string }[] {
  const out: { since: string; until: string }[] = [];
  let start = from;
  while (start <= to) {
    const end = addDaysKey(start, maxDays - 1) < to ? addDaysKey(start, maxDays - 1) : to;
    out.push({ since: start, until: end });
    start = addDaysKey(end, 1);
  }
  return out;
}
