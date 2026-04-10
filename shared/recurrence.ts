/**
 * Shared recurrence utility — weekday-anchored occurrence generation.
 *
 * Services must always recur on the same day of the week as the original
 * installation date. The interval string (e.g. "30d") is rounded to the
 * nearest whole number of weeks so that the weekday is always preserved.
 *
 * Examples:
 *   "7d"  → 1 week  → same weekday every week
 *   "14d" → 2 weeks → same weekday every fortnight
 *   "30d" → 4 weeks → same weekday every ~month
 *   "60d" → 9 weeks → same weekday every ~2 months
 *   "90d" → 13 weeks → same weekday every ~quarter
 */

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
 * Normalize an anchor date so it never falls on a weekend.
 * Saturday → Friday (shift back 1 day)
 * Sunday   → Monday (shift forward 1 day)
 * Weekdays → unchanged
 *
 * Returns a new Date with time set to midnight (00:00:00.000).
 */
export function normalizeAnchorToWeekday(anchor: Date): Date {
  const result = new Date(anchor);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  if (day === 6) {
    result.setDate(result.getDate() - 1);
  } else if (day === 0) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * Generate all occurrence dates for a recurring service within an optional range.
 *
 * @param anchor       The installation / base date (used as weekday anchor)
 * @param intervalStr  Interval string e.g. "30d"
 * @param options
 *   rangeStart    — only include dates on or after this date
 *   rangeEnd      — stop generating after this date
 *   endDate       — recurrence end_date from the pattern (also a hard stop)
 *   excludedDates — array of ISO date strings (YYYY-MM-DD) to skip
 */
/** Format a Date as a local YYYY-MM-DD string (timezone-safe). */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

  const limit = rangeEnd
    ? new Date(rangeEnd)
    : new Date(normalizedAnchor.getTime() + 365 * 24 * 60 * 60 * 1000);

  const occurrences: Date[] = [];
  let current = new Date(normalizedAnchor);

  while (current <= limit) {
    if (endDate && current > endDate) break;

    const inRange =
      (!rangeStart || current >= rangeStart) && current >= normalizedAnchor;
    const dateStr = toLocalDateStr(current);

    if (inRange && !excludedSet.has(dateStr)) {
      occurrences.push(new Date(current));
    }

    current = new Date(current.getTime() + stepMs);
  }

  return occurrences;
}

/**
 * Check whether a specific calendar day is a valid occurrence for a recurring
 * service. Used by the daily stock forecast modulo check.
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

  const target = new Date(targetDay);
  target.setHours(0, 0, 0, 0);

  if (target < normalizedAnchor) return false;
  if (endDate && target > endDate) return false;

  const weeks = getIntervalWeeks(intervalStr);
  const stepDays = weeks * 7;

  const daysSinceAnchor = Math.round(
    (target.getTime() - normalizedAnchor.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceAnchor % stepDays === 0;
}
