import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { getDayAvailability } from '../services/availabilityService.js';
import { bookTrialClass } from '../services/bookingService.js';
import { sendBookingNotifications } from '../services/notificationService.js';
import { PARENT_TIMEZONES } from '../config/timezones.js';
import { MENTOR_TIMEZONE, MAX_CLASSES_PER_MENTOR_PER_DAY, SLOT_DURATION_MINUTES } from '../config/constants.js';
import { ValidationError } from '../domain/errors.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be yyyy-MM-dd')
  .refine((d) => DateTime.fromISO(d).isValid, 'date is not a real calendar date');

const availabilityQuery = z.object({
  timezone: z.string().min(1),
  date: isoDate,
});

const bookingBody = z.object({
  parentName: z.string().min(1).max(120),
  parentEmail: z.string().email(),
  parentTimezone: z.string().min(1),
  slotStartUtc: z.string().datetime({ offset: true }),
});

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({ status: 'ok' }));

  /** Config the frontend needs: timezone options + booking rules. */
  app.get('/api/config', async () => ({
    parentTimezones: PARENT_TIMEZONES,
    mentorTimezone: MENTOR_TIMEZONE,
    slotDurationMinutes: SLOT_DURATION_MINUTES,
    maxClassesPerMentorPerDay: MAX_CLASSES_PER_MENTOR_PER_DAY,
  }));

  /** Slots for a parent-local date, rendered in the parent's timezone. */
  app.get('/api/availability', async (request) => {
    const parsed = availabilityQuery.safeParse(request.query);
    if (!parsed.success) throw new ValidationError('Invalid query', parsed.error.flatten());
    const { timezone, date } = parsed.data;
    return getDayAvailability(timezone, date);
  });

  /** Create a booking — assigns an available mentor atomically. */
  app.post('/api/bookings', async (request, reply) => {
    const parsed = bookingBody.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Invalid booking', parsed.error.flatten());

    const confirmation = await bookTrialClass(parsed.data);
    sendBookingNotifications(confirmation);
    reply.code(201);
    return confirmation;
  });
}
