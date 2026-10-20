import { useState } from 'react';
import { DateTime } from 'luxon';

interface Props {
  /** Selected date as yyyy-MM-dd, or '' if none. */
  value: string;
  /** Timezone the calendar reasons in (for "today" and bounds). */
  timezone: string;
  onChange: (dateIso: string) => void;
  /** How far ahead a date can be picked. */
  maxDaysAhead?: number;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A custom, bookable-range calendar. Past days and days beyond the booking
 *  horizon are disabled; today is marked and the selected day is highlighted. */
export function Calendar({ value, timezone, onChange, maxDaysAhead = 60 }: Props) {
  const today = DateTime.now().setZone(timezone).startOf('day');
  const maxDate = today.plus({ days: maxDaysAhead });
  const selected = value ? DateTime.fromISO(value, { zone: timezone }).startOf('day') : null;

  const [view, setView] = useState<DateTime>((selected ?? today).startOf('month'));

  const daysInMonth = view.daysInMonth ?? 30;
  const leadingBlanks = view.weekday % 7; // Luxon: Mon=1..Sun=7 → Sunday-first columns

  const canPrev = view > today.startOf('month');
  const canNext = view.plus({ months: 1 }) <= maxDate.startOf('month');

  const cells: (DateTime | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => view.set({ day: i + 1 })),
  ];

  return (
    <div className="cal">
      <div className="cal-head">
        <button
          type="button"
          className="cal-nav"
          onClick={() => setView(view.minus({ months: 1 }))}
          disabled={!canPrev}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="cal-title">{view.toFormat('LLLL yyyy')}</span>
        <button
          type="button"
          className="cal-nav"
          onClick={() => setView(view.plus({ months: 1 }))}
          disabled={!canNext}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="cal-grid cal-weekdays">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="cal-weekday">{d}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((day, i) => {
          if (!day) return <span key={`b${i}`} className="cal-cell cal-cell--blank" />;
          const disabled = day < today || day > maxDate;
          const isSelected = !!selected && day.hasSame(selected, 'day');
          const isToday = day.hasSame(today, 'day');
          return (
            <button
              key={day.toISODate()}
              type="button"
              className={
                'cal-cell' +
                (isSelected ? ' cal-cell--selected' : '') +
                (isToday && !isSelected ? ' cal-cell--today' : '')
              }
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={day.toFormat('cccc, dd LLLL yyyy')}
              onClick={() => onChange(day.toFormat('yyyy-MM-dd'))}
            >
              {day.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
