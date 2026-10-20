import { useState } from 'react';
import type { SlotView } from '../api/types.js';
import { useModal } from '../hooks/useModal.js';

interface Props {
  slot: SlotView;
  submitting: boolean;
  error?: string;
  onSubmit: (data: { parentName: string; parentEmail: string }) => void;
  onCancel: () => void;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Collects the parent's details to confirm a booking for the chosen slot. */
export function BookingForm({ slot, submitting, error, onSubmit, onCancel }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const dialogRef = useModal<HTMLDivElement>(onCancel);

  const nameOk = name.trim().length > 0;
  const emailOk = EMAIL_RE.test(email);
  const canSubmit = nameOk && emailOk && !submitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSubmit({ parentName: name.trim(), parentEmail: email.trim() });
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title" id="booking-title">Confirm your trial class</h2>
        <div className="slot-summary">
          <span className="slot-summary-label">Your trial class</span>
          <span className="slot-summary-when">{slot.start.dateLabel}</span>
          <span className="slot-summary-time">
            {slot.start.timeLabel} – {slot.end.timeLabel} {slot.start.abbreviation}
          </span>
        </div>
        <p className="slot-summary-note muted">
          We’ll match you with an available mentor and email your class link.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span className="field-label">Parent's name</span>
            <input
              type="text"
              value={name}
              autoFocus
              placeholder="e.g. Priya Sharma"
              onChange={(e) => setName(e.target.value)}
            />
            {touched && !nameOk && <span className="field-error">Please enter a name.</span>}
          </label>

          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
            {touched && !emailOk && (
              <span className="field-error">Please enter a valid email.</span>
            )}
            <span className="field-hint">We’ll send the class link here.</span>
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
