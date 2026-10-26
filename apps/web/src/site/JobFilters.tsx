import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { useSearchParams } from 'react-router';
import { SelectField } from '../ui/Field';
import { Icon } from '../ui/icons';
import { readFilters, writeFilters, type JobFilterValues } from './jobFilterModel';

const NO_FILTERS: JobFilterValues = { q: '', department: '', place: '' };

/**
 * Filters kept in the address (?q=&phong-ban=&noi-lam=) so a filtered list can be shared.
 * Every change replaces the history entry: typing does not fill the Back button.
 */
export function useJobFilters(onChange?: () => void) {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const update = useCallback(
    (patch: Partial<JobFilterValues>) => {
      setParams((prev) => writeFilters(prev, patch), { replace: true });
      onChange?.();
    },
    [setParams, onChange],
  );
  const clear = useCallback(() => update(NO_FILTERS), [update]);
  return { filters, update, clear };
}

interface JobFiltersProps {
  filters: JobFilterValues;
  departments: string[];
  places: string[];
  onChange: (patch: Partial<JobFilterValues>) => void;
  /** Lets the page put focus back in the search box after "Xoá lọc" removes itself. */
  searchRef?: Ref<HTMLInputElement>;
}

/** Search box on its own row on phones, the two selects side by side under it; one row from md up. */
export function JobFilters({ filters, departments, places, onChange, searchRef }: JobFiltersProps) {
  return (
    <div role="search" aria-label="Lọc vị trí" className="mt-5 flex flex-col gap-3 md:flex-row">
      <SearchBox value={filters.q} onChange={(q) => onChange({ q })} inputRef={searchRef} />
      <div className="grid grid-cols-2 gap-3 md:flex md:shrink-0">
        <FilterSelect
          label="Phòng ban"
          allLabel="Mọi phòng ban"
          value={filters.department}
          options={departments}
          onChange={(department) => onChange({ department })}
        />
        <FilterSelect
          label="Nơi làm việc"
          allLabel="Mọi nơi làm"
          value={filters.place}
          options={places}
          onChange={(place) => onChange({ place })}
        />
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  allLabel: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, allLabel, value, options, onChange }: FilterSelectProps) {
  return (
    <SelectField
      label={label}
      hideLabel
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 md:w-[220px] max-sm:[&_select]:pl-3 max-sm:[&_select]:pr-8"
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </SelectField>
  );
}

/** What the address will hold for this text (blank text removes the key). */
const asParam = (text: string) => (text.trim() ? text : '');

/**
 * The box keeps its own text so typing stays smooth while the address catches up.
 * It follows the address only when the address changed for another reason (Xoá lọc, a link to "/").
 */
interface SearchBoxProps {
  value: string;
  onChange: (text: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}

function SearchBox({ value, onChange, inputRef }: SearchBoxProps) {
  const [draft, setDraft] = useState(value);
  const pending = useRef<string[]>([]);

  useEffect(() => {
    const sentAt = pending.current.indexOf(value);
    if (sentAt >= 0) {
      pending.current = pending.current.slice(sentAt + 1);
      return;
    }
    pending.current = [];
    setDraft(value);
  }, [value]);

  const change = (text: string) => {
    const next = asParam(text);
    const last = pending.current.at(-1) ?? value;
    if (next !== last) pending.current = [...pending.current, next];
    setDraft(text);
    onChange(text);
  };

  return (
    <label className="field-focus flex min-h-[46px] min-w-0 flex-1 items-center gap-3 rounded-control border border-field bg-white px-4">
      <Icon name="search" size={17} className="shrink-0 text-muted" />
      <span className="sr-only">Tìm vị trí</span>
      <input
        ref={inputRef}
        type="search"
        value={draft}
        onChange={(e) => change(e.target.value)}
        placeholder="Tên vị trí hoặc phòng ban"
        enterKeyHint="search"
        className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-navy outline-none placeholder:text-placeholder"
      />
    </label>
  );
}
