import { Schema, model, InferSchemaType, Types } from 'mongoose';

/**
 * A confirmed trial-class booking.
 *
 * Timestamps are stored in UTC (`slotStartUtc` / `slotEndUtc`) — the single
 * source of truth. Human-facing local times are derived on read via Luxon.
 *
 * `mentorLocalDate` is the mentor's calendar date (yyyy-MM-dd in their zone) for
 * the slot; it is the key used to enforce the per-day capacity limit.
 */
const bookingSchema = new Schema(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: 'Mentor', required: true },
    mentorName: { type: String, required: true },
    mentorTimezone: { type: String, required: true },

    parentName: { type: String, required: true },
    parentEmail: { type: String, required: true },
    parentTimezone: { type: String, required: true },

    slotStartUtc: { type: Date, required: true },
    slotEndUtc: { type: Date, required: true },

    /** Mentor-local calendar date (yyyy-MM-dd) — the "day" for capacity limits. */
    mentorLocalDate: { type: String, required: true },

    /** Dummy class link handed to both parties. */
    classLink: { type: String, required: true },
  },
  { timestamps: true },
);

// Hard backstop against double-booking the same mentor into the same slot,
// even under concurrent requests. The booking service relies on this.
bookingSchema.index({ mentorId: 1, slotStartUtc: 1 }, { unique: true });

// Fast lookups when computing availability for a date range.
bookingSchema.index({ slotStartUtc: 1 });

export type BookingDoc = InferSchemaType<typeof bookingSchema> & { _id: Types.ObjectId };
export const Booking = model('Booking', bookingSchema);
