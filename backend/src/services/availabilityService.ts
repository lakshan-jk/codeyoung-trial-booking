import { DateTime } from 'luxon';
import { Mentor } from '../models/Mentor.js';
import { Booking } from '../models/Booking.js';
import { MentorDayLoad } from '../models/MentorDayLoad.js';
import {
  MAX_ALTERNATIVES,
  MAX_BOOKING_HORIZON_DAYS,
  MAX_CLASSES_PER_MENTOR_PER_DAY,
  MIN_BOOKING_LEAD_MINUTES,
} from '../config/constants.js';
import { ValidationError } from '../domain/errors.js';
import {
  dayWindowUtc,
  datesSpanningWindow,
  isValidTimezone,
  viewInZone,
} from '../domain/time.js';
import { generateMentorSlotsInWindow } from '../domain/slots.js';
import type { MentorSlot, ZonedTimeView } from '../domain/types.js';

/** A slot as presented to a parent, in the parent's own timezone. */
export interface SlotView {
  startUtc: string;
  endUtc: string;
  /** Slot start/end rendered in the parent's timezone (DST-aware). */
  start: ZonedTimeView;
  end: ZonedTimeView;
  /** How many mentors could still take this slot right now. */
  availableMentorCount: number;
  isAvailable: boolean;
}

interface SlotComputation {
  slot: MentorSlot;
  availableMentorCount: number;
}

/** Earliest instant a parent is allowed to book (now + lead time). */
function earliestBookableInstant(): Date {
  return DateTime.utc().plus({ minutes: MIN_BOOKING_LEAD_MINUTES }).toJSDate();
}

/**
 * Core availability computation shared by day-availability and alternatives.
 * Pulls every mentor's slots in the window, then subtracts slots that are
 * already booked or that would exceed a mentor's daily cap.
 */
async function computeSlotsInWindow(
  windowStartUtc: Date,
  windowEndUtc: Date,
): Promise<SlotComputation[]> {
  const mentors = await Mentor.find().lean();

  // Generate every mentor's candidate slots in the window up front. We also note
  // the mentor-local dates touched, so we can look up authoritative daily loads.
  const slotsByMentor = new Map<string, ReturnType<typeof generateMentorSlotsInWindow>>();
  const localDateSet = new Set<string>();
  for (const mentor of mentors) {
    const localDates = datesSpanningWindow(windowStartUtc, windowEndUtc, mentor.timezone);
    const slots = generateMentorSlotsInWindow(mentor, localDates, windowStartUtc, windowEndUtc);
    slotsByMentor.set(String(mentor._id), slots);
    for (const d of localDates) localDateSet.add(d);
  }

  // Existing bookings overlapping the window — used to mark mentors busy for a
  // SPECIFIC slot (slot-conflict detection).
  const bookings = await Booking.find({
    slotStartUtc: { $gte: windowStartUtc, $lt: windowEndUtc },
  }).lean();
  const bookedSlotByMentor = new Map<string, Set<number>>(); // mentorId -> set(startMs)
  for (const b of bookings) {
    const mid = String(b.mentorId);
    if (!bookedSlotByMentor.has(mid)) bookedSlotByMentor.set(mid, new Set());
    bookedSlotByMentor.get(mid)!.add(b.slotStartUtc.getTime());
  }

  // Authoritative per-mentor, per-day load (the same counter the booking service
  // enforces the cap with). Counting bookings only inside the window would
  // undercount a mentor whose other class that day falls outside the window.
  const loads = await MentorDayLoad.find({ date: { $in: [...localDateSet] } }).lean();
  const loadByMentorDay = new Map<string, number>(); // `${mentorId}|${date}` -> count
  for (const l of loads) {
    loadByMentorDay.set(`${String(l.mentorId)}|${l.date}`, l.count);
  }

  // Aggregate availability per distinct slot-start instant across all mentors.
  const byStart = new Map<number, SlotComputation>();
  for (const mentor of mentors) {
    const mid = String(mentor._id);
    const slots = slotsByMentor.get(mid) ?? [];

    for (const slot of slots) {
      const startMs = slot.startUtc.getTime();
      const alreadyBooked = bookedSlotByMentor.get(mid)?.has(startMs) ?? false;
      const dayLoad = loadByMentorDay.get(`${mid}|${slot.mentorLocalDate}`) ?? 0;
      const mentorAvailable = !alreadyBooked && dayLoad < MAX_CLASSES_PER_MENTOR_PER_DAY;

      const existing = byStart.get(startMs);
      if (existing) {
        if (mentorAvailable) existing.availableMentorCount += 1;
      } else {
        byStart.set(startMs, { slot, availableMentorCount: mentorAvailable ? 1 : 0 });
      }
    }
  }

  return [...byStart.values()].sort(
    (a, b) => a.slot.startUtc.getTime() - b.slot.startUtc.getTime(),
  );
}

function toSlotView(computation: SlotComputation, parentTimezone: string): SlotView {
  const { slot, availableMentorCount } = computation;
  return {
    startUtc: slot.startUtc.toISOString(),
    endUtc: slot.endUtc.toISOString(),
    start: viewInZone(slot.startUtc, parentTimezone),
    end: viewInZone(slot.endUtc, parentTimezone),
    availableMentorCount,
    isAvailable: availableMentorCount > 0,
  };
}

/**
 * All slots on a given parent-local calendar date, in the parent's timezone.
 * Past slots (before the booking lead time) are excluded.
 */
export async function getDayAvailability(
  parentTimezone: string,
  dateIso: string,
): Promise<{ date: string; timezone: string; slots: SlotView[] }> {
  if (!isValidTimezone(parentTimezone)) {
    throw new ValidationError(`Unknown timezone: ${parentTimezone}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    throw new ValidationError(`Date must be yyyy-MM-dd, got: ${dateIso}`);
  }

  // Keep requests within a sane booking horizon so the slot fan-out stays bounded.
  const today = DateTime.now().setZone(parentTimezone).startOf('day');
  const requested = DateTime.fromISO(dateIso, { zone: parentTimezone }).startOf('day');
  const daysAhead = requested.diff(today, 'days').days;
  if (daysAhead < 0 || daysAhead > MAX_BOOKING_HORIZON_DAYS) {
    throw new ValidationError(
      `Please pick a date between today and ${MAX_BOOKING_HORIZON_DAYS} days from now.`,
    );
  }

  const { startUtc, endUtc } = dayWindowUtc(dateIso, parentTimezone);
  const earliest = earliestBookableInstant();

  const computations = await computeSlotsInWindow(startUtc, endUtc);
  const slots = computations
    .filter((c) => c.slot.startUtc.getTime() >= earliest.getTime())
    .map((c) => toSlotView(c, parentTimezone));

  return { date: dateIso, timezone: parentTimezone, slots };
}

/**
 * The nearest AVAILABLE slots around a target instant, searching forward over a
 * few days. Used to guide the parent when their chosen slot is full.
 */
export async function findAlternatives(
  parentTimezone: string,
  aroundUtc: Date,
  limit = MAX_ALTERNATIVES,
): Promise<SlotView[]> {
  const earliest = earliestBookableInstant();
  const from = new Date(Math.max(aroundUtc.getTime(), earliest.getTime()));
  const to = DateTime.fromJSDate(from, { zone: 'utc' }).plus({ days: 3 }).toJSDate();

  const computations = await computeSlotsInWindow(from, to);
  return computations
    .filter((c) => c.availableMentorCount > 0)
    .slice(0, limit)
    .map((c) => toSlotView(c, parentTimezone));
}
