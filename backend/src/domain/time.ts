import { DateTime } from 'luxon';
import type { ZonedTimeView } from './types.js';

/**
 * Timezone & DST helpers.
 *
 * Design rule: absolute instants are the source of truth (UTC `Date`). Every
 * conversion to a wall-clock time goes through Luxon with a real IANA zone, so
 * Daylight Saving Time is handled automatically — we never add fixed offsets.
 */

/**
 * Is this a real IANA timezone (e.g. "America/New_York")? We also accept UTC, but
 * reject fixed-offset pseudo-zones like "UTC+5" / "GMT-3" — those don't carry DST
 * rules, which would defeat the whole point of the scheduling logic.
 */
export function isValidTimezone(zone: string): boolean {
  const dt = DateTime.local().setZone(zone);
  return dt.isValid && (dt.zone.type === 'iana' || zone.toUpperCase() === 'UTC');
}

/**
 * Curated [standard, daylight] abbreviations for the zones we support. The
 * platform's Intl data is inconsistent here — US zones resolve to EST/EDT etc.,
 * but London/Kolkata often fall back to "GMT+1"/"GMT+5:30". We pick the
 * DST-correct label ourselves and fall back to the offset form for any other
 * zone (still unambiguous).
 */
const ZONE_ABBREVIATIONS: Record<string, [standard: string, daylight: string]> = {
  'America/New_York': ['EST', 'EDT'],
  'America/Chicago': ['CST', 'CDT'],
  'America/Denver': ['MST', 'MDT'],
  'America/Phoenix': ['MST', 'MST'], // Arizona does not observe DST
  'America/Los_Angeles': ['PST', 'PDT'],
  'Europe/London': ['GMT', 'BST'],
  'Asia/Kolkata': ['IST', 'IST'], // India has no DST
  'Asia/Calcutta': ['IST', 'IST'], // legacy alias some browsers still report
};

function abbreviationFor(dt: DateTime): string {
  const entry = dt.zoneName ? ZONE_ABBREVIATIONS[dt.zoneName] : undefined;
  if (entry) return dt.isInDST ? entry[1] : entry[0];
  return dt.toFormat('ZZZZ'); // e.g. "GMT+1", "UTC-4"
}

/**
 * Describe an instant as seen in a given timezone, including the DST-aware
 * abbreviation (EST vs EDT, GMT vs BST, …). Used for both API responses and
 * the email/notification payloads so displays are never ambiguous.
 */
export function viewInZone(instant: Date, timezone: string): ZonedTimeView {
  const dt = DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(timezone);
  const dateLabel = dt.toFormat('ccc, dd LLL yyyy');
  const timeLabel = dt.toFormat('h:mm a');
  const abbreviation = abbreviationFor(dt);
  return {
    iso: instant.toISOString(),
    timezone,
    dateLabel,
    timeLabel,
    abbreviation,
    full: `${dateLabel}, ${timeLabel} ${abbreviation}`,
  };
}

/**
 * The UTC instants bounding a calendar day in a given timezone.
 * e.g. "2025-10-20" in America/New_York → [04:00Z that day, 04:00Z next day)
 * (and the width is 23h/25h on DST-transition days, which is exactly correct).
 */
export function dayWindowUtc(
  dateIso: string,
  timezone: string,
): { startUtc: Date; endUtc: Date } {
  const start = DateTime.fromISO(dateIso, { zone: timezone }).startOf('day');
  const end = start.plus({ days: 1 });
  return { startUtc: start.toUTC().toJSDate(), endUtc: end.toUTC().toJSDate() };
}

/**
 * All calendar dates (yyyy-MM-dd) in `timezone` that a UTC window touches.
 * A parent-local day can overlap two mentor-local (IST) days, so slot
 * generation must consider each.
 */
export function datesSpanningWindow(
  startUtc: Date,
  endUtc: Date,
  timezone: string,
): string[] {
  let cursor = DateTime.fromJSDate(startUtc, { zone: 'utc' })
    .setZone(timezone)
    .startOf('day');
  // The window is half-open [start, end); use the last instant strictly inside it
  // so a window ending exactly on local midnight doesn't add a spurious extra date.
  const last = DateTime.fromJSDate(new Date(endUtc.getTime() - 1), { zone: 'utc' })
    .setZone(timezone)
    .startOf('day');
  const dates: string[] = [];
  while (cursor <= last) {
    dates.push(cursor.toFormat('yyyy-MM-dd'));
    cursor = cursor.plus({ days: 1 });
  }
  return dates;
}

/** Mentor-local calendar date (yyyy-MM-dd) for an instant. */
export function localDateOf(instant: Date, timezone: string): string {
  return DateTime.fromJSDate(instant, { zone: 'utc' })
    .setZone(timezone)
    .toFormat('yyyy-MM-dd');
}
