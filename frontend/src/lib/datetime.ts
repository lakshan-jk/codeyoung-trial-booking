import { DateTime } from 'luxon';

/**
 * The browser's IANA timezone, e.g. "America/New_York". Falls back to UTC (a
 * neutral, unambiguous default) if the browser doesn't report one — the user can
 * always correct it with the timezone picker.
 */
export function detectTimezone(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  // Normalize common legacy aliases to their canonical IANA id so the detected
  // zone matches our curated options (e.g. no stray "Asia/Calcutta (detected)").
  const aliases: Record<string, string> = {
    'Asia/Calcutta': 'Asia/Kolkata',
    'Asia/Katmandu': 'Asia/Kathmandu',
    'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  };
  return aliases[tz] ?? tz;
}

/** Today's date (yyyy-MM-dd) in the given timezone — the default booking date. */
export function todayInZone(timezone: string): string {
  return DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');
}

/** Clamp helper: the min date the user may pick (today in their zone). */
export function minDate(timezone: string): string {
  return todayInZone(timezone);
}

/** Friendly heading for a date in a zone, e.g. "Wednesday, 21 Oct 2026". */
export function headingForDate(dateIso: string, timezone: string): string {
  return DateTime.fromISO(dateIso, { zone: timezone }).toFormat('cccc, dd LLL yyyy');
}

/** Group slots by a coarse period for nicer visual grouping. */
export function periodOf(timeLabel: string): 'Morning' | 'Afternoon' | 'Evening' {
  const isPm = timeLabel.includes('PM');
  const hour = Number(timeLabel.split(':')[0]);
  const h24 = isPm ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
  if (h24 < 12) return 'Morning';
  if (h24 < 17) return 'Afternoon';
  return 'Evening';
}
