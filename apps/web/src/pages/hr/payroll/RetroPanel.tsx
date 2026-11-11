import type { PayrollMonthDto, PayrollRetroCauseDto, PayrollRetroItemDto } from '@careers/shared';
import { ArrowRightLeft, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { errorMessage } from '../parts';
import { OUTLINE } from '../timesheet/gridParts';
import { levelsSearch } from './payrollModel';
import {
  monthName,
  parseRetroAmount,
  retroAppliedWords,
  retroCellRows,
  retroId,
  retroKindOf,
  retroOutWords,
  retroPatches,
  signedMoney,
  type RetroEdit,
  type RetroPatch,
} from './retroModel';
import { useSaveRetro } from './retroQueries';

/**
 * Truy lĩnh / truy thu (spec R6 (a), 11.4): on the receiving month, the list of what approved months compute
 * differently now, each with the month it comes from, the change behind it and the cells that differ; HR leaves out
 * or types over one or many. On an approved month, the line that says where its difference goes.
 */

const LINK = 'font-medium text-blue-700 underline underline-offset-2';
const FIELD = 'ts-field h-8 min-w-0 rounded-md border bg-white px-2 text-sm';

const whenWords = (at: string) =>
  new Date(at).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Where the changed record lives: the person's pay profile, Cấu hình or the timesheet of the earlier month. */
function CauseLine({
  cause,
  item,
  search,
}: {
  cause: PayrollRetroCauseDto;
  item: PayrollRetroItemDto;
  search: string;
}) {
  const to =
    cause.area === 'ho-so'
      ? { search: levelsSearch(search, item.employeeId) }
      : cause.area === 'cau-hinh'
        ? `/hr/luong/cau-hinh?ky=${item.origin}`
        : `/hr/cham-cong?ky=${item.origin}&nv=${encodeURIComponent(item.employeeId)}`;
  return (
    <li className="break-words">
      <Link to={to} className={LINK}>
        {cause.action}
      </Link>
      {`: ${cause.detail} — ${cause.by}, ${whenWords(cause.at)}`}
    </li>
  );
}

function ItemRow(p: {
  item: PayrollRetroItemDto;
  month: PayrollMonthDto;
  canEdit: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const { item, month } = p;
  const { search } = useLocation();
  const cells = retroCellRows(item, month.components);
  const name = `${item.code} ${item.fullName}`;
  return (
    <li className="flex flex-col gap-1 border-t border-slate-200 py-2 text-sm first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {p.canEdit && item.placed && (
          <input
            type="checkbox"
            aria-label={`Chọn ${name}, ${monthName(item.origin)}`}
            checked={p.isSelected}
            onChange={p.onToggle}
            className="size-4"
          />
        )}
        <span className="font-semibold text-slate-900">{name}</span>
        <span>
          {`${retroKindOf(item)} từ `}
          <Link to={`/hr/luong?ky=${item.origin}`} className={LINK}>
            {`${monthName(item.origin)}${item.originApproval ? ` (bản duyệt lần ${item.originApproval})` : ''}`}
          </Link>
        </span>
        <span className="tabular-nums">{`Số tính ${signedMoney(item.computed)}`}</span>
        <span className="font-semibold tabular-nums">{`Áp dụng: ${retroAppliedWords(item)}`}</span>
        {item.reason && <span className="text-slate-600">{`Lý do: ${item.reason}`}</span>}
      </div>
      <details className="text-xs text-slate-700">
        <summary className="cursor-pointer">{`Chênh ${cells.length} ô và nguyên nhân`}</summary>
        <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-4 gap-y-0.5 p-0 tabular-nums">
          {cells.map((row) => (
            <li key={row.cell}>{`${row.label}: ${signedMoney(row.value)}`}</li>
          ))}
        </ul>
        {item.causes.length > 0 ? (
          <ul className="m-0 mt-1 flex list-disc flex-col gap-0.5 pl-4">
            {item.causes.map((cause) => (
              <CauseLine key={`${cause.at}${cause.detail}`} cause={cause} item={item} search={search} />
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-1">Không thấy dòng nhật ký nào sau lúc duyệt; xem Nhật ký lương của tháng gốc.</p>
        )}
      </details>
    </li>
  );
}

export interface RetroPanelProps {
  month: PayrollMonthDto;
  isSaving: boolean;
  error: string | null;
  onApply: (patches: RetroPatch[]) => void;
}

/** The list on the receiving month, with HR's choice for the selected items while the month is a draft. */
export function RetroPanel({ month, isSaving, error, onApply }: RetroPanelProps) {
  const items = month.retro ?? [];
  const canEdit = month.status === 'draft';
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  if (items.length === 0) return null;
  const toggle = (id: string) =>
    setSelected((now) => new Set(now.has(id) ? [...now].filter((x) => x !== id) : [...now, id]));
  const apply = (edit: RetroEdit) => {
    if (edit.kind !== 'reset' && !reason.trim()) return setProblem('Ghi lý do.');
    setProblem(null);
    onApply(retroPatches(month, selected, edit, reason));
    setSelected(new Set());
  };
  const applyAmount = () => {
    const parsed = parseRetroAmount(amount);
    if ('error' in parsed) return setProblem(parsed.error);
    apply({ kind: 'amount', amount: parsed.value });
  };
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return (
    <section aria-label="Truy lĩnh, truy thu" className="ts-card flex flex-col gap-2 p-3">
      <h2 className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
        <ArrowRightLeft className="size-4 shrink-0" />
        {`Truy lĩnh / truy thu từ tháng đã duyệt: ${items.length} khoản, thực nhận ${signedMoney(total)}`}
      </h2>
      <p className="m-0 text-xs text-slate-600">
        Tháng đã duyệt không đổi. Phần tính lại khác bản duyệt được cộng vào từng ô của dòng lương tháng này; số HR gõ
        thay thì vào (32), không qua thuế và bảo hiểm.
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((item) => (
          <ItemRow
            key={retroId(item)}
            item={item}
            month={month}
            canEdit={canEdit}
            isSelected={selected.has(retroId(item))}
            onToggle={() => toggle(retroId(item))}
          />
        ))}
      </ul>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 text-sm">
          <span className="text-slate-700">{`Đã chọn ${selected.size}`}</span>
          <input
            aria-label="Lý do"
            placeholder="Lý do (bắt buộc)"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            className={`${FIELD} w-56`}
          />
          <button
            type="button"
            disabled={selected.size === 0 || isSaving}
            onClick={() => apply({ kind: 'exclude' })}
            className={OUTLINE}
          >
            Bỏ ra
          </button>
          <input
            aria-label="Số tiền gõ thay"
            inputMode="numeric"
            placeholder="Số tiền gõ thay"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${FIELD} w-36 text-right tabular-nums`}
          />
          <button
            type="button"
            disabled={selected.size === 0 || isSaving || !amount.trim()}
            onClick={applyAmount}
            className={OUTLINE}
          >
            Gõ số này
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || isSaving}
            onClick={() => apply({ kind: 'reset' })}
            className={OUTLINE}
          >
            Về số tính
          </button>
        </div>
      )}
      {(problem ?? error) && (
        <p role="alert" className="m-0 text-sm text-red-700">
          {problem ?? error}
        </p>
      )}
    </section>
  );
}

/** On the page: the note of an approved month whose numbers differ now, and the list of the receiving month. */
export function RetroSection({ month }: { month: PayrollMonthDto }) {
  const save = useSaveRetro(month.monthKey);
  const out = month.retroOut;
  return (
    <>
      {out && (
        <p
          role="status"
          className="m-0 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900"
        >
          <TriangleAlert className="size-4 shrink-0" />
          <span className="flex-1">
            {`${retroOutWords(out)} `}
            <Link to={`/hr/luong?ky=${out.month}`} className={LINK}>
              {`Mở ${monthName(out.month)}`}
            </Link>
          </span>
        </p>
      )}
      <RetroPanel
        month={month}
        isSaving={save.isPending}
        error={save.isError ? errorMessage(save.error) : null}
        onApply={(patches) => save.mutate(patches)}
      />
    </>
  );
}
