import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import { Mentor } from '../models/Mentor.js';
import { Booking } from '../models/Booking.js';
import { MentorDayLoad } from '../models/MentorDayLoad.js';
import { env } from '../config/env.js';
import {
  MAX_CLASSES_PER_MENTOR_PER_DAY,
  MIN_BOOKING_LEAD_MINUTES,
  SLOT_DURATION_MINUTES,
} from '../config/constants.js';
import { NoAvailabilityError, ValidationError } from '../domain/errors.js';
import { isValidTimezone, localDateOf, viewInZone } from '../domain/time.js';
import { mentorHasSlotAt } from '../domain/slots.js';
import { findAlternatives, type SlotView } from './availabilityService.js';
import type { ZonedTimeView } from '../domain/types.js';

export interface BookingRequest {
  parentName: string;
  parentEmail: string;
  parentTimezone: string;
  /** ISO-8601 UTC instant of the desired slot start. */
  slotStartUtc: string;
}

export interface BookingConfirmation {
  id: string;
  mentor: { name: string; timezone: string };
  classLink: string;
  /** Same instant, shown to each party in their own timezone. */
  parentView: { timezone: string; start: ZonedTimeView; end: ZonedTimeView };
  mentorView: { timezone: string; start: ZonedTimeView; end: ZonedTimeView };
}

const DUPLICATE_KEY = 11000;

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === DUPLICATE_KEY
  );
}

/**
 * Build a (dummy) class link for a booking — opens the in-app demo room. The
 * mentor name and the parent-local time are passed along so the room can greet
 * the parent with concrete context instead of a bare room id.
 */
function makeClassLink(mentorName: string, whenLabel: string): string {
  const params = new URLSearchParams({ with: mentorName, at: whenLabel });
  return `${env.classLinkBaseUrl}/${randomUUID()}?${params.toString()}`;
}

/**
 * Idempotently ensure a MentorDayLoad counter exists for this mentor/day, so the
 * in-transaction guarded increment can run against an existing document. Safe to
 * call concurrently: if another request creates the doc first, the resulting
 * duplicate-key error is benign and swallowed (the doc now exists either way).
 */
async function ensureDayLoadDoc(mentorId: unknown, date: string): Promise<void> {
  try {
    await MentorDayLoad.updateOne(
      { mentorId, date },
      { $setOnInsert: { mentorId, date, count: 0 } },
      { upsert: true },
    );
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }
}

/**
 * Book a trial class.
 *
 * Flow:
 *  1. Validate input and that the slot is far enough in the future.
 *  2. Find mentors whose working hours cover the slot ("eligible").
 *  3. Order them by current daily load (load-balancing / fairness).
 *  4. For each, try to atomically reserve capacity + create the booking inside a
 *     transaction. The guarded counter update and unique indexes guarantee that
 *     the 2-per-day cap and single-slot-per-mentor rule hold even when two
 *     parents book at nearly the same time.
 *  5. If no mentor can be assigned, throw NO_AVAILABILITY with alternative slots.
 */
