import type { PayrollSettingInput, PayrollSettingsMonthDto } from '@careers/shared';
import { Ban, Pencil, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { errorMessage } from '../../parts';
import {
  addComponent,
  addContract,
  componentsOf,
  contractsOf,
  EMPTY_COMPONENT,
  EMPTY_CONTRACT,
  KIND_WORDS,
  renameEntry,
  stopEntry,
  type CatalogueKind,
  type ComponentDraft,
  type ContractDraft,
} from './catalogueModel';
import { fromWords } from './configModel';
import { useSettingChange } from './configQueries';
import { TAX_OPTIONS } from './valueKinds';

/**
 * Thêm, đổi tên, ngừng dùng một khoản lương hoặc loại HĐ ngay ở Cấu hình (F27). Không có nút xoá: "Ngừng dùng từ
 * tháng" giữ nguyên các tháng trước; tháng đã duyệt giữ tên và số của nó. Mỗi lần lưu đều vào Nhật ký lương.
 */

const FIELD = 'ts-field h-9 min-w-0 rounded-md border bg-white px-2 text-sm font-normal';
const SMALL =
  'inline-flex min-h-8 items-center gap-1 rounded-md border bg-white px-2 text-xs font-medium whitespace-nowrap hover:bg-slate-50 disabled:opacity-50 max-sm:min-h-11';
const PRIMARY =
  'ts-field inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:opacity-50';
const LABEL = 'flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700';

function useSave(onDone: () => void) {
  const save = useSettingChange(onDone);
  const [error, setError] = useState<string | null>(null);
  const run = (built: { ok: true; input: PayrollSettingInput } | { ok: false; error: string }) => {
    if (!built.ok) return setError(built.error);
    setError(null);
    save.mutate({ kind: 'add', input: built.input }, { onError: (e) => setError(errorMessage(e)) });
  };
  return { run, error, isBusy: save.isPending };
}

function Failure({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="m-0 text-sm font-medium text-red-700">
      {error}
    </p>
  );
}

/** "Đổi tên" and "Ngừng dùng từ tháng…" in the heading of one entry; both apply from the month viewed. */
export function EntryActions(p: { kind: CatalogueKind; id: string; name: string; month: string }) {
  const [open, setOpen] = useState<'rename' | 'stop' | null>(null);
  const [name, setName] = useState(p.name);
  const save = useSave(() => setOpen(null));
  const words = KIND_WORDS[p.kind].one;
  const when = fromWords(p.month);
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      <button type="button" aria-label={`Đổi tên ${p.name}`} onClick={() => setOpen('rename')} className={SMALL}>
        <Pencil className="size-3.5 text-blue-600" />
        Đổi tên
      </button>
      <button type="button" aria-label={`Ngừng dùng ${p.name}`} onClick={() => setOpen('stop')} className={SMALL}>
        <Ban className="size-3.5 text-amber-600" />
        Ngừng dùng
      </button>
      {open === 'rename' && (
        <span className="flex w-full flex-wrap items-center gap-2 pt-1 text-sm font-normal">
          <input
            aria-label={`Tên mới của ${p.name}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${FIELD} flex-1 basis-48`}
          />
          <span className="text-xs text-slate-600">{`Áp dụng từ ${when}; các tháng trước giữ tên cũ.`}</span>
          <button type="button" onClick={() => setOpen(null)} className={SMALL}>
            Huỷ
          </button>
          <button
            type="button"
            disabled={save.isBusy}
            onClick={() => save.run(renameEntry(p.kind, p.id, name, p.month))}
            className={PRIMARY}
          >
            Lưu tên mới
          </button>
        </span>
      )}
      {open === 'stop' && (
        <span
          role="alertdialog"
          aria-label={`Ngừng dùng ${p.name}`}
          className="flex w-full flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-normal text-amber-900"
        >
          <span className="min-w-0 flex-1 basis-56">
            {`Ngừng dùng ${words} "${p.name}" từ ${when}? Các tháng trước và tháng đã duyệt giữ nguyên; không xoá gì.`}
          </span>
          <button type="button" onClick={() => setOpen(null)} className={SMALL}>
            Huỷ
          </button>
          <button
            type="button"
            disabled={save.isBusy}
            onClick={() => save.run({ ok: true, input: stopEntry(p.kind, p.id, p.month) })}
            className={PRIMARY}
          >
            {`Ngừng dùng từ ${when}`}
          </button>
        </span>
      )}
      {open && <Failure error={save.error} />}
    </span>
  );
}

function Tick(p: { label: string; isOn: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex min-h-9 items-center gap-2 text-sm font-normal max-sm:min-h-11">
      <input type="checkbox" checked={p.isOn} onChange={(e) => p.onChange(e.target.checked)} className="shrink-0" />
      {p.label}
    </label>
  );
}

