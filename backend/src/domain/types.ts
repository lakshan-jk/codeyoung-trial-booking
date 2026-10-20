/** Shared domain types (no persistence concerns). */

/** The minimum shape the slot engine needs from a mentor. */
export interface MentorSchedule {
  timezone: string;
  /** Inclusive start hour (0-23) in mentor local time. */
  workStartHour: number;
  /** Exclusive end hour (1-24) in mentor local time. */
  workEndHour: number;
}

/** A concrete bookable slot for one mentor, anchored to absolute UTC instants. */
export interface MentorSlot {
  startUtc: Date;
  endUtc: Date;
  /** Mentor-local calendar date (yyyy-MM-dd) — the capacity key. */
  mentorLocalDate: string;
}

/** How a single instant should be shown to a user in their own timezone. */
export interface ZonedTimeView {
  /** Absolute instant, ISO-8601 UTC. */
  iso: string;
  /** IANA zone used for the labels below. */
  timezone: string;
  /** e.g. "Mon, 20 Oct 2025". */
  dateLabel: string;
  /** e.g. "6:30 PM". */
  timeLabel: string;
  /** Timezone abbreviation incl. DST, e.g. "EDT", "GMT", "IST". */
  abbreviation: string;
  /** Full human string, e.g. "Mon, 20 Oct 2025, 6:30 PM EDT". */
  full: string;
}
