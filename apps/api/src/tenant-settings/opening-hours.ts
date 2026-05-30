import type { DayHours, DayKey, OpeningHours } from '@tabley/database';

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(s: string): boolean {
  return TIME_RE.test(s);
}

/**
 * Empty seed for the settings UI when a tenant has never configured hours.
 * Default to closed on every day so we never accidentally accept orders for a
 * tenant that hasn't reviewed its hours yet.
 */
export function emptyOpeningHours(): OpeningHours {
  const out: Partial<OpeningHours> = {};
  for (const d of DAY_KEYS) {
    out[d] = { closed: true, open: '09:00', close: '22:00' };
  }
  return out as OpeningHours;
}

/**
 * Map JS Date#getDay output (0=Sunday … 6=Saturday) onto our Monday-first keys.
 */
function jsDayToKey(jsDay: number): DayKey {
  // 0=Sun → 6; 1=Mon → 0; … 6=Sat → 5
  const idx = (jsDay + 6) % 7;
  return DAY_KEYS[idx]!;
}

/**
 * Decide whether a tenant is currently accepting orders.
 *
 * Strategy:
 *  - If no openingHours are configured at all we treat the restaurant as
 *    OPEN (don't punish tenants who haven't filled this in yet).
 *  - Otherwise we read the current weekday + time *in the tenant's timezone*
 *    via Intl.DateTimeFormat, which handles DST without any extra dep, then
 *    check the configured range for that day.
 *  - A range that wraps past midnight (e.g. open 18:00 → close 02:00) is
 *    handled by the `close < open` branch.
 */
export function isOpenNow(args: {
  openingHours: OpeningHours | null;
  timezone: string | null;
  now?: Date;
}): { open: boolean; reason?: 'no_hours_today' | 'before_open' | 'after_close' } {
  if (!args.openingHours) {
    // Not configured → don't block orders.
    return { open: true };
  }
  const tz = args.timezone || 'UTC';
  const now = args.now ?? new Date();

  // Use Intl to extract weekday + hour:minute *in the tenant timezone*. This
  // is the cheapest correct way to do tz math in Node without moment/luxon.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  // weekday is 'Mon', 'Tue', …
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';

  const weekdayMap: Record<string, DayKey> = {
    Mon: 'mon',
    Tue: 'tue',
    Wed: 'wed',
    Thu: 'thu',
    Fri: 'fri',
    Sat: 'sat',
    Sun: 'sun',
  };
  const todayKey = weekdayMap[weekday] ?? jsDayToKey(now.getDay());
  const today: DayHours | undefined = args.openingHours[todayKey];
  if (!today || today.closed) {
    return { open: false, reason: 'no_hours_today' };
  }
  if (!isValidTime(today.open) || !isValidTime(today.close)) {
    return { open: false, reason: 'no_hours_today' };
  }

  const cur = `${hour}:${minute}`;
  // Compare as zero-padded HH:MM strings — lexicographic order matches time
  // order because both fields are fixed-width.
  if (today.close > today.open) {
    if (cur < today.open) return { open: false, reason: 'before_open' };
    if (cur >= today.close) return { open: false, reason: 'after_close' };
    return { open: true };
  }
  // Wrap-past-midnight (open 18:00, close 02:00). Open from `open` to 24:00,
  // and from 00:00 to `close`.
  if (cur >= today.open || cur < today.close) return { open: true };
  return { open: false, reason: 'after_close' };
}
