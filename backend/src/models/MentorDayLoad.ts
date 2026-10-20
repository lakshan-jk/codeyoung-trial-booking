import { Schema, model, InferSchemaType } from 'mongoose';

/**
 * Atomic per-mentor, per-day counter used to enforce the "max N classes per day"
 * rule WITHOUT a race condition.
 *
 * The booking service first ensures this document exists (idempotent upsert,
 * outside the transaction), then increments it with a guarded update
 * (`{ count: { $lt: MAX } }` + `$inc`, no upsert) inside the transaction that
 * creates the booking. Because the document already exists, concurrent bookings
 * for the same mentor/day contend on this one document — MongoDB raises a write
 * conflict that the transaction retries — so the limit can never be exceeded and
 * no booking is spuriously rejected.
 *
 * The unique index makes the ensure-exists upsert safe under concurrency.
 */
const mentorDayLoadSchema = new Schema({
  mentorId: { type: Schema.Types.ObjectId, ref: 'Mentor', required: true },
  /** Mentor-local calendar date (yyyy-MM-dd). */
  date: { type: String, required: true },
  count: { type: Number, required: true, default: 0 },
});

mentorDayLoadSchema.index({ mentorId: 1, date: 1 }, { unique: true });

export type MentorDayLoadDoc = InferSchemaType<typeof mentorDayLoadSchema>;
export const MentorDayLoad = model('MentorDayLoad', mentorDayLoadSchema);
