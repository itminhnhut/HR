import { useEffect, useRef, type ComponentProps } from 'react';
import { DayPicker, type DayButtonProps, type DropdownProps } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';
import { Icon } from '../../../ui/icons';
import { SelectField } from './Select';

/** The one look of a day: picked, inside a range, or today. */
function dayTone({ modifiers }: Pick<DayButtonProps, 'modifiers'>): string {
  if (modifiers.range_middle) return 'rounded-none bg-tint text-navy';
  if (modifiers.selected) return 'bg-primary font-medium text-white';
  if (modifiers.today) return 'bg-tint font-semibold text-navy hover:bg-remind';
  return 'text-navy hover:bg-tint';
}

function DayButton({ day: _day, modifiers, className: _className, ...rest }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={`relative flex size-full items-center justify-center rounded-control border-0 text-sm leading-none transition-colors focus-visible:z-10 disabled:cursor-not-allowed disabled:opacity-50 ${dayTone({ modifiers })}`}
    />
  );
}

/** The month and year lists are the admin's Select too. */
function Dropdown({ options, value, onChange, disabled, 'aria-label': label }: DropdownProps) {
  return (
    <SelectField
      label={label}
      hideLabel
      className={options && options.length > 12 ? 'w-[88px]' : 'min-w-[104px]'}
      value={value === undefined ? undefined : String(value)}
      disabled={disabled}
      onChange={onChange}
    >
      {options?.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}

const CALENDAR_PARTS = {
  // 36px like every other control from `lg`; a finger needs more on a phone.
  root: 'relative w-fit [--cell-size:40px] lg:[--cell-size:36px]',
  months: 'relative flex flex-col gap-4 md:flex-row',
  month: 'flex flex-col gap-3',
  // Over the titles, so only the arrows take presses: the lists of months and years stay reachable.
  nav: 'pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between',
  button_previous:
    'pointer-events-auto inline-flex size-(--cell-size) items-center justify-center rounded-control border-0 bg-transparent text-navy transition-colors hover:bg-tint aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
  button_next:
    'pointer-events-auto inline-flex size-(--cell-size) items-center justify-center rounded-control border-0 bg-transparent text-navy transition-colors hover:bg-tint aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
  month_caption: 'flex min-h-(--cell-size) items-center justify-center px-(--cell-size)',
  caption_label: 'select-none text-sm font-semibold text-navy',
  dropdowns: 'flex items-center justify-center gap-1.5',
  month_grid: 'border-collapse',
  weekdays: 'flex',
  weekday: 'w-(--cell-size) select-none text-center text-xs font-normal text-slate',
  week: 'mt-1 flex',
  day: 'size-(--cell-size) p-0 text-center',
  range_start: 'rounded-l-control bg-tint',
  range_end: 'rounded-r-control bg-tint',
  hidden: 'invisible',
};

const FORMATTERS = {
  formatCaption: (date: Date) => `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`,
  formatMonthDropdown: (date: Date) => `Tháng ${date.getMonth() + 1}`,
};

const COMPONENTS = {
  DayButton,
  Dropdown,
  Chevron: ({ orientation }: { orientation?: 'up' | 'down' | 'left' | 'right' }) => (
    <Icon name={orientation === 'left' ? 'chevronLeft' : 'chevronRight'} size={16} />
  ),
};

/** shadcn's Calendar: every date in the admin is chosen on this one. */
export function Calendar(props: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={vi}
      weekStartsOn={1}
      classNames={CALENDAR_PARTS}
      formatters={FORMATTERS}
      components={COMPONENTS}
      {...props}
    />
  );
}
