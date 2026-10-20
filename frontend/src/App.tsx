import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api/client.js';
import type {
  AppConfig,
  BookingConfirmation,
  DayAvailability,
  NoAvailabilityDetails,
  SlotView,
} from './api/types.js';
import { detectTimezone, headingForDate } from './lib/datetime.js';
import { goHome } from './lib/nav.js';
import { TimezoneSelect } from './components/TimezoneSelect.js';
import { Calendar } from './components/Calendar.js';
import { SlotGrid } from './components/SlotGrid.js';
import { BookingForm } from './components/BookingForm.js';
import { Confirmation } from './components/Confirmation.js';
import { NoAvailability } from './components/NoAvailability.js';

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const [timezone, setTimezone] = useState<string>(detectTimezone());
  const [date, setDate] = useState<string>(''); // empty until the parent picks a date

  const [availability, setAvailability] = useState<DayAvailability | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const timesRef = useRef<HTMLDivElement>(null);

  const [selectedSlot, setSelectedSlot] = useState<SlotView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  // Persist the confirmation for the session so a page refresh doesn't drop the
  // parent back to the home screen after they've booked.
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(() => {
    try {
      const saved = sessionStorage.getItem('cy_confirmation');
      return saved ? (JSON.parse(saved) as BookingConfirmation) : null;
    } catch {
      return null;
    }
  });
  const [noAvail, setNoAvail] = useState<{ message: string; alternatives: SlotView[] } | null>(null);

  // Load config once.
  useEffect(() => {
    api.getConfig().then(setConfig).catch((e) => setFatalError(e.message));
  }, []);

  // Load availability whenever the timezone or date changes. A monotonic request
  // id ensures a slow earlier response can't overwrite a newer one (stale render).
  const loadAvailability = useCallback(async () => {
    if (!date) {
      setAvailability(null);
      setAvailError(null);
      return;
    }
    const seq = ++requestSeq.current;
    setLoadingAvail(true);
    setAvailError(null);
    try {
      const result = await api.getAvailability(timezone, date);
      if (seq === requestSeq.current) setAvailability(result);
    } catch (e) {
      // A transient availability error is recoverable — show it inline with a
      // retry, don't replace the whole app with a fatal screen.
      if (seq === requestSeq.current) {
        setAvailability(null);
        setAvailError(e instanceof Error ? e.message : 'Failed to load availability.');
      }
    } finally {
      if (seq === requestSeq.current) setLoadingAvail(false);
    }
  }, [timezone, date]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  // When a date is picked, bring the times section into view so it's obvious
  // something happened (the slots often render below the fold).
  useEffect(() => {
    if (!date) return;
    const t = setTimeout(
      () => timesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      90,
    );
    return () => clearTimeout(t);
  }, [date]);

  const handleBook = async (data: { parentName: string; parentEmail: string }) => {
    if (!selectedSlot) return;
    setSubmitting(true);
    setFormError(undefined);
    try {
      const result = await api.createBooking({
        ...data,
        parentTimezone: timezone,
        slotStartUtc: selectedSlot.startUtc,
      });
      setSelectedSlot(null);
      setConfirmation(result);
      try {
        sessionStorage.setItem('cy_confirmation', JSON.stringify(result));
      } catch {
        /* ignore storage errors */
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NO_AVAILABILITY') {
        const details = e.details as NoAvailabilityDetails | undefined;
        setSelectedSlot(null);
        setNoAvail({ message: e.message, alternatives: details?.alternatives ?? [] });
        void loadAvailability(); // reflect the slot that just filled up
      } else {
        setFormError(e instanceof Error ? e.message : 'Booking failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectSlot = (slot: SlotView) => {
    setFormError(undefined);
    setSelectedSlot(slot);
  };

  const pickAlternative = (slot: SlotView) => {
    setNoAvail(null);
    selectSlot(slot);
  };

  const bookAnother = () => {
    setConfirmation(null);
    try {
      sessionStorage.removeItem('cy_confirmation');
    } catch {
      /* ignore storage errors */
    }
    void loadAvailability();
  };

  if (fatalError) {
    return (
      <div className="app">
        <div className="card error-card">
          <h2>We hit a snag</h2>
          <p className="muted">{fatalError}</p>
          <button className="btn btn-primary" onClick={() => location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!config) {
    return <div className="app"><p className="muted center">Loading…</p></div>;
  }

  const timezoneLabel =
    config.parentTimezones.find((t) => t.value === timezone)?.label ?? timezone.replace('_', ' ');
  const availableCount = availability?.slots.filter((s) => s.isAvailable).length ?? 0;

  return (
    <div className="app">
      <header className="site-header">
        <a href="/" className="brand" onClick={goHome} aria-label="Codeyoung home">
          <span className="brand-mark">cy</span>
          <span className="brand-name">Codeyoung</span>
        </a>
        <span className="brand-tag">Free Trial Class</span>
      </header>

      {confirmation ? (
        <main className="container">
          <Confirmation confirmation={confirmation} onBookAnother={bookAnother} />
        </main>
      ) : (
        <main className="container">
          <div className="intro">
            <h1>Book a free trial class</h1>
            <p className="muted">
              A live 1-on-1 with a Codeyoung mentor — shown in your local time.
            </p>
          </div>

          <div className="card booking">
            <TimezoneSelect value={timezone} config={config} onChange={setTimezone} />

            <div className="field" style={{ marginTop: 18 }}>
              <span className="field-label">Pick a date</span>
              <Calendar value={date} timezone={timezone} onChange={setDate} />
            </div>

            <div className="booking-divider" />

            <div ref={timesRef}>
              {!date ? (
                <div className="pick-hint">
                  <p className="muted">👆 Select a date above to see available class times.</p>
                </div>
              ) : availError ? (
                <div className="empty-state">
                  <div className="empty-emoji">😕</div>
                  <p className="empty-title">Couldn’t load available times</p>
                  <p className="muted">{availError}</p>
                  <button className="btn btn-primary" onClick={() => void loadAvailability()}>
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <div className="availability-head">
                    <h3>{headingForDate(date, timezone)}</h3>
                    {!loadingAvail && (
                      <p className="availability-sub">
                        {availableCount > 0
                          ? `${availableCount} ${availableCount === 1 ? 'time' : 'times'} available`
                          : 'No times available'}{' '}
                        · shown in {timezoneLabel}
                      </p>
                    )}
                  </div>
                  <SlotGrid slots={availability?.slots ?? []} loading={loadingAvail} onSelect={selectSlot} />
                </>
              )}
            </div>
          </div>

          <p className="note muted">
            Your mentor is in India ({config.mentorTimezone.replace('_', ' ')}) — every time above is
            already converted to yours.
          </p>
        </main>
      )}

      {selectedSlot && (
        <BookingForm
          slot={selectedSlot}
          submitting={submitting}
          error={formError}
          onSubmit={handleBook}
          onCancel={() => {
            setSelectedSlot(null);
            setFormError(undefined);
          }}
        />
      )}

      {noAvail && (
        <NoAvailability
          message={noAvail.message}
          alternatives={noAvail.alternatives}
          onPick={pickAlternative}
          onDismiss={() => setNoAvail(null)}
        />
      )}
    </div>
  );
}