function ComponentFields({ draft, set }: { draft: ComponentDraft; set: (next: ComponentDraft) => void }) {
  return (
    <>
      <label className={LABEL}>
        Tên khoản lương
        <input
          aria-label="Tên khoản lương"
          value={draft.name}
          placeholder="Ví dụ: PC độc hại"
          onChange={(e) => set({ ...draft, name: e.target.value })}
          className={FIELD}
        />
      </label>
      <label className={LABEL}>
        Tính thuế
        <select
          aria-label="Tính thuế"
          value={draft.tax}
          onChange={(e) => set({ ...draft, tax: e.target.value })}
          className={FIELD}
        >
          {TAX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL}>
        Mức điền sẵn cho hồ sơ mới (đồng)
        <input
          aria-label="Mức điền sẵn"
          inputMode="numeric"
          value={draft.defaultAmount}
          placeholder="0"
          onChange={(e) => set({ ...draft, defaultAmount: e.target.value })}
          className={`${FIELD} text-right tabular-nums`}
        />
      </label>
      <div className="flex flex-col">
        <Tick label="Chia theo ngày công" isOn={draft.perDay} onChange={(perDay) => set({ ...draft, perDay })} />
        <Tick label="Tính vào lương đóng BH" isOn={draft.insured} onChange={(insured) => set({ ...draft, insured })} />
        <Tick
          label="Tính vào lương theo HĐ (trả phép chưa nghỉ)"
          isOn={draft.contractPay}
          onChange={(contractPay) => set({ ...draft, contractPay })}
        />
      </div>
    </>
  );
}

function ContractFields({ draft, set }: { draft: ContractDraft; set: (next: ContractDraft) => void }) {
  return (
    <>
      <label className={LABEL}>
        Tên loại HĐ
        <input
          aria-label="Tên loại HĐ"
          value={draft.name}
          placeholder="Ví dụ: HĐ thời vụ"
          onChange={(e) => set({ ...draft, name: e.target.value })}
          className={FIELD}
        />
      </label>
      <label className={LABEL}>
        Cách tính thuế
        <select
          aria-label="Cách tính thuế"
          value={draft.taxMethod}
          onChange={(e) => set({ ...draft, taxMethod: e.target.value === 'flat10' ? 'flat10' : 'progressive' })}
          className={FIELD}
        >
          <option value="progressive">Luỹ tiến</option>
          <option value="flat10">Khấu trừ 10%</option>
        </select>
      </label>
      <label className={LABEL}>
        Số ngày thử việc mặc định
        <input
          aria-label="Số ngày thử việc"
          inputMode="numeric"
          value={draft.probationDays}
          onChange={(e) => set({ ...draft, probationDays: e.target.value })}
          className={`${FIELD} text-right tabular-nums`}
        />
      </label>
      <div className="flex flex-col">
        <Tick label="Đóng BH" isOn={draft.insured} onChange={(insured) => set({ ...draft, insured })} />
        <Tick
          label="Cam kết thuế kèm hợp đồng (không khấu trừ 10%)"
          isOn={draft.commitmentIncluded}
          onChange={(commitmentIncluded) => set({ ...draft, commitmentIncluded })}
        />
      </div>
    </>
  );
}

function AddCard(p: {
  title: string;
  isBusy: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  note: string;
  children: ReactNode;
}) {
  return (
    <form
      aria-label={p.title}
      onSubmit={(e) => {
        e.preventDefault();
        p.onSave();
      }}
      className="ts-card flex flex-col gap-3 p-4"
    >
      <h3 className="m-0 text-sm font-semibold">{p.title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{p.children}</div>
      <p className="m-0 text-xs text-slate-600">{p.note}</p>
      <Failure error={p.error} />
      <span className="flex justify-end gap-2">
        <button type="button" onClick={p.onCancel} className={SMALL}>
          Huỷ
        </button>
        <button type="submit" disabled={p.isBusy} className={PRIMARY}>
          Lưu
        </button>
      </span>
    </form>
  );
}

/** At the end of Khoản lương and of Loại HĐ: one more entry, from the month viewed. */
export function AddEntry({ kind, view }: { kind: CatalogueKind; view: PayrollSettingsMonthDto }) {
  const [isOpen, setIsOpen] = useState(false);
  const [component, setComponent] = useState(EMPTY_COMPONENT);
  const [contract, setContract] = useState(EMPTY_CONTRACT);
  const close = () => {
    setIsOpen(false);
    setComponent(EMPTY_COMPONENT);
    setContract(EMPTY_CONTRACT);
  };
  const save = useSave(close);
  const when = fromWords(view.month);
  if (!isOpen)
    return (
      <button type="button" onClick={() => setIsOpen(true)} className={`${PRIMARY} self-start`}>
        <Plus className="size-4" />
        {KIND_WORDS[kind].add}
      </button>
    );
  const submit = () =>
    save.run(
      kind === 'khoan'
        ? addComponent(componentsOf(view), component, view.month)
        : addContract(contractsOf(view), contract, view.month),
    );
  const note =
    kind === 'khoan'
      ? `Có từ ${when}. Khoản mới nằm cuối nhóm A của bảng lương và file Excel (sau Chuyên cần, số cột phụ như (14a)), tự cộng vào (16) Gross; gõ số tiền cho từng người ở Hồ sơ lương. Các thuộc tính khác đổi được ở mục của khoản sau khi lưu.`
      : `Có từ ${when}. Chọn loại này cho từng người ở Hồ sơ lương › Mức lương.`;
  return (
    <AddCard
      title={`${KIND_WORDS[kind].add} từ ${when}`}
      isBusy={save.isBusy}
      error={save.error}
      onSave={submit}
      onCancel={close}
      note={note}
    >
      {kind === 'khoan' ? (
        <ComponentFields draft={component} set={setComponent} />
      ) : (
        <ContractFields draft={contract} set={setContract} />
      )}
    </AddCard>
  );
}
