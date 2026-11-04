import { SelectField } from '../shadcn/Select';
import { addDays, todayInVietnam } from '@careers/shared';
import { Calendar } from '../shadcn/Calendar';
import { toggleClass } from '../shadcn/toggle';
import { Button } from '../../../ui/Button';

const toLocal = (iso: string) => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toIsoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export interface PickerState {
  /** The chosen day (YYYY-MM-DD) and time (HH:MM), Vietnam time; nothing is saved until "Áp dụng". */
  day: string | null;
  hour: string;
  minute: string;
  hours: readonly string[];
  minutes: readonly string[];
  /** Times of today already past cannot be picked: the hour and minutes still open today. */
  isTimeOpen: (hour: string, minute: string) => boolean;
  /** "Thứ Năm, 05/11/2026 · 09:00", or empty while no day is chosen. */
  summary: string;
  canApply: boolean;
  onDay: (day: string) => void;
  onHour: (hour: string) => void;
  onMinute: (minute: string) => void;
  /** Absent while nothing is saved. */
  onClear?: () => void;
  onCancel: () => void;
  onApply: () => void;
}

function QuickDays({ day, onDay }: Pick<PickerState, 'day' | 'onDay'>) {
  const today = todayInVietnam();
  const quick: [string, string][] = [
    ['Hôm nay', today],
    ['Ngày mai', addDays(today, 1)],
    ['Ngày kia', addDays(today, 2)],
  ];
  return (
    <div role="group" aria-label="Chọn nhanh ngày" className="flex gap-1.5">
      {quick.map(([label, iso]) => (
        <button
          key={label}
          type="button"
          aria-pressed={day === iso}
          onClick={() => onDay(iso)}
          className={`flex-1 ${toggleClass(day === iso)}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TimeSelects(
  props: Pick<PickerState, 'hour' | 'minute' | 'hours' | 'minutes' | 'isTimeOpen' | 'onHour' | 'onMinute'>,
) {
  const { hour, minute, hours, minutes, isTimeOpen, onHour, onMinute } = props;
  return (
    <div role="group" aria-label="Giờ phỏng vấn" className="flex items-center justify-center gap-1.5">
      <SelectField label="Giờ" hideLabel className="w-20" value={hour} onChange={(e) => onHour(e.target.value)}>
        {hours.map((h) => (
          <option key={h} value={h} disabled={!minutes.some((m) => isTimeOpen(h, m))}>
            {h}
          </option>
        ))}
      </SelectField>
      <span aria-hidden="true" className="font-semibold text-slate">
        :
      </span>
      <SelectField label="Phút" hideLabel className="w-20" value={minute} onChange={(e) => onMinute(e.target.value)}>
        {minutes.map((m) => (
          <option key={m} value={m} disabled={!isTimeOpen(hour, m)}>
            {m}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

/** One moment: the month, the hour and minute below it, and nothing saved until "Áp dụng". */
export function InterviewPicker(props: PickerState) {
  const { day, summary, canApply, onDay, onClear, onCancel, onApply } = props;
  const today = todayInVietnam();
  return (
    <div className="flex max-h-[calc(100dvh-16px)] flex-col gap-2.5 overflow-y-auto p-3">
      <QuickDays day={day} onDay={onDay} />
      <div className="flex justify-center">
        <Calendar
          mode="single"
          startMonth={toLocal(today)}
          endMonth={toLocal(addDays(today, 90))}
          disabled={[{ before: toLocal(today) }, { after: toLocal(addDays(today, 90)) }]}
          selected={day ? toLocal(day) : undefined}
          defaultMonth={toLocal(day ?? today)}
          onSelect={(date) => date && onDay(toIsoDay(date))}
        />
      </div>
      <TimeSelects {...props} />
      <div className="flex flex-col gap-2 border-t border-line-soft pt-2.5">
        <span className="min-h-5 text-center text-sm font-medium text-navy">{summary || 'Chưa chọn ngày'}</span>
        <div className="flex items-center gap-2">
          {onClear && (
            <Button size="compact" variant="ghost" onClick={onClear} className="mr-auto">
              Xoá giờ hẹn
            </Button>
          )}
          <Button size="compact" variant="outline" onClick={onCancel} className={onClear ? '' : 'ml-auto'}>
            Huỷ
          </Button>
          <Button size="compact" variant="primary" disabled={!canApply} onClick={onApply}>
            Áp dụng
          </Button>
        </div>
      </div>
    </div>
  );
}
