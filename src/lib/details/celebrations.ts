// Next time a yearly date (birthday, joining day) comes round, counted in India time.

const IST_MS = 5.5 * 60 * 60 * 1000;

/** Today's calendar date in IST as a UTC-midnight timestamp. */
function istToday(now: Date): number {
  const t = new Date(now.getTime() + IST_MS);
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

/** `source` is a day stored at noon UTC (as the portal does), so its month and day are read in UTC. */
export function nextOccurrence(source: Date, now: Date): { date: string; daysAway: number } {
  const today = istToday(now);
  const todayYear = new Date(today).getUTCFullYear();
  const m = source.getUTCMonth(), d = source.getUTCDate();
  // 29 Feb falls on 28 Feb in a non-leap year.
  const at = (year: number) => {
    const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
    return m === 1 && d === 29 && !leap ? Date.UTC(year, 1, 28) : Date.UTC(year, m, d);
  };
  let when = at(todayYear);
  if (when < today) when = at(todayYear + 1);
  return { date: new Date(when).toISOString().slice(0, 10), daysAway: Math.round((when - today) / 86_400_000) };
}
