import type { PayrollCashKind } from '@careers/shared';
import { Users } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { PayrollMonthDto } from '../../../api';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../vendor/shadcn-grid/components/ui/dialog';
import { OUTLINE } from '../timesheet/gridParts';
import {
  BULK_COLUMNS,
  bulkPatch,
  bulkPeople,
  bulkResultWords,
  defaultPicked,
  EMPTY_BULK,
  type BulkColumn,
  type BulkDraft,
} from './bulkInputsModel';
import { PeoplePicker } from './config/PeoplePicker';
import { saveError } from './inputParts';
import { filtersFromParams, isFiltered, NOTE_MAX } from './payrollModel';
import { useSaveMonthInputs } from './queries';

/**
 * "Nhập cho nhiều người" (F11): the same % KPI or Ghi chú, or one more line of (24) or (32), for the people ticked. It opens on
 * nobody ticked, or on the people the grid is filtered to (and says so); the save names how many people it is for and
 * stays off until someone is ticked. Each person is saved in turn and the result says who was not.
 */

const FIELD = 'ts-field h-9 min-w-0 rounded-md border bg-white px-2 text-sm';
const LABEL = 'flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700';

function NoteField({ draft, onChange }: { draft: BulkDraft; onChange: (next: BulkDraft) => void }) {
  return (
    <label className={LABEL}>
      <span className="flex justify-between gap-2">
        Ghi chú (thay ghi chú HR đã gõ của những người được chọn)
        <span className="shrink-0 font-normal text-slate-500 tabular-nums">{`${draft.note.length}/${NOTE_MAX}`}</span>
      </span>
      <textarea
        aria-label="Ghi chú"
        rows={3}
        maxLength={NOTE_MAX}
        value={draft.note}
        onChange={(e) => onChange({ ...draft, note: e.target.value })}
        className="min-h-16 w-full resize-y rounded-md border bg-white px-2 py-1.5 text-sm break-words"
      />
    </label>
  );
}

function ValueFields({ draft, onChange }: { draft: BulkDraft; onChange: (next: BulkDraft) => void }) {
  const isPercent = draft.column === 'kpiPercent';
  if (draft.column === 'note') return <NoteField draft={draft} onChange={onChange} />;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className={LABEL}>
        {isPercent ? '% đánh giá KPI (để trống: về số tự tính)' : 'Số tiền (đồng)'}
        <input
          aria-label={isPercent ? '% đánh giá KPI' : 'Số tiền'}
          inputMode={isPercent ? 'decimal' : 'numeric'}
          placeholder={isPercent ? 'Ví dụ 100' : 'Ví dụ 500.000'}
          value={draft.amount}
          onChange={(e) => onChange({ ...draft, amount: e.target.value })}
          className={`${FIELD} text-right tabular-nums`}
        />
      </label>
      {draft.column === 'retro' && (
        <>
          <label className={LABEL}>
            Loại
            <select
              aria-label="Truy lĩnh hay truy thu"
              value={draft.retroKind}
              onChange={(e) => onChange({ ...draft, retroKind: e.target.value === 'take' ? 'take' : 'pay' })}
              className={FIELD}
            >
              <option value="pay">Truy lĩnh (trả thêm)</option>
              <option value="take">Truy thu (thu lại)</option>
            </select>
          </label>
          <label className={LABEL}>
            Của tháng lương nào
            <input
              type="month"
              aria-label="Tháng gốc"
              value={draft.origin}
              onChange={(e) => onChange({ ...draft, origin: e.target.value })}
              className={FIELD}
            />
          </label>
        </>
      )}
      {draft.column === 'cash' && (
        <label className={LABEL}>
          Loại
          <select
            value={draft.kind}
            onChange={(e) => onChange({ ...draft, kind: e.target.value as PayrollCashKind })}
            className={FIELD}
          >
            <option value="support">Hỗ trợ</option>
            <option value="refund">Hoàn ứng</option>
            <option value="advance">Tạm ứng</option>
          </select>
        </label>
      )}
      {draft.column === 'otherIncome' && (
        <label className={LABEL}>
          Thuế
          <select
            value={draft.tax}
            onChange={(e) => onChange({ ...draft, tax: e.target.value as BulkDraft['tax'] })}
            className={FIELD}
          >
            <option value="">Chọn…</option>
            <option value="taxable">Chịu thuế</option>
            <option value="exempt">Miễn thuế</option>
          </select>
        </label>
      )}
      {!isPercent && (
        <label className={`${LABEL} sm:col-span-2`}>
          {draft.column === 'cash' ? 'Lý do (không bắt buộc)' : 'Lý do (bắt buộc)'}
          <input
            value={draft.reason}
            onChange={(e) => onChange({ ...draft, reason: e.target.value })}
            className={FIELD}
          />
        </label>
      )}
    </div>
  );
}

