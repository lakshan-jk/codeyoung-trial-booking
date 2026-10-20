import type { SlotView } from '../api/types.js';
import { periodOf } from '../lib/datetime.js';

interface Props {
  slots: SlotView[];
  loading: boolean;
  onSelect: (slot: SlotView) => void;
}

const PERIODS = ['Morning', 'Afternoon', 'Evening'] as const;

/** Grid of bookable slots for the selected day, grouped by part of day. */
export function SlotGrid({ slots, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="slots-loading">
        <span className="spinner" aria-hidden="true" />
        <p className="muted">Finding available times…</p>
      </div>
    );
  }
  if (slots.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-emoji">📅</div>
        <p className="empty-title">No classes left on this date</p>
        <p className="muted">Try another day — our mentors open up fresh slots daily.</p>
      </div>
    );
  }

  return (
    <div className="slot-groups">
      {PERIODS.map((period) => {
        const group = slots.filter((s) => periodOf(s.start.timeLabel) === period);
        if (group.length === 0) return null;
        return (
          <section key={period} className="slot-group">
            <h3 className="slot-group-title">{period}</h3>
            <div className="slot-list">
              {group.map((slot) => {
                const bookable = slot.isAvailable && slot.availableMentorCount > 0;
                const mentorWord = slot.availableMentorCount === 1 ? 'mentor' : 'mentors';
                return (
                  <button
                    key={slot.startUtc}
                    type="button"
                    className="slot"
                    disabled={!bookable}
                    onClick={() => onSelect(slot)}
                    aria-label={`${slot.start.timeLabel} ${slot.start.abbreviation} — ${
                      bookable ? `${slot.availableMentorCount} ${mentorWord} available` : 'fully booked'
                    }`}
                    title={bookable ? `${slot.availableMentorCount} ${mentorWord} available` : 'Fully booked'}
                  >
                    <span className="slot-time">{slot.start.timeLabel}</span>
                    <span className="slot-zone">{slot.start.abbreviation}</span>
                    {bookable ? (
                      <span className="slot-badge">
                        {slot.availableMentorCount} {slot.availableMentorCount === 1 ? 'spot' : 'spots'} left
                      </span>
                    ) : (
                      <span className="slot-badge slot-badge--full">Full</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
