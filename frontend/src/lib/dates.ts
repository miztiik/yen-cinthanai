// Date helpers - all UTC, ISO YYYY-MM-DD. The daily bank is UTC-keyed (loader + Stats +
// save all derive "today" from `new Date().toISOString().slice(0,10)`), so day navigation
// and the dated permalink stay device-clock-independent. Pure; no DOM. See
// docs/concepts/ui-shell.md (Route grammar).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's UTC calendar date, ISO. Matches the loader/Stats/save "today". */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True for a well-formed, real ISO UTC date string (YYYY-MM-DD). */
export function isIsoDate(s: string): boolean {
  return DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** ISO date n days from `date` (n may be negative), UTC. */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Short human label for a day, e.g. "Sun 29 Jun" (fixed en locale, UTC). */
export function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(d);
  const mon = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(d);
  return `${wd} ${d.getUTCDate()} ${mon}`;
}
