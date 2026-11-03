import { useSources } from '../../../api/queries';
import { Icon } from '../../../ui/icons';

/** "Nguồn" filter of the applications list: every source, hidden ones marked. */
export function SourceFilter({
  value,
  onChange,
  className = '',
}: {
  value: string | undefined;
  onChange: (key: string | null) => void;
  className?: string;
}) {
  const sources = useSources().data ?? [];
  return (
    <label
      className={`field-focus relative flex min-h-11 min-w-0 items-center rounded-control border border-field bg-white pl-3 pr-9 ${className}`}
    >
      <span className="sr-only">Lọc theo nguồn</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full min-w-0 appearance-none self-stretch truncate border-0 bg-transparent text-sm text-navy outline-none"
      >
        <option value="">Mọi nguồn</option>
        {sources.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
            {s.hidden ? ' (đã ẩn)' : ''}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 text-slate" />
    </label>
  );
}
