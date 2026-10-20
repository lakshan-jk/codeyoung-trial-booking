import type { AppConfig } from '../api/types.js';

interface Props {
  value: string;
  config: AppConfig;
  onChange: (tz: string) => void;
}

/**
 * Timezone picker. The browser-detected zone is pre-selected; if it isn't one of
 * the curated options we still show it as an extra entry so nothing is lost.
 */
export function TimezoneSelect({ value, config, onChange }: Props) {
  const known = config.parentTimezones.some((t) => t.value === value);
  return (
    <label className="field" htmlFor="timezone-select">
      <span className="field-label">Your timezone</span>
      <select id="timezone-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {!known && <option value={value}>{value} (detected)</option>}
        {config.parentTimezones.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
