/**
 * Shared recurrence utility — weekday-anchored occurrence generation.
 *
 * All date arithmetic is done in SAST (UTC+2) regardless of server timezone,
 * so the server and browser always agree on which calendar day an occurrence falls on.
 *
 * Services recur on the same day of the week as the original installation date
 * (after normalising away weekends). The interval string (e.g. "30d") is rounded
 * to the nearest whole number of weeks so that the weekday is always preserved.
 *
 * Examples:
 *   "7d"  → 1 week  → same weekday every week
 *   "14d" → 2 weeks → same weekday every fortnight
 *   "30d" → 4 weeks → same weekday every ~month
 *   "60d" → 9 weeks → same weekday every ~2 months
 *   "90d" → 13 weeks → same weekday every ~quarter
 */

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000; // UTC+2

/**
 * Convert an interval string (e.g. "30d") to the nearest whole number of weeks.
 * Minimum is 1 week.
 */
export function getIntervalWeeks(intervalStr: string): number {
  const match = intervalStr.match(/^(\d+)d$/);
  if (!match) return 4;
  const days = parseInt(match[1], 10);
  return Math.max(1, Math.round(days / 7));
}

/**
 * Format a Date as a SAST YYYY-MM-DD string (timezone-stable, always UTC+2).
 */
function toSASTDateStr(d: Date): string {
  const sast = new Date(d.getTime() + SAST_OFFSET_MS);
  const y = sast.getUTCFullYear();
  const m = String(sast.getUTCMonth() + 1).padStart(2, "0");
  const day = String(sast.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Return midnight SAST for the calendar day represented by `d` in SAST,
 * expressed as a UTC Date object.
 *
 * e.g.  2026-04-16T22:00:00Z  (= 2026-04-17 00:00 SAST)
 *       → returns 2026-04-16T22:00:00Z  (midnight of April 17 SAST)
 */
function midnightSAST(d: Date): Date {
  const sast = new Date(d.getTime() + SAST_OFFSET_MS);
  // Strip time portion in SAST space, then convert back to UTC
  return new Date(
    Date.UTC(sast.getUTCFullYear(), sast.getUTCMonth(), sast.getUTCDate()) - SAST_OFFSET_MS
  );
}

/**
 * Day-of-week in SAST (0=Sun … 6=Sat).
 */
function getSASTDay(d: Date): number {
  const sast = new Date(d.getTime() + SAST_OFFSET_MS);
  return sast.getUTCDay();
}

/**
 * Normalize an anchor date so it never falls on a weekend (in SAST).
 * Saturday → Friday (shift back 1 day)
 * Sunday   → Monday (shift forward 1 day)
 * Weekdays → unchanged
 *
 * Returns a Date representing midnight SAST of the result day (as a UTC value).
 */
export function normalizeAnchorToWeekday(anchor: Date): Date {
  const base = midnightSAST(anchor);
  const day = getSASTDay(base);
  if (day === 6) {
    return new Date(base.getTime() - 24 * 60 * 60 * 1000); // Saturday → Friday
  } else if (day === 0) {
    return new Date(base.getTime() + 24 * 60 * 60 * 1000); // Sunday → Monday
  }
  return base;
}

/**
 * Generate all occurrence dates for a recurring service within an optional range.
 *
 * All comparisons are done in SAST so they are consistent between server and browser.
 *
 * @param anchor       The installation / base date (used as weekday anchor)
 * @param intervalStr  Interval string e.g. "30d"
 * @param options
 *   rangeStart    — only include dates on or after this date (compared as SAST day)
 *   rangeEnd      — stop generating after this date (compared as SAST day)
 *   endDate       — recurrence end_date from the pattern (also a hard stop)
 *   excludedDates — array of SAST ISO date strings (YYYY-MM-DD) to skip
 */
export function generateOccurrences(
  anchor: Date,
  intervalStr: string,
  options: {
    rangeStart?: Date;
    rangeEnd?: Date;
    endDate?: Date | null;
    excludedDates?: string[];
  } = {}
): Date[] {
  const { rangeStart, rangeEnd, endDate, excludedDates = [] } = options;
  const excludedSet = new Set(excludedDates.map(d => d.substring(0, 10)));

  const normalizedAnchor = normalizeAnchorToWeekday(anchor);
  const weeks = getIntervalWeeks(intervalStr);
  const stepMs = weeks * 7 * 24 * 60 * 60 * 1000;

  // Convert range bounds to SAST midnight for day-level comparison
  const rangeStartDay = rangeStart ? midnightSAST(rangeStart) : null;
  const rangeEndDay   = rangeEnd   ? midnightSAST(rangeEnd)   : null;

  const limit = rangeEndDay
    ? rangeEndDay
    : new Date(normalizedAnchor.getTime() + 365 * 24 * 60 * 60 * 1000);

  const occurrences: Date[] = [];
  let current = new Date(normalizedAnchor);

  while (current <= limit) {
    if (endDate && current > midnightSAST(endDate)) break;

    const inRange =
      (!rangeStartDay || current >= rangeStartDay) && current >= normalizedAnchor;

    const dateStr = toSASTDateStr(current);

    if (inRange && !excludedSet.has(dateStr)) {
      occurrences.push(new Date(current));
    }

    current = new Date(current.getTime() + stepMs);
  }

  return occurrences;
}

/**
 * Check whether a specific calendar day (in SAST) is a valid occurrence for a
 * recurring service. Used by the daily stock forecast modulo check.
 *
 * @param anchor       The installation / base date
 * @param intervalStr  Interval string e.g. "30d"
 * @param targetDay    The specific day to test
 * @param endDate      Optional recurrence end date
 */
export function isOccurrenceOnDay(
  anchor: Date,
  intervalStr: string,
  targetDay: Date,
  endDate?: Date | null
): boolean {
  const normalizedAnchor = normalizeAnchorToWeekday(anchor);
  const target = midnightSAST(targetDay);

  if (target < normalizedAnchor) return false;
  if (endDate && target > midnightSAST(endDate)) return false;

  const weeks = getIntervalWeeks(intervalStr);
  const stepDays = weeks * 7;

  const daysSinceAnchor = Math.round(
    (target.getTime() - normalizedAnchor.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceAnchor % stepDays === 0;
}
