import { DateTime } from 'luxon';
import { SLOT_DURATION_MINUTES } from '../config/constants.js';
import { localDateOf } from './time.js';
import type { MentorSchedule, MentorSlot } from './types.js';

/**
 * Generate a mentor's bookable slots for one of THEIR local calendar days.
 *
 * Working hours are [workStartHour, workEndHour) in the mentor's zone. Slots are
 * SLOT_DURATION_MINUTES long and start on the hour. Each start is built from a
 * zoned wall-clock time and converted to UTC, so the logic is zone-agnostic.
 * Mentors are in India (no DST today), but if a mentor were in a DST zone we
 * skip wall-clock hours that do not exist on a "spring forward" day — Luxon would
 * otherwise silently roll a non-existent 2:00 AM to 3:00 AM, creating a duplicate
 * slot. Ambiguous "fall back" hours resolve to their first occurrence.
 */
export function generateMentorDaySlots(
  mentor: MentorSchedule,
  mentorLocalDate: string,
): MentorSlot[] {
  const slots: MentorSlot[] = [];
  const stepHours = SLOT_DURATION_MINUTES / 60;

  for (let hour = mentor.workStartHour; hour + stepHours <= mentor.workEndHour; hour += stepHours) {
    const start = DateTime.fromISO(mentorLocalDate, { zone: mentor.timezone }).set({
      hour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    // Skip invalid starts and non-existent wall-clock hours (DST spring-forward),
    // which Luxon reports by shifting the realized hour away from the requested one.
    if (!start.isValid || start.hour !== hour) continue;
    const end = start.plus({ minutes: SLOT_DURATION_MINUTES });
    slots.push({
      startUtc: start.toUTC().toJSDate(),
      endUtc: end.toUTC().toJSDate(),
      mentorLocalDate,
    });
  }
  return slots;
}

/**
 * Generate a mentor's slots across several local dates and keep only those whose
 * START instant falls within [windowStartUtc, windowEndUtc). Used to collect the
 * slots that land on a given PARENT-local day (which may straddle two mentor
 * local days).
 */
export function generateMentorSlotsInWindow(
  mentor: MentorSchedule,
  mentorLocalDates: string[],
  windowStartUtc: Date,
  windowEndUtc: Date,
): MentorSlot[] {
  return mentorLocalDates
    .flatMap((date) => generateMentorDaySlots(mentor, date))
    .filter(
      (slot) =>
        slot.startUtc.getTime() >= windowStartUtc.getTime() &&
        slot.startUtc.getTime() < windowEndUtc.getTime(),
    );
}

/**
 * Does this mentor offer a slot that starts at exactly `instant`? Single source
 * of truth for slot eligibility, shared by availability and booking so the two
 * can never drift apart.
 */
export function mentorHasSlotAt(mentor: MentorSchedule, instant: Date): boolean {
  const localDate = localDateOf(instant, mentor.timezone);
  return generateMentorDaySlots(mentor, localDate).some(
    (slot) => slot.startUtc.getTime() === instant.getTime(),
  );
}
