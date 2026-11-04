import { SelectField } from '../shadcn/Select';
import { useSources } from '../../../api/queries';

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
    <SelectField
      label="Lọc theo nguồn"
      hideLabel
      className={className}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Mọi nguồn</option>
      {sources.map((s) => (
        <option key={s.key} value={s.key}>
          {s.name}
          {s.hidden ? ' (đã ẩn)' : ''}
        </option>
      ))}
    </SelectField>
  );
}
