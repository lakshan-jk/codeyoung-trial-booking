import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DateTime } from 'luxon';
import { startTestDb, stopTestDb, clearDb } from '../helpers/db.js';
import { Mentor } from '../../src/models/Mentor.js';
import { MentorDayLoad } from '../../src/models/MentorDayLoad.js';
import { getDayAvailability } from '../../src/services/availabilityService.js';

const IST = 'Asia/Kolkata';
// 13:00–21:00 IST maps to 07:30Z–14:30Z, which lands on the SAME calendar date
// in New York — so the parent queries that date.
const DATE = DateTime.now().setZone(IST).plus({ days: 30 }).toFormat('yyyy-MM-dd');

async function createMentor() {
  const [m] = await Mentor.create([
    { name: 'Solo', email: 'solo@test.dev', timezone: IST, workStartHour: 13, workEndHour: 21 },
  ]);
  return m;
}

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearDb);

describe('getDayAvailability', () => {
  it('lists the mentor’s working slots for the day in the parent timezone', async () => {
    await createMentor();
    const { slots } = await getDayAvailability('America/New_York', DATE);
    expect(slots.length).toBe(8);
    expect(slots.every((s) => s.isAvailable)).toBe(true);
    // EDT or EST depending on where the +30d date lands relative to the DST change.
    expect(slots[0].start.abbreviation).toMatch(/^E[SD]T$/);
  });

  it('marks all of a mentor’s slots unavailable once their DAILY cap is reached, '
    + 'even for slots that were not individually booked', async () => {
    const mentor = await createMentor();
    // Simulate the mentor already having 2 classes that day via the authoritative
    // counter (no window bookings created). The old window-only count would have
    // missed this; the fix reads MentorDayLoad.
    await MentorDayLoad.create([{ mentorId: mentor._id, date: DATE, count: 2 }]);

    const { slots } = await getDayAvailability('America/New_York', DATE);
    expect(slots.length).toBe(8);
    expect(slots.every((s) => s.availableMentorCount === 0)).toBe(true);
    expect(slots.every((s) => !s.isAvailable)).toBe(true);
  });

  it('still shows availability when the mentor is below the cap', async () => {
    const mentor = await createMentor();
    await MentorDayLoad.create([{ mentorId: mentor._id, date: DATE, count: 1 }]);

    const { slots } = await getDayAvailability('America/New_York', DATE);
    expect(slots.every((s) => s.availableMentorCount === 1)).toBe(true);
  });
});
