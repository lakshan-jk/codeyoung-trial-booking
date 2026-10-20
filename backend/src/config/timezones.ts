/**
 * Timezones offered to parents in the UI dropdown. Covers the common US zones
 * plus UK/Ireland (the assignment's target audiences). The browser's detected
 * zone is still used as the default even if it's not in this list.
 */
export const PARENT_TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/New_York', label: 'US — Eastern (New York)' },
  { value: 'America/Chicago', label: 'US — Central (Chicago)' },
  { value: 'America/Denver', label: 'US — Mountain (Denver)' },
  { value: 'America/Phoenix', label: 'US — Mountain, no DST (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'US — Pacific (Los Angeles)' },
  { value: 'Europe/London', label: 'UK — London' },
  { value: 'Europe/Dublin', label: 'Ireland — Dublin' },
  { value: 'Asia/Kolkata', label: 'India — Kolkata (mentor zone)' },
];
