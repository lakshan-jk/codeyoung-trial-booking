import type { BookingConfirmation } from '../api/types.js';

interface Props {
  confirmation: BookingConfirmation;
  onBookAnother: () => void;
}

/**
 * Success screen. Shows the class time once, in the parent's own timezone, and
 * only notes the mentor's local time when it differs (so a same-timezone booking
 * doesn't show two identical times).
 */
export function Confirmation({ confirmation, onBookAnother }: Props) {
  const { parentView, mentor, classLink } = confirmation;

  return (
    <div className="step confirmation">
      <div className="confirmation-badge">🎉</div>
      <h2>You’re all set!</h2>
      <p className="muted">
        Your trial class is booked. We’ve emailed the join link — see you in class!
      </p>

      <div className="confirm-card">
        <span className="confirm-label">Your trial class</span>
        <span className="confirm-when">{parentView.start.dateLabel}</span>
        <span className="confirm-time">
          {parentView.start.timeLabel} – {parentView.end.timeLabel} {parentView.start.abbreviation}
        </span>

        <div className="confirm-mentor">
          <span className="confirm-avatar">🧑‍🏫</span>
          <span className="confirm-mentor-name">with {mentor.name}</span>
        </div>
      </div>

      <a className="btn btn-primary btn-block" href={classLink}>
        Join your class
      </a>
      <p className="class-link muted">
        Can’t click? Copy this link:<br />
        <code>{classLink.split('?')[0]}</code>
      </p>

      <button type="button" className="btn btn-ghost" onClick={onBookAnother}>
        Book another trial class
      </button>
    </div>
  );
}
