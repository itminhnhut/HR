import { addDays, todayInVietnam } from '@careers/shared';
import { useState, type CSSProperties } from 'react';
import { DayPicker } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { SelectField } from '../../../ui/Field';
import { Icon } from '../../../ui/icons';

const CALENDAR_STYLE = {
  '--rdp-accent-color': 'var(--color-navy)',
  '--rdp-accent-background-color': 'var(--color-tint)',
  '--rdp-day-height': '38px',
  '--rdp-day-width': '38px',
  '--rdp-day_button-height': '36px',
  '--rdp-day_button-width': '36px',
} as CSSProperties;

/** 07:00 … 20:00 every half hour. */
const TIMES = Array.from({ length: 27 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 === 0 ? '00' : '30'}`;
});

const VN = 'Asia/Ho_Chi_Minh';
const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: VN }).format(new Date(iso));
const timeOf = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: VN, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** "Thứ Năm, 30/10 lúc 9:00" */
export function interviewLabel(iso: string): string {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat('vi-VN', { timeZone: VN, weekday: 'long' }).format(date);
  const day = new Intl.DateTimeFormat('vi-VN', { timeZone: VN, day: '2-digit', month: '2-digit' }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day} lúc ${timeOf(iso).replace(/^0/, '')}`;
}

const toLocal = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toIsoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Interview day (calendar) and time (half-hour list), Vietnam time. Optional. */
export function InterviewField({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled?: boolean;
  onChange: (iso: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = todayInVietnam();
  const day = value ? dayOf(value) : null;
  const time = value ? timeOf(value) : '09:00';
  const set = (nextDay: string, nextTime: string) => onChange(`${nextDay}T${nextTime}:00+07:00`);

  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-line px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-navy">Giờ phỏng vấn</span>
        {value && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="min-h-9 border-0 bg-transparent px-1 text-xs text-slate underline hover:text-navy"
          >
            Bỏ giờ hẹn
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-field bg-white px-3.5 text-sm text-navy hover:bg-mist"
        >
          <Icon name="calendar" size={16} />
          {value ? interviewLabel(value) : 'Chọn ngày'}
        </button>
        {day && (
          <SelectField
            label="Giờ"
            hideLabel
            value={time}
            disabled={disabled}
            onChange={(e) => set(day, e.target.value)}
            className="w-[120px]"
          >
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/^0/, '')}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      {open && (
        <div className="w-fit max-w-full overflow-x-auto">
          <DayPicker
            mode="single"
            locale={vi}
            weekStartsOn={1}
            style={CALENDAR_STYLE}
            startMonth={toLocal(today)}
            endMonth={toLocal(addDays(today, 90))}
            disabled={[{ before: toLocal(today) }, { after: toLocal(addDays(today, 90)) }]}
            selected={day ? toLocal(day) : undefined}
            defaultMonth={toLocal(day ?? today)}
            onSelect={(date) => {
              if (!date) return;
              set(toIsoDay(date), time);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