export async function bookTrialClass(req: BookingRequest): Promise<BookingConfirmation> {
  const { parentName, parentEmail, parentTimezone } = req;

  if (!parentName?.trim()) throw new ValidationError('Parent name is required.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parentEmail ?? '')) {
    throw new ValidationError('A valid parent email is required.');
  }
  if (!isValidTimezone(parentTimezone)) {
    throw new ValidationError(`Unknown timezone: ${parentTimezone}`);
  }

  const start = DateTime.fromISO(req.slotStartUtc, { zone: 'utc' });
  if (!start.isValid) throw new ValidationError('slotStartUtc must be a valid ISO instant.');
  const startUtc = start.toJSDate();
  const endUtc = start.plus({ minutes: SLOT_DURATION_MINUTES }).toJSDate();
  const startMs = startUtc.getTime();

  const earliest = DateTime.utc().plus({ minutes: MIN_BOOKING_LEAD_MINUTES }).toJSDate();
  if (startMs < earliest.getTime()) {
    throw new ValidationError('That slot is in the past or too soon to book.');
  }

  // Mentors whose working hours cover this exact instant (shared eligibility rule).
  const mentors = await Mentor.find().lean();
  const eligible = mentors.filter((m) => mentorHasSlotAt(m, startUtc));

  if (eligible.length === 0) {
    throw await noAvailability(parentTimezone, startUtc, 'No mentor offers a class at this time.');
  }

  // Order by current load so we spread classes across mentors.
  const loads = await MentorDayLoad.find({
    mentorId: { $in: eligible.map((m) => m._id) },
  }).lean();
  const loadByKey = new Map(loads.map((l) => [`${String(l.mentorId)}|${l.date}`, l.count]));
  const candidates = [...eligible].sort((a, b) => {
    const da = loadByKey.get(`${String(a._id)}|${localDateOf(startUtc, a.timezone)}`) ?? 0;
    const db = loadByKey.get(`${String(b._id)}|${localDateOf(startUtc, b.timezone)}`) ?? 0;
    return da - db;
  });

  for (const mentor of candidates) {
    const mentorLocalDate = localDateOf(startUtc, mentor.timezone);
    const classLink = makeClassLink(mentor.name, viewInZone(startUtc, parentTimezone).full);

    // Make sure the day-load counter document EXISTS before the transaction.
    // Doing this here (not inside the txn with `upsert` + a `$lt` guard) avoids a
    // subtle anti-pattern: an upsert whose filter includes `count < MAX` cannot
    // tell "day is full" from "doc doesn't exist yet" — both miss the filter and
    // try to insert, which duplicate-keys under concurrency and would wrongly
    // bounce a parent off a mentor that still had capacity. With the doc
    // guaranteed to exist, the in-transaction increment below operates on a
    // single shared document, so concurrent bookings serialise cleanly.
    await ensureDayLoadDoc(mentor._id, mentorLocalDate);

    const session = await mongoose.startSession();
    try {
      let created: typeof Booking.prototype | undefined;
      await session.withTransaction(async () => {
        // Guarded increment on the EXISTING counter — no upsert. Returns null iff
        // the mentor is already at the daily cap. Concurrent increments on the
        // same document raise a write conflict, which withTransaction retries.
        const reserved = await MentorDayLoad.findOneAndUpdate(
          { mentorId: mentor._id, date: mentorLocalDate, count: { $lt: MAX_CLASSES_PER_MENTOR_PER_DAY } },
          { $inc: { count: 1 } },
          { new: true, session },
        );
        if (!reserved) {
          throw new NoAvailabilityError('Mentor is at capacity.');
        }
        const docs = await Booking.create(
          [
            {
              mentorId: mentor._id,
              mentorName: mentor.name,
              mentorTimezone: mentor.timezone,
              parentName: parentName.trim(),
              parentEmail: parentEmail.trim(),
              parentTimezone,
              slotStartUtc: startUtc,
              slotEndUtc: endUtc,
              mentorLocalDate,
              classLink,
            },
          ],
          { session },
        );
        created = docs[0];
      });

      if (created) {
        return toConfirmation(created, parentTimezone);
      }
    } catch (err) {
      // Mentor+slot already taken (unique-index duplicate key) or mentor at the
      // daily cap (NoAvailabilityError): the transaction rolled back — including
      // the capacity increment — so just try the next eligible mentor.
      if (isDuplicateKeyError(err) || err instanceof NoAvailabilityError) {
        continue;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  // Every eligible mentor was busy or full.
  throw await noAvailability(
    parentTimezone,
    startUtc,
    'All mentors are booked for this time. Here are the nearest available slots.',
  );
}

async function noAvailability(
  parentTimezone: string,
  aroundUtc: Date,
  message: string,
): Promise<NoAvailabilityError> {
  const alternatives: SlotView[] = await findAlternatives(parentTimezone, aroundUtc);
  return new NoAvailabilityError(message, { alternatives });
}

function toConfirmation(booking: typeof Booking.prototype, parentTimezone: string): BookingConfirmation {
  const startUtc: Date = booking.slotStartUtc;
  const endUtc: Date = booking.slotEndUtc;
  return {
    id: String(booking._id),
    mentor: { name: booking.mentorName, timezone: booking.mentorTimezone },
    classLink: booking.classLink,
    parentView: {
      timezone: parentTimezone,
      start: viewInZone(startUtc, parentTimezone),
      end: viewInZone(endUtc, parentTimezone),
    },
    mentorView: {
      timezone: booking.mentorTimezone,
      start: viewInZone(startUtc, booking.mentorTimezone),
      end: viewInZone(endUtc, booking.mentorTimezone),
    },
  };
}
