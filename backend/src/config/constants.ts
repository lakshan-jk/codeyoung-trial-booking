/**
 * Business rules for trial-class booking. Kept in one place so the policy is
 * obvious and easy to change.
 */

/** IANA zone every mentor operates in. Parents can be anywhere. */
export const MENTOR_TIMEZONE = 'Asia/Kolkata';

/** Length of a single trial class / booking slot. */
export const SLOT_DURATION_MINUTES = 60;

/** A mentor may conduct at most this many trial classes per their local day. */
export const MAX_CLASSES_PER_MENTOR_PER_DAY = 2;

/**
 * A slot can only be booked if it starts at least this many minutes from now.
 * Prevents booking a class that is about to start / already started.
 */
export const MIN_BOOKING_LEAD_MINUTES = 30;

/** How many alternative slots to suggest when a chosen slot is full. */
export const MAX_ALTERNATIVES = 6;

/** Parents can only book within this many days from today (bounds query cost). */
export const MAX_BOOKING_HORIZON_DAYS = 60;
