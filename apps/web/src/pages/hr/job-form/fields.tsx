import { CHOICE_MAX, groupThousands, OPENINGS_MAX, WORK_DAYS, WORK_MODE_LABEL, type WorkMode } from '@careers/shared';
import { useState } from 'react';
import { SelectField, TextField } from '../../../ui/Field';
import { hasPick, OTHER, roundSalary, salaryDigits, salaryProblem, togglePick, type FormState } from './model';

const ADD_NEW = '__add__';

/**
 * A normal dropdown of `options`, ending with "+ Thêm mới…". A new value is typed once, picked for this job,
 * and handed to `onAdd` so it can be kept in the list for next time.
 */
export function PickOrAdd({
  label,
  options,
  value,
  error,
  placeholder,
  clearable,
  onChange,
  onAdd,
}: {
  label: string;
  options: string[];
  value: string;
  error?: string;
  placeholder?: string;
  /** Optional field: the empty choice stays in the list, so HR can clear it again. */
  clearable?: boolean;
  onChange: (value: string) => void;
  onAdd?: (value: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const list = value && !options.includes(value) ? [value, ...options] : options;
  const add = () => {
    const next = draft.trim().slice(0, CHOICE_MAX);
    if (!next) return;
    onChange(next);
    if (!options.includes(next)) onAdd?.(next);
    setDraft('');
    setAdding(false);
  };
  return (
    <div className="flex flex-col gap-2">
      <SelectField
        label={label}
        value={adding ? ADD_NEW : value}
        onChange={(e) => {
          if (e.target.value === ADD_NEW) return setAdding(true);
          setAdding(false);
          onChange(e.target.value);
        }}
      >
        {((!value && !adding) || clearable) && <option value="">{placeholder ?? `Chọn ${label.toLowerCase()}`}</option>}
        {list.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={ADD_NEW}>+ Thêm mới…</option>
      </SelectField>
      {adding && (
        <div className="flex gap-2">
          <input
            autoFocus
            aria-label={`${label} mới`}
            maxLength={CHOICE_MAX}
            placeholder={`Tên ${label.toLowerCase()} mới`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                add();
              }
              if (e.key === 'Escape') setAdding(false);
            }}
            className="field-focus min-h-11 min-w-0 flex-1 rounded-control border border-field bg-white px-3.5 text-sm text-navy outline-none"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="min-h-11 rounded-control border border-silver bg-white px-4 text-sm font-medium text-navy hover:bg-mist disabled:opacity-60"
          >
            Thêm
          </button>
        </div>
      )}
      {adding && onAdd && <span className="text-xs text-muted">Mục mới được lưu vào danh sách để lần sau chọn.</span>}
      {error && <span className="text-[13px] text-error">{error}</span>}
    </div>
  );
}

/** "Yêu cầu" quick picks: ticking adds the line, unticking removes it; the text stays free to edit. */
export function RequirementPicks({
  options,
  text,
  onChange,
}: {
  options: string[];
  text: string;
  onChange: (text: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted">Chọn nhanh (bấm để thêm hoặc bỏ):</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = hasPick(text, o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(togglePick(text, o))}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${on ? 'border-primary bg-primary text-white' : 'border-ring bg-white text-navy hover:bg-mist'}`}
            >
              {on ? '✓' : '+'} {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Hình thức làm việc": three buttons; pressing the chosen one again clears it (the field is optional). */
export function WorkModeField({
  value,
  error,
  onChange,
}: {
  value: WorkMode | '';
  error?: string;
  onChange: (value: WorkMode | '') => void;
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-sm font-medium text-navy">
        Hình thức làm việc <span className="font-normal text-muted">(không bắt buộc)</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(WORK_MODE_LABEL) as WorkMode[]).map((mode) => {
          const on = value === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? '' : mode)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control border px-3 text-sm font-medium transition-colors ${on ? 'border-primary bg-primary text-white' : 'border-field bg-white text-navy hover:bg-mist'}`}
            >
              {on && <span aria-hidden="true">✓</span>}
              {WORK_MODE_LABEL[mode]}
            </button>
          );
        })}
      </div>
      {error && <span className="text-[13px] text-error">{error}</span>}
    </fieldset>
  );
}

/** "Số lượng tuyển": digits only, at most 3 so 1–100 fits; the server checks the range. */
export function OpeningsInput({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (digits: string) => void;
}) {
  return (
    <TextField
      label="Số lượng tuyển"
      optional
      inputMode="numeric"
      autoComplete="off"
      placeholder="vd: 2"
      value={value}
      error={error}
      hint={`Từ 1 đến ${OPENINGS_MAX} người.`}
      trailing={<span className="shrink-0 text-sm text-muted">người</span>}
      onChange={(e) =>
        onChange(
          e.target.value
            .replace(/\D/g, '')
            .replace(/^0+(?=\d)/, '')
            .slice(0, 3),
        )
      }
    />
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
