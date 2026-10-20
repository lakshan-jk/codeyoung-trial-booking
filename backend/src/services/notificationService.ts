import type { BookingConfirmation } from './bookingService.js';

/**
 * Notification stub.
 *
 * The assignment says the class link can be a dummy and "it's assumed the link
 * will work". Real email delivery is out of scope, so we simulate it by logging
 * what WOULD be sent to each party — crucially, each sees the time in THEIR OWN
 * timezone. Swapping this for a real provider (SES/SendGrid) is a one-file change.
 */
export function sendBookingNotifications(confirmation: BookingConfirmation): void {
  const { parentView, mentorView, mentor, classLink } = confirmation;

  // eslint-disable-next-line no-console
  console.info(
    `[notify] → Parent (${parentView.timezone}): Your trial class is confirmed for ` +
      `${parentView.start.full} with ${mentor.name}. Join: ${classLink}`,
  );
  // eslint-disable-next-line no-console
  console.info(
    `[notify] → Mentor ${mentor.name} (${mentorView.timezone}): Trial class scheduled for ` +
      `${mentorView.start.full}. Join: ${classLink}`,
  );
}
