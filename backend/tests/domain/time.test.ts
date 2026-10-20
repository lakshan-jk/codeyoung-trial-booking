import { describe, it, expect } from 'vitest';
import {
  viewInZone,
  dayWindowUtc,
  datesSpanningWindow,
  isValidTimezone,
  localDateOf,
} from '../../src/domain/time.js';

describe('viewInZone — DST-aware rendering', () => {
  it('shows EDT in summer and EST in winter for New York (same wall-clock noon)', () => {
    const summer = viewInZone(new Date('2025-07-01T16:00:00Z'), 'America/New_York');
    expect(summer.timeLabel).toBe('12:00 PM');
    expect(summer.abbreviation).toBe('EDT');

    const winter = viewInZone(new Date('2025-01-01T17:00:00Z'), 'America/New_York');
    expect(winter.timeLabel).toBe('12:00 PM');
    expect(winter.abbreviation).toBe('EST');
  });

  it('shows BST in summer and GMT in winter for London', () => {
    const summer = viewInZone(new Date('2025-07-01T11:00:00Z'), 'Europe/London');
    expect(summer.timeLabel).toBe('12:00 PM');
    expect(summer.abbreviation).toBe('BST');

    const winter = viewInZone(new Date('2025-01-01T12:00:00Z'), 'Europe/London');
    expect(winter.timeLabel).toBe('12:00 PM');
    expect(winter.abbreviation).toBe('GMT');
  });

  it('renders the India mentor zone as IST', () => {
    const v = viewInZone(new Date('2025-07-01T06:30:00Z'), 'Asia/Kolkata');
    expect(v.timeLabel).toBe('12:00 PM');
    expect(v.abbreviation).toBe('IST');
    expect(v.full).toContain('IST');
  });
});

describe('dayWindowUtc — DST transition days', () => {
  it('a normal NY day is exactly 24h wide', () => {
    const { startUtc, endUtc } = dayWindowUtc('2025-06-10', 'America/New_York');
    expect((endUtc.getTime() - startUtc.getTime()) / 3_600_000).toBe(24);
  });

  it('"spring forward" day (2025-03-09) in NY is only 23h wide', () => {
    const { startUtc, endUtc } = dayWindowUtc('2025-03-09', 'America/New_York');
    expect((endUtc.getTime() - startUtc.getTime()) / 3_600_000).toBe(23);
  });

  it('"fall back" day (2025-11-02) in NY is 25h wide', () => {
    const { startUtc, endUtc } = dayWindowUtc('2025-11-02', 'America/New_York');
    expect((endUtc.getTime() - startUtc.getTime()) / 3_600_000).toBe(25);
  });
});

describe('datesSpanningWindow', () => {
  it('a US-local day maps onto two India-local dates', () => {
    const { startUtc, endUtc } = dayWindowUtc('2025-06-10', 'America/New_York');
    const istDates = datesSpanningWindow(startUtc, endUtc, 'Asia/Kolkata');
    // NY midnight 2025-06-10 is 2025-06-10 09:30 IST; the day ends next IST morning.
    expect(istDates).toContain('2025-06-10');
    expect(istDates).toContain('2025-06-11');
  });
});

describe('helpers', () => {
  it('validates IANA zones and rejects fixed-offset pseudo-zones', () => {
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
    // Fixed-offset "zones" carry no DST rules — reject them.
    expect(isValidTimezone('UTC+5')).toBe(false);
  });

  it('does not add a spurious extra date when the window ends on local midnight', () => {
    // A full IST day window should span exactly one IST date.
    const { startUtc, endUtc } = dayWindowUtc('2025-06-10', 'Asia/Kolkata');
    expect(datesSpanningWindow(startUtc, endUtc, 'Asia/Kolkata')).toEqual(['2025-06-10']);
  });

  it('computes local calendar date for an instant', () => {
    // 2025-06-10 19:00Z is 2025-06-11 00:30 IST.
    expect(localDateOf(new Date('2025-06-10T19:00:00Z'), 'Asia/Kolkata')).toBe('2025-06-11');
  });
});
