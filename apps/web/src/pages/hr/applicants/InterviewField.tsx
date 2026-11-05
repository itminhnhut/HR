import { todayInVietnam } from '@careers/shared';
import { useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Dialog } from '../../../ui/Dialog';
import { FieldError } from '../../../ui/Field';
import { Icon } from '../../../ui/icons';
import { InterviewPicker } from './InterviewPicker';

/** What the picker offers, and what a screen reader calls its hour and minute. */
export interface TimeLimits {
  hours: readonly string[];
  /** The last slot of the day. */
  lastTime: string;
  /** How many days ahead can be chosen. */
  maxDays: number;
  timeLabel: string;
}

/** 07 … 20, each with the quarters: 20:00 is the last slot. */
const INTERVIEW_LIMITS: TimeLimits = {
  hours: Array.from({ length: 14 }, (_, i) => String(7 + i).padStart(2, '0')),
  lastTime: '20:00',
  maxDays: 90,
  timeLabel: 'Giờ phỏng vấn',
};
const MINUTES = ['00', '15', '30', '45'];
const DEFAULT_TIME = '09:00';

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

/** "Thứ Năm, 05/11/2026 · 09:00", on the closed field and above "Áp dụng". */
function fieldLabel(iso: string): string {
  const weekday = new Intl.DateTimeFormat('vi-VN', { timeZone: VN, weekday: 'long' }).format(new Date(iso));
  const [y, m, d] = dayOf(iso).split('-');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${d}/${m}/${y} · ${timeOf(iso)}`;
}

const PICKER_WIDTH = 330;
const PICKER_HEIGHT = 510;

/** Beside the field from 640px, on whichever side has room; below that the dialog is a bottom sheet. */
function pickerPlace(field: HTMLElement | null): CSSProperties | undefined {
  if (!field || window.innerWidth < 640) return undefined;
  const r = field.getBoundingClientRect();
  // Right under the field, moved up only as far as the window needs.
  const top = Math.max(8, Math.min(r.bottom + 4, window.innerHeight - PICKER_HEIGHT - 8));
  const left = Math.max(8, Math.min(r.left, window.innerWidth - PICKER_WIDTH - 8));
  return { margin: 0, top, left, width: PICKER_WIDTH };
}

function FieldButton({
  ref,
  text,
  hasValue,
  disabled,
  isOpen,
  fieldName,
  errorId,
  onClick,
}: {
  ref: RefObject<HTMLButtonElement | null>;
  text: string;
  hasValue: boolean;
  disabled?: boolean;
  isOpen: boolean;
  fieldName: string;
  /** The message under the field, when there is one. */
  errorId?: string;
  onClick: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={`${fieldName}: ${text}`}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
      onClick={onClick}
      className={`field-focus flex min-h-11 w-full items-center gap-2.5 rounded-control border bg-white px-3.5 text-left text-sm disabled:opacity-60 ${errorId ? 'border-error' : 'border-field'} ${hasValue ? 'font-medium text-navy' : 'text-placeholder'}`}
    >
      <Icon name="calendar" size={16} className="shrink-0 text-slate" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <Icon name="chevronDown" size={16} className="shrink-0 text-slate" />
    </button>
  );
}

/** The picker's choices, kept apart from the saved value until "Áp dụng". */
function useDraft(value: string | null, { hours, lastTime }: TimeLimits) {
  const isOnBoard = (time: string) => time <= lastTime;
  const [day, setDay] = useState(value ? dayOf(value) : null);
  const [time, setTime] = useState(value ? timeOf(value) : DEFAULT_TIME);
  const today = todayInVietnam();
  // Times already past today cannot be picked.
  const nowTime = timeOf(new Date().toISOString());
  const isTimeOpen = (hour: string, minute: string) => {
    const t = `${hour}:${minute}`;
    return isOnBoard(t) && (day !== today || t > nowTime);
  };
  const nextOpen = () => hours.flatMap((h) => MINUTES.map((m) => `${h}:${m}`)).find((t) => isOnBoard(t) && t > nowTime);
  const reset = () => {
    setDay(value ? dayOf(value) : null);
    setTime(value ? timeOf(value) : DEFAULT_TIME);
  };
  const chooseDay = (next: string) => {
    setDay(next);
    // "Hôm nay" late in the day: moves to the next free slot instead of a time already past.
    if (next === today && time <= nowTime) setTime(nextOpen() ?? time);
  };
  const [hour = '09', minute = '00'] = time.split(':');
  const chooseHour = (h: string) => {
    // A minute that is past or off the board in the new hour moves to its first open one.
    const m =
      isOnBoard(`${h}:${minute}`) && (day !== today || `${h}:${minute}` > nowTime)
        ? minute
        : MINUTES.find((x) => isOnBoard(`${h}:${x}`) && (day !== today || `${h}:${x}` > nowTime));
    setTime(`${h}:${m ?? '00'}`);
  };
  const canApply = !!day && isTimeOpen(hour, minute);
  const iso = day ? `${day}T${time}:00+07:00` : null;
  return {
    day,
    hour,
    minute,
    iso,
    canApply,
    isTimeOpen,
    reset,
    chooseDay,
    chooseHour,
    chooseMinute: (m: string) => setTime(`${hour}:${m}`),
  };
}

/** The picker, placed beside the field; every choice stays a draft until "Áp dụng". */
function PickerDialog({
  isOpen,
  place,
  draft,
  limits,
  canClear,
  dialogLabel,
  finish,
}: {
  isOpen: boolean;
  place: CSSProperties | undefined;
  draft: ReturnType<typeof useDraft>;
  limits: TimeLimits;
  canClear: boolean;
  dialogLabel: string;
  finish: (next?: string | null) => void;
}) {
  return (
    <Dialog
      open={isOpen}
      onClose={() => finish()}
      label={dialogLabel}
      style={place}
      className="sm:backdrop:bg-transparent"
    >
      <InterviewPicker
        day={draft.day}
        hour={draft.hour}
        minute={draft.minute}
        hours={limits.hours}
        minutes={MINUTES}
        maxDays={limits.maxDays}
        timeLabel={limits.timeLabel}
        isTimeOpen={draft.isTimeOpen}
        summary={draft.iso ? fieldLabel(draft.iso) : ''}
        canApply={draft.canApply}
        onDay={draft.chooseDay}
        onHour={draft.chooseHour}
        onMinute={draft.chooseMinute}
        onClear={canClear ? () => finish(null) : undefined}
        onCancel={() => finish()}
        onApply={() => draft.iso && finish(draft.iso)}
      />
    </Dialog>
  );
}

/** Where the picker opens, whether it is open, and its draft. */
function usePicker(value: string | null, limits: TimeLimits, onChange: (iso: string | null) => void) {
  const field = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<CSSProperties | undefined>();
  const [isOpen, setIsOpen] = useState(false);
  const draft = useDraft(value, limits);
  return {
    field,
    place,
    isOpen,
    draft,
    open: () => {
      draft.reset();
      setPlace(pickerPlace(field.current));
      setIsOpen(true);
    },
    finish: (next?: string | null) => {
      setIsOpen(false);
      if (next !== undefined) onChange(next);
    },
  };
}

interface InterviewFieldProps {
  value: string | null;
  disabled?: boolean;
  /** Off where the surrounding form already labels the field. */
  showTitle?: boolean;
  fieldName?: string;
  placeholder?: string;
  /** No "Xoá giờ hẹn": the form cannot do without a time. */
  isRequired?: boolean;
  /** For a moment that is not an interview. */
  limits?: TimeLimits;
  /** Why the value was refused. */
  error?: string;
  onChange: (iso: string | null) => void;
}

/** One field for the interview's day and time, Vietnam time; it opens the picker. Optional. */
export function InterviewField({
  value,
  disabled,
  showTitle = true,
  fieldName = 'Giờ phỏng vấn',
  placeholder = 'Chọn ngày giờ phỏng vấn',
  isRequired = false,
  limits = INTERVIEW_LIMITS,
  error,
  onChange,
}: InterviewFieldProps) {
  const errorId = useId();
  const picker = usePicker(value, limits, onChange);
  return (
    <div className="flex flex-col gap-1.5">
      {showTitle && <span className="text-sm font-medium text-navy">{fieldName}</span>}
      <FieldButton
        ref={picker.field}
        text={value ? fieldLabel(value) : placeholder}
        hasValue={!!value}
        disabled={disabled}
        isOpen={picker.isOpen}
        fieldName={fieldName}
        errorId={error ? errorId : undefined}
        onClick={picker.open}
      />
      <PickerDialog
        isOpen={picker.isOpen}
        place={picker.place}
        draft={picker.draft}
        limits={limits}
        canClear={!!value && !isRequired}
        dialogLabel={placeholder}
        finish={picker.finish}
      />
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
