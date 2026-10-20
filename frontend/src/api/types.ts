// Response shapes mirrored from the backend API.

export interface ZonedTimeView {
  iso: string;
  timezone: string;
  dateLabel: string;
  timeLabel: string;
  abbreviation: string;
  full: string;
}

export interface SlotView {
  startUtc: string;
  endUtc: string;
  start: ZonedTimeView;
  end: ZonedTimeView;
  availableMentorCount: number;
  isAvailable: boolean;
}

export interface DayAvailability {
  date: string;
  timezone: string;
  slots: SlotView[];
}

export interface BookingConfirmation {
  id: string;
  mentor: { name: string; timezone: string };
  classLink: string;
  parentView: { timezone: string; start: ZonedTimeView; end: ZonedTimeView };
  mentorView: { timezone: string; start: ZonedTimeView; end: ZonedTimeView };
}

export interface AppConfig {
  parentTimezones: { value: string; label: string }[];
  mentorTimezone: string;
  slotDurationMinutes: number;
  maxClassesPerMentorPerDay: number;
}

/** Shape of the `details` on a NO_AVAILABILITY error. */
export interface NoAvailabilityDetails {
  alternatives: SlotView[];
}
