/**
 * Seed definition for the 10 trial-class mentors.
 *
 * Working hours are expressed in the mentor's LOCAL time (India / Asia/Kolkata)
 * as [startHour, endHour) in 24h form. Hours are staggered across the roster so
 * there is good coverage for parents in US and UK time zones, and so that some
 * slots are busier than others (which makes availability/assignment meaningful).
 *
 * No slot definition here crosses local midnight — this keeps "per day" capacity
 * unambiguous. See README "Assumptions".
 */
export interface MentorSeed {
  name: string;
  email: string;
  /** Inclusive start hour in mentor local time. */
  workStartHour: number;
  /** Exclusive end hour in mentor local time. */
  workEndHour: number;
}

export const MENTOR_SEED: MentorSeed[] = [
  // Afternoon/evening IST — overlaps UK afternoon & US morning.
  { name: 'Aarav Sharma', email: 'aarav.sharma@codeyoung.test', workStartHour: 13, workEndHour: 21 },
  { name: 'Diya Patel', email: 'diya.patel@codeyoung.test', workStartHour: 13, workEndHour: 21 },
  { name: 'Vihaan Reddy', email: 'vihaan.reddy@codeyoung.test', workStartHour: 14, workEndHour: 22 },
  { name: 'Ananya Iyer', email: 'ananya.iyer@codeyoung.test', workStartHour: 14, workEndHour: 22 },
  // Late evening IST — overlaps US afternoon/evening.
  { name: 'Kabir Nair', email: 'kabir.nair@codeyoung.test', workStartHour: 17, workEndHour: 23 },
  { name: 'Ishaan Gupta', email: 'ishaan.gupta@codeyoung.test', workStartHour: 17, workEndHour: 23 },
  { name: 'Saanvi Rao', email: 'saanvi.rao@codeyoung.test', workStartHour: 18, workEndHour: 23 },
  // Morning IST — overlaps UK early morning & US late evening (previous day).
  { name: 'Arjun Menon', email: 'arjun.menon@codeyoung.test', workStartHour: 6, workEndHour: 12 },
  { name: 'Myra Joshi', email: 'myra.joshi@codeyoung.test', workStartHour: 7, workEndHour: 13 },
  { name: 'Reyansh Das', email: 'reyansh.das@codeyoung.test', workStartHour: 8, workEndHour: 14 },
];
