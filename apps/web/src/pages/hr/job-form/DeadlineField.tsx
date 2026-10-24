import { addDays, daysBetween, formatDate, MAX_OPEN_DAYS, todayInVietnam } from '@careers/shared';
import { useState, type CSSProperties } from 'react';
import { DayPicker } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { FieldError } from '../../../ui/Field';
import { Icon } from '../../../ui/icons';

const QUICK_DAYS = [7, 14, 30, 60];

const CALENDAR_STYLE = {
  '--rdp-accent-color': 'var(--color-navy)',
  '--rdp-accent-background-color': 'var(--color-tint)',
  '--rdp-day-height': '40px',
  '--rdp-day-width': '40px',
  '--rdp-day_button-height': '38px',
  '--rdp-day_button-width': '38px',
} as CSSProperties;

/** YYYY-MM-DD <-> a local Date at midnight, which is what the calendar works with. */
const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const WEEKDAY = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Thứ Bảy, 23/11/2026 · còn 30 ngày" */
function summary(deadline: string, today: string): string {
  const left = daysBetween(today, deadline);
  const when = left < 0 ? 'đã qua' : left === 0 ? 'hôm nay' : `còn ${left} ngày`;
  return `${capitalize(WEEKDAY.format(toDate(deadline)))}, ${formatDate(deadline)} · ${when}`;
}

/** Quick picks for the usual lengths; a Vietnamese calendar for anything else. */
export function DeadlineField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (iso: string) => void;
}) {
  const today = todayInVietnam();
  const first = addDays(today, 1);
  const last = addDays(today, MAX_OPEN_DAYS);
  const quick = QUICK_DAYS.map((days) => [days, addDays(today, days)] as const);
  const [calendarOpen, setCalendarOpen] = useState(!!value && !quick.some(([, iso]) => iso === value));

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
      <legend className="mb-2 p-0 text-sm font-medium text-navy">
        Hạn nộp <span className="font-normal text-muted">(tối đa {MAX_OPEN_DAYS} ngày)</span>
      </legend>
      <div role="group" aria-label="Chọn nhanh hạn nộp" className="flex flex-wrap gap-2">
        {quick.map(([days, iso]) => {
          const on = value === iso;
          return (
            <button
              key={days}
              type="button"
              aria-pressed={on}
              onClick={() => {
                onChange(iso);
                setCalendarOpen(false);
              }}
              className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${on ? 'border-navy bg-navy font-medium text-white' : 'border-field bg-white text-navy hover:bg-mist'}`}
            >
              {days} ngày
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={calendarOpen}
          onClick={() => setCalendarOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-silver bg-white px-4 text-sm text-navy hover:bg-mist"
        >
          <Icon name="calendar" size={16} />
          Chọn ngày khác
        </button>
      </div>
      {calendarOpen && (
        <div className="w-fit max-w-full overflow-x-auto rounded-card border border-line bg-white p-3">
          <DayPicker
            mode="single"
            // On the root: the library sets its own defaults there.
            style={CALENDAR_STYLE}
            locale={vi}
            weekStartsOn={1}
            startMonth={toDate(first)}
            endMonth={toDate(last)}
            defaultMonth={toDate(value || first)}
            disabled={[{ before: toDate(first) }, { after: toDate(last) }]}
            selected={value ? toDate(value) : undefined}
            onSelect={(date) => date && onChange(toIso(date))}
          />
        </div>
      )}
      {value ? (
        <span role="status" className="inline-flex items-center gap-2 text-sm text-body">
          <Icon name="calendar" size={15} className="text-accent" />
          {summary(value, today)}
        </span>
      ) : (
        !error && <span className="text-xs text-muted">Chưa chọn hạn nộp.</span>
      )}
      <FieldError>{error}</FieldError>
    </fieldset>
  );
}
