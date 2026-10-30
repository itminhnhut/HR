import { useState } from 'react';
import { useSources } from '../../../api/queries';
import { Icon } from '../../../ui/icons';
import { ManageSourcesDialog } from './ManageSourcesDialog';

/** "Nguồn" filter of the applications list (every source, hidden ones marked) and "Quản lý nguồn". */
export function SourceFilter({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (key: string | null) => void;
}) {
  const sources = useSources().data ?? [];
  const [managing, setManaging] = useState(false);
  return (
    <span className="flex items-center gap-2 sm:ml-auto">
      <label className="relative flex min-h-11 items-center rounded-control border border-field bg-white pl-3 pr-9">
        <span className="sr-only">Lọc theo nguồn</span>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="min-w-0 max-w-[180px] appearance-none self-stretch border-0 bg-transparent text-sm text-navy outline-none"
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
      <button
        type="button"
        onClick={() => setManaging(true)}
        className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-control border border-field bg-white px-3 text-sm font-medium text-navy hover:bg-mist"
      >
        <Icon name="pencil" size={15} />
        Quản lý nguồn
      </button>
      <ManageSourcesDialog open={managing} onClose={() => setManaging(false)} />
    </span>
  );
}
