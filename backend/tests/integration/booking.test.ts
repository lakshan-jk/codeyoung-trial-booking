import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DateTime } from 'luxon';
import { startTestDb, stopTestDb, clearDb } from '../helpers/db.js';
import { Mentor } from '../../src/models/Mentor.js';
import { Booking } from '../../src/models/Booking.js';
import { generateMentorDaySlots } from '../../src/domain/slots.js';
import { bookTrialClass } from '../../src/services/bookingService.js';
import { NoAvailabilityError } from '../../src/domain/errors.js';
import type { MentorSchedule } from '../../src/domain/types.js';

const IST = 'Asia/Kolkata';
// A date ~30 days out so every slot clears the "minimum lead time" check.
const FUTURE_DATE = DateTime.now().setZone(IST).plus({ days: 30 }).toFormat('yyyy-MM-dd');

const schedule: MentorSchedule = { timezone: IST, workStartHour: 13, workEndHour: 21 };

/** The ISO start of the Nth (0-based) slot on FUTURE_DATE for the given schedule. */
function slotIso(n: number): string {
  return generateMentorDaySlots(schedule, FUTURE_DATE)[n].startUtc.toISOString();
}

async function createMentors(names: string[]) {
  return Mentor.create(
    names.map((name) => ({
      name,
      email: `${name.toLowerCase()}@test.dev`,
      timezone: IST,
      workStartHour: schedule.workStartHour,
      workEndHour: schedule.workEndHour,
    })),
  );
}

const parent = (slotStartUtc: string) => ({
  parentName: 'Pat Parent',
  parentEmail: 'pat@parent.test',
  parentTimezone: 'America/New_York',
  slotStartUtc,
});

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearDb);

describe('bookTrialClass — happy path & time zones', () => {
  it('assigns a mentor and returns the slot in both parent and mentor zones', async () => {
    await createMentors(['Aarav']);
    const confirmation = await bookTrialClass(parent(slotIso(0)));

    expect(confirmation.mentor.name).toBe('Aarav');
    expect(confirmation.classLink).toMatch(/\/room\/[0-9a-f-]{36}\?/);
    expect(confirmation.parentView.timezone).toBe('America/New_York');
    expect(confirmation.mentorView.timezone).toBe(IST);
    // Same absolute instant, two labels.
    expect(confirmation.parentView.start.iso).toBe(confirmation.mentorView.start.iso);
    expect(confirmation.mentorView.start.abbreviation).toBe('IST');
  });
});

describe('bookTrialClass — daily capacity (max 2 per mentor)', () => {
  it('allows 2 classes for a mentor then reports no availability on a 3rd', async () => {
    await createMentors(['Solo']); // only one eligible mentor

    await bookTrialClass(parent(slotIso(0)));
    await bookTrialClass(parent(slotIso(1)));

    await expect(bookTrialClass(parent(slotIso(2)))).rejects.toBeInstanceOf(NoAvailabilityError);
    expect(await Booking.countDocuments()).toBe(2);
  });
});

describe('bookTrialClass — no double-booking the same slot', () => {
  it('a second parent for the same slot gets a different mentor', async () => {
    await createMentors(['A', 'B']);
    const slot = slotIso(0);

    const first = await bookTrialClass(parent(slot));
    const second = await bookTrialClass(parent(slot));

    expect(first.mentor.name).not.toBe(second.mentor.name);
    expect(await Booking.countDocuments()).toBe(2);
  });

  it('reports no availability when all mentors are taken for the slot', async () => {
    await createMentors(['A']);
    const slot = slotIso(0);
    await bookTrialClass(parent(slot));
    await expect(bookTrialClass(parent(slot))).rejects.toBeInstanceOf(NoAvailabilityError);
  });
});

describe('bookTrialClass — concurrency', () => {
  it('two simultaneous bookings for the same slot get two distinct mentors', async () => {
    await createMentors(['A', 'B']);
    const slot = slotIso(0);

    const results = await Promise.allSettled([
      bookTrialClass(parent(slot)),
      bookTrialClass(parent(slot)),
    ]);

    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(2);
    const mentors = new Set(ok.map((r) => (r as PromiseFulfilledResult<any>).value.mentor.name));
    expect(mentors.size).toBe(2); // no double assignment
    expect(await Booking.countDocuments()).toBe(2);
  });

  it('three simultaneous bookings with two mentors: exactly two succeed', async () => {
    await createMentors(['A', 'B']);
    const slot = slotIso(0);

    const results = await Promise.allSettled([
      bookTrialClass(parent(slot)),
      bookTrialClass(parent(slot)),
      bookTrialClass(parent(slot)),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await Booking.countDocuments()).toBe(2);
  });

  it('fresh-day race: 2 parallel bookings on one mentor for different slots BOTH succeed', async () => {
    // Regression guard: with the old upsert-with-$lt-guard pattern, two parallel
    // bookings on a day with no counter doc yet could both try to insert the
    // counter; the loser duplicate-keyed and was wrongly bounced to NO_AVAILABILITY
    // even though the mentor had capacity. Now both must succeed (count → 2).
    await createMentors(['Solo']);

    const results = await Promise.allSettled([
      bookTrialClass(parent(slotIso(0))),
      bookTrialClass(parent(slotIso(1))),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(await Booking.countDocuments()).toBe(2);
  });

  it('capacity holds under concurrency: 3 parallel bookings on one mentor cap at 2', async () => {
    await createMentors(['Solo']);

    const results = await Promise.allSettled([
      bookTrialClass(parent(slotIso(0))),
      bookTrialClass(parent(slotIso(1))),
      bookTrialClass(parent(slotIso(2))),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(await Booking.countDocuments()).toBe(2);
  });
});
