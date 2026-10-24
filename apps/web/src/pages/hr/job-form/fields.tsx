import { DEPARTMENT_MAX, groupThousands, WORK_DAYS } from '@careers/shared';
import { useId, useState } from 'react';
import { SelectField, TextField } from '../../../ui/Field';
import { OTHER, roundSalary, salaryDigits, salaryProblem, type FormState } from './model';

/** A fixed list plus "Khác", which opens a box to type a value of one's own. */
export function ChoiceWithOther({
  label,
  options,
  value,
  error,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [typing, setTyping] = useState(!options.includes(value));
  return (
    <div className="flex flex-col gap-2">
      <SelectField
        label={label}
        value={typing ? OTHER : value}
        onChange={(e) => {
          const picked = e.target.value;
          setTyping(picked === OTHER);
          onChange(picked === OTHER ? '' : picked);
        }}
      >
        {[...options, OTHER].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </SelectField>
      {typing && (
        <TextField
          label={<span className="sr-only">{label} khác</span>}
          placeholder={`Ghi ${label.toLowerCase()} khác`}
          maxLength={60}
          autoFocus
          value={value}
          error={error}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/** Free text with suggestions: typing a new name makes a new department. */
export function DepartmentField({
  value,
  suggestions,
  error,
  onChange,
}: {
  value: string;
  suggestions: string[];
  error?: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  return (
    <>
      <TextField
        label="Phòng ban"
        placeholder="Chọn hoặc gõ tên mới"
        maxLength={DEPARTMENT_MAX}
        list={listId}
        autoComplete="off"
        value={value}
        error={error}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {suggestions.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
    </>
  );
}

/** Every half hour from 05:00 to 23:30. */
const TIMES = Array.from({ length: 38 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 === 0 ? '00' : '30'}`;
});
const timeLabel = (t: string) => t.replace(/^0/, '');

export function WorkingHoursField({
  form,
  error,
  allowOther = true,
  onChange,
}: {
  form: FormState;
  error?: string;
  /** "Khác" (typed by hand); off for the company template. */
  allowOther?: boolean;
  onChange: (patch: Partial<FormState>) => void;
}) {
  const custom = form.workDays === OTHER;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-sm font-medium text-navy">Giờ làm</legend>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <SelectField
          label="Ngày làm"
          hideLabel
          className={custom ? 'col-span-2 sm:col-span-3' : 'col-span-2 sm:col-span-1'}
          value={form.workDays}
          onChange={(e) => onChange({ workDays: e.target.value })}
        >
          {(allowOther ? [...WORK_DAYS, OTHER] : WORK_DAYS).map((d) => (
            <option key={d}>{d}</option>
          ))}
        </SelectField>
        {!custom && (
          <>
            <SelectField
              label="Từ giờ"
              hideLabel
              value={form.startTime}
              onChange={(e) => onChange({ startTime: e.target.value })}
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  Từ {timeLabel(t)}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Đến giờ"
              hideLabel
              value={form.endTime}
              onChange={(e) => onChange({ endTime: e.target.value })}
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  Đến {timeLabel(t)}
                </option>
              ))}
            </SelectField>
          </>
        )}
      </div>
      {custom && (
        <TextField
          label={<span className="sr-only">Giờ làm khác</span>}
          placeholder="vd: Ca sáng 6:00 – 14:00, ca chiều 14:00 – 22:00"
          maxLength={100}
          value={form.workingHoursOther}
          error={error}
          onChange={(e) => onChange({ workingHoursOther: e.target.value })}
        />
      )}
    </fieldset>
  );
}

/**
 * Full amount in VND, grouped as it is typed ("15.000.000"), checked and rounded to
 * 100.000 đ when the box loses focus.
 */
export function SalaryInput({
  label,
  value,
  disabled,
  error,
  rangeError,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  error?: string;
  /** Shown only when this box itself is fine. */
  rangeError?: string | null;
  onChange: (digits: string) => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <TextField
      label={label}
      inputMode="numeric"
      autoComplete="off"
      placeholder="vd: 15.000.000"
      disabled={disabled}
      value={value ? groupThousands(Number(value)) : ''}
      error={error ?? problem ?? rangeError ?? undefined}
      trailing={<span className="shrink-0 text-sm text-muted">đ/tháng</span>}
      onChange={(e) => {
        setProblem(null);
        onChange(salaryDigits(e.target.value));
      }}
      onBlur={() => {
        const rounded = roundSalary(value);
        if (rounded !== value) onChange(rounded);
        setProblem(salaryProblem(rounded));
      }}
    />
  );
}
