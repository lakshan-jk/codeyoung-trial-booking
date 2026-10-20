import { connectDb, disconnectDb } from '../plugins/db.js';
import { env } from '../config/env.js';
import { Mentor } from '../models/Mentor.js';
import { Booking } from '../models/Booking.js';
import { MentorDayLoad } from '../models/MentorDayLoad.js';
import { MENTOR_SEED } from '../config/mentors.seed.js';
import { MENTOR_TIMEZONE } from '../config/constants.js';

/**
 * Reset and seed the database with the 10 trial-class mentors.
 * Bookings and day-load counters are cleared so the demo starts fresh.
 */
async function seed(): Promise<void> {
  await connectDb(env.mongoUri);

  await Promise.all([Mentor.deleteMany({}), Booking.deleteMany({}), MentorDayLoad.deleteMany({})]);

  await Mentor.insertMany(
    MENTOR_SEED.map((m) => ({
      name: m.name,
      email: m.email,
      timezone: MENTOR_TIMEZONE,
      workStartHour: m.workStartHour,
      workEndHour: m.workEndHour,
    })),
  );

  const count = await Mentor.countDocuments();
  // eslint-disable-next-line no-console
  console.info(`Seeded ${count} mentors (timezone: ${MENTOR_TIMEZONE}).`);

  await disconnectDb();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
