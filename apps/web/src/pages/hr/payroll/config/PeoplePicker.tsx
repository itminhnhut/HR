import { matchesQuery, type PayrollPersonDto } from '@careers/shared';
import { useState } from 'react';
import { Input } from '../../../../vendor/shadcn-grid/components/ui/input';

/** Several people at once for an override: search, tick, "all shown" and "none"; the count is always in view. */

const SMALL =
  'inline-flex min-h-9 items-center rounded-md border bg-white px-2.5 text-xs font-medium hover:bg-slate-50 max-sm:min-h-11';

export function PeoplePicker(p: {
  people: readonly PayrollPersonDto[];
  picked: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const shown = p.people.filter((x) => matchesQuery(`${x.fullName} ${x.code}`, query));
  const toggle = (id: string) =>
    p.onChange(p.picked.includes(id) ? p.picked.filter((x) => x !== id) : [...p.picked, id]);
  const addShown = () => p.onChange([...new Set([...p.picked, ...shown.map((x) => x.employeeId)])]);
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <legend className="sr-only">Nhân viên</legend>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Tìm nhân viên"
          value={query}
          placeholder="Tìm tên hoặc mã"
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 basis-40 bg-white"
        />
        <button type="button" onClick={addShown} className={SMALL}>
          Chọn hết đang hiện
        </button>
        <button type="button" onClick={() => p.onChange([])} className={SMALL}>
          Bỏ chọn
        </button>
      </div>
      <ul className="m-0 grid max-h-52 list-none gap-x-3 overflow-y-auto rounded-md border bg-white p-1 sm:grid-cols-2">
        {shown.map((x) => (
          <li key={x.employeeId}>
            <label className="flex min-h-9 items-center gap-2 rounded px-2 py-1 text-sm font-normal hover:bg-slate-50 max-sm:min-h-11">
              <input
                type="checkbox"
                checked={p.picked.includes(x.employeeId)}
                onChange={() => toggle(x.employeeId)}
                className="shrink-0"
              />
              <span className="min-w-0 break-words">{`${x.code} · ${x.fullName}`}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-1.5 text-sm text-slate-600">Không có nhân viên khớp.</li>}
      </ul>
      <span className="text-xs font-medium text-slate-700">{`Đã chọn ${p.picked.length} người`}</span>
    </fieldset>
  );
}
