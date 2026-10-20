import type { SlotView } from '../api/types.js';
import { useModal } from '../hooks/useModal.js';

interface Props {
  message: string;
  alternatives: SlotView[];
  onPick: (slot: SlotView) => void;
  onDismiss: () => void;
}

/**
 * Customer-friendly empty/error state shown when the chosen slot can't be
 * booked (all mentors busy or at capacity). Guides the parent to the nearest
 * available alternatives instead of a dead end.
 */
export function NoAvailability({ message, alternatives, onPick, onDismiss }: Props) {
  const dialogRef = useModal<HTMLDivElement>(onDismiss);
  return (
    <div className="modal-backdrop" onClick={onDismiss}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="noavail-title"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="noavail-icon" aria-hidden="true">🙁</div>
        <h2 className="modal-title" id="noavail-title">That slot just filled up</h2>
        <p className="muted">{message}</p>

        {alternatives.length > 0 ? (
          <>
            <p className="field-label">Nearest available times:</p>
            <div className="alt-list">
              {alternatives.map((slot) => (
                <button
                  key={slot.startUtc}
                  type="button"
                  className="alt-slot"
                  onClick={() => onPick(slot)}
                >
                  <span className="alt-when">{slot.start.dateLabel}</span>
                  <span className="alt-time">
                    {slot.start.timeLabel} {slot.start.abbreviation}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">
            No nearby openings right now. Please try a different date — new slots open daily.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onDismiss}>
            Pick another time
          </button>
        </div>
      </div>
    </div>
  );
}
