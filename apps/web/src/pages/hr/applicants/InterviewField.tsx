import { addDays, formatDate, todayInVietnam } from '@careers/shared';
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
  // Built by hand: some browsers format vi-VN day/month as "27-10".
  const [, m, d] = dayOf(iso).split('-');
  const day = `${d}/${m}`;
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
  showTitle = true,
  onChange,
}: {
  value: string | null;
  disabled?: boolean;
  /** Off where the surrounding form already labels the field. */
  showTitle?: boolean;
  onChange: (iso: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = todayInVietnam();
  // Times already past today cannot be picked.
  const nowTime = timeOf(new Date().toISOString());
  const day = value ? dayOf(value) : null;
  // A time picked before the day is kept until a day is chosen.
  const [pendingTime, setPendingTime] = useState('09:00');
  const time = value ? timeOf(value) : pendingTime;
  const set = (nextDay: string, nextTime: string) => {
    // "Hôm nay" late in the day: move to the next free half hour instead of a time already past.
    const t = nextDay === today && nextTime <= nowTime ? (TIMES.find((x) => x > nowTime) ?? nextTime) : nextTime;
    onChange(`${nextDay}T${t}:00+07:00`);
  };
  const quick: [string, string][] = [
    ['Hôm nay', today],
    ['Ngày mai', addDays(today, 1)],
    ['Ngày kia', addDays(today, 2)],
  ];
  const chip = (on: boolean) =>
    `min-h-10 rounded-full border px-3.5 text-sm transition-colors ${on ? 'border-navy bg-navy text-white' : 'border-field bg-white text-navy hover:bg-mist'}`;

  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-line px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showTitle && <span className="text-sm font-medium text-navy">Giờ phỏng vấn</span>}
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
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
        <div role="group" aria-label="Ngày phỏng vấn" className="flex flex-wrap gap-1.5">
          {quick.map(([label, iso]) => (
            <button
              key={label}
              type="button"
              // Late in the day there is no half hour left to book today.
              disabled={disabled || (iso === today && !TIMES.some((x) => x > nowTime))}
              aria-pressed={day === iso}
              onClick={() => set(iso, time)}
              className={chip(day === iso)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={`inline-flex items-center gap-1.5 ${chip(!!day && !quick.some(([, iso]) => iso === day))}`}
          >
            <Icon name="calendar" size={15} />
            {day && !quick.some(([, iso]) => iso === day) ? formatDate(day).slice(0, 5) : 'Chọn ngày khác'}
          </button>
        </div>
        <SelectField
          label="Giờ"
          hideLabel
          value={time}
          disabled={disabled}
          onChange={(e) => (day ? set(day, e.target.value) : setPendingTime(e.target.value))}
          className="w-[110px]"
        >
          {TIMES.map((t) => (
            <option key={t} value={t} disabled={day === today && t <= nowTime}>
              {t.replace(/^0/, '')}
            </option>
          ))}
        </SelectField>
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
      <span role="status" className={`text-sm ${value ? 'font-medium text-accent' : 'text-muted'}`}>
        {value ? interviewLabel(value) : 'Chưa chọn ngày phỏng vấn.'}
      </span>
    </div>
  );
}
