import { Schema, model, InferSchemaType } from 'mongoose';
import { MENTOR_TIMEZONE } from '../config/constants.js';

/**
 * A mentor who conducts trial classes. Working hours are stored in the mentor's
 * local time; all scheduling math converts to UTC via the `timezone` field.
 */
const mentorSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    /** IANA timezone, e.g. "Asia/Kolkata". */
    timezone: { type: String, required: true, default: MENTOR_TIMEZONE },
    /** Inclusive start hour (0-23) in the mentor's local time. */
    workStartHour: { type: Number, required: true, min: 0, max: 23 },
    /** Exclusive end hour (1-24) in the mentor's local time. */
    workEndHour: { type: Number, required: true, min: 1, max: 24 },
  },
  { timestamps: true },
);

export type MentorDoc = InferSchemaType<typeof mentorSchema>;
export const Mentor = model('Mentor', mentorSchema);