function BulkDialog({ month, search, onClose }: { month: PayrollMonthDto; search: string; onClose: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(search)), [search]);
  const [draft, setDraft] = useState<BulkDraft>(EMPTY_BULK);
  const [picked, setPicked] = useState(() => defaultPicked(month.lines, filters, EMPTY_BULK.column));
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const save = useSaveMonthInputs(month.monthKey);
  const people = bulkPeople(month.lines, draft.column);
  const left = month.lines.length - people.length;
  // Only the people in the list can be saved for: the button counts exactly those.
  const targets = people.filter((l) => picked.includes(l.employeeId));
  const [isFromFilter, setIsFromFilter] = useState(() => isFiltered(filters));
  const pick = (next: string[]) => {
    setIsFromFilter(false);
    setPicked(next);
  };
  const setColumn = (column: BulkColumn) => {
    setIsAsking(false);
    setDraft({ ...draft, column, amount: '' });
    setPicked(defaultPicked(month.lines, filters, column));
    setIsFromFilter(isFiltered(filters));
    setNotice(null);
  };
  const pickBlock = (block: string) => pick(people.filter((l) => l.block === block).map((l) => l.employeeId));
  // An empty % puts (19) back to the computed one: that wipes what HR typed, so it is asked once (F26).
  const isReset = draft.column === 'kpiPercent' && draft.amount.trim() === '';
  const [isAsking, setIsAsking] = useState(false);
  const submit = async (event: FormEvent, isSure = false) => {
    event.preventDefault();
    const patch = bulkPatch(draft);
    if (!patch.ok) return setNotice(patch.error);
    if (targets.length === 0) return setNotice('Chọn ít nhất một người.');
    if (isReset && !isSure) return setIsAsking(true);
    setIsAsking(false);
    setIsBusy(true);
    setNotice(null);
    const failed: { name: string; reason: string }[] = [];
    for (const line of targets) {
      try {
        await save.mutateAsync({ employeeId: line.employeeId, input: patch.patchFor(line) });
      } catch (error) {
        failed.push({ name: line.fullName, reason: saveError(error, draft.column) });
      }
    }
    setIsBusy(false);
    const words = bulkResultWords(targets.length, failed);
    if (failed.length > 0) return setNotice(words);
    toast.success(words);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !isBusy && onClose()}>
      <DialogContent initialFocus={cancel} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{`Nhập cho nhiều người · T${month.month}/${month.year}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} aria-label="Nhập cho nhiều người" className="flex flex-col gap-3">
          <label className={LABEL}>
            Cột
            <select value={draft.column} onChange={(e) => setColumn(e.target.value as BulkColumn)} className={FIELD}>
              {BULK_COLUMNS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <ValueFields draft={draft} onChange={setDraft} />
          {draft.column === 'retro' && (
            <p
              role="note"
              className="m-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              Khoản thêm tay cộng thẳng vào (32) và Thực nhận (42) của tháng này, không tính lại thuế và bảo hiểm. Mỗi
              người một dòng cho mỗi tháng gốc (gõ lại là thay). Rà soát sẽ có dòng vàng; xem, sửa hoặc bỏ ở khối Truy
              lĩnh / truy thu trên lưới; phiếu lương ghi rõ khoản này.
            </p>
          )}
          {(draft.column === 'otherIncome' || draft.column === 'cash') && (
            <p className="m-0 text-xs text-slate-600">
              Thêm một dòng mới cho mỗi người, các dòng đã có của tháng này giữ nguyên. Sửa hoặc xoá dòng: bấm ô của
              từng người trên lưới.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            Chọn nhanh theo khối:
            {['BO', 'KD'].map((block) => (
              <button key={block} type="button" onClick={() => pickBlock(block)} className={`${OUTLINE} h-8! text-xs`}>
                {`Khối ${block}`}
              </button>
            ))}
            {left > 0 && draft.column === 'kpiPercent' && <span>{`${left} người không có KPI nên không ở đây.`}</span>}
          </div>
          <PeoplePicker
            people={people}
            picked={targets.map((l) => l.employeeId)}
            onChange={pick}
            note={isFromFilter ? 'theo bộ lọc của lưới' : undefined}
          />
          {notice && (
            <p role="alert" className="m-0 text-sm font-medium text-red-700">
              {notice}
            </p>
          )}
          {isAsking && (
            <div
              role="alertdialog"
              aria-label="Xoá % KPI đã gõ"
              className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <span className="min-w-0 flex-1 basis-56">{`Xoá % KPI đã gõ của ${targets.length} người, quay về số tự tính?`}</span>
              <button type="button" onClick={() => setIsAsking(false)} className={OUTLINE}>
                Huỷ
              </button>
              <button
                type="button"
                onClick={(e) => void submit(e, true)}
                className="ts-field inline-flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-3 text-sm font-medium whitespace-nowrap text-white hover:bg-red-700"
              >
                Xoá % đã gõ
              </button>
            </div>
          )}
          <DialogFooter>
            <button ref={cancel} type="button" disabled={isBusy} onClick={onClose} className={OUTLINE}>
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isBusy || isAsking || targets.length === 0}
              className="ts-field inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isBusy ? 'Đang lưu…' : `Lưu cho ${targets.length} người`}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** In the month's header, only while the month can still be typed in. */
export function BulkInputsButton({ month, search }: { month: PayrollMonthDto; search: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (month.status !== 'draft' || month.lines.length === 0) return null;
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={OUTLINE}>
        <Users className="size-4 text-blue-600" />
        Nhập cho nhiều người
      </button>
      {isOpen && <BulkDialog month={month} search={search} onClose={() => setIsOpen(false)} />}
    </>
  );
}
