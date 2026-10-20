import { describe, it, expect } from 'vitest';
import { generateMentorDaySlots, generateMentorSlotsInWindow } from '../../src/domain/slots.js';
import { dayWindowUtc } from '../../src/domain/time.js';
import type { MentorSchedule } from '../../src/domain/types.js';

const mentor: MentorSchedule = {
  timezone: 'Asia/Kolkata',
  workStartHour: 13,
  workEndHour: 21,
};

describe('generateMentorDaySlots', () => {
  it('generates one 60-min slot per working hour', () => {
    const slots = generateMentorDaySlots(mentor, '2025-06-10');
    expect(slots).toHaveLength(8); // 13:00..20:00 inclusive
  });

  it('anchors slots to the correct UTC instants (IST = UTC+5:30, no DST)', () => {
    const slots = generateMentorDaySlots(mentor, '2025-06-10');
    // 13:00 IST == 07:30 UTC
    expect(slots[0].startUtc.toISOString()).toBe('2025-06-10T07:30:00.000Z');
    expect(slots[0].endUtc.toISOString()).toBe('2025-06-10T08:30:00.000Z');
    expect(slots[0].mentorLocalDate).toBe('2025-06-10');
  });

  it('never emits a slot that would run past working hours', () => {
    const slots = generateMentorDaySlots(mentor, '2025-06-10');
    const last = slots[slots.length - 1];
    // last start is 20:00 IST == 14:30 UTC, ends 21:00 IST == 15:30 UTC
    expect(last.startUtc.toISOString()).toBe('2025-06-10T14:30:00.000Z');
  });
});

describe('generateMentorSlotsInWindow', () => {
  it('keeps only slots whose start falls inside a parent-local day', () => {
    // A late-evening IST mentor; parent in New York picks 2025-06-10.
    const lateMentor: MentorSchedule = { timezone: 'Asia/Kolkata', workStartHour: 18, workEndHour: 23 };
    const { startUtc, endUtc } = dayWindowUtc('2025-06-10', 'America/New_York');
    const istDates = ['2025-06-10', '2025-06-11'];
    const slots = generateMentorSlotsInWindow(lateMentor, istDates, startUtc, endUtc);

    for (const s of slots) {
      expect(s.startUtc.getTime()).toBeGreaterThanOrEqual(startUtc.getTime());
      expect(s.startUtc.getTime()).toBeLessThan(endUtc.getTime());
    }
    expect(slots.length).toBeGreaterThan(0);
  });
});
