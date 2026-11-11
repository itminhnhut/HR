import type { PayrollPersonDto } from '@careers/shared';
import { ChevronDown, Pencil, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../../timesheet/dialogs';
import { ItemRow, OUTLINE_BUTTON } from '../profiles/profileParts';
import { fromWords, isChanged, personRows, type ConfigItem, type ConfigRow } from './configModel';
import { useSettingChange } from './configQueries';
import { SettingForm, type FormMode } from './SettingForm';
import { sourceTail } from './sourceWords';
import { valueWords } from './valueKinds';

/** One setting: the value in force, its default and source, people with their own, every stored version. */

const STATUS: Record<ConfigRow['status'], { label: string; tone: string }> = {
  'in-force': { label: 'Đang áp', tone: 'bg-emerald-100 text-emerald-800' },
  upcoming: { label: 'Sắp áp dụng', tone: 'bg-blue-100 text-blue-800' },
  past: { label: 'Đã qua', tone: 'bg-slate-100 text-slate-600' },
  superseded: { label: 'Đã thay', tone: 'bg-slate-100 text-slate-500 line-through' },
};

const Chip = ({ tone, children }: { tone: string; children: string }) => (
  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${tone}`}>{children}</span>
);

function Summary({ item }: { item: ConfigItem }) {
  const { inForce, fallback } = item;
  // The value shown is the default when nothing changed it: say where it comes from, not the value twice.
  const defaultWords = inForce && fallback ? `Mặc định ${valueWords(item.key, fallback.value)}` : 'Theo mặc định';
  const defaultText = fallback
    ? `${defaultWords} · từ ${fromWords(fallback.from)}${sourceTail(fallback.source)}`
    : 'Không có mặc định: HR nhập.';
  return (
    <span className="flex flex-col gap-0.5 text-xs text-slate-600">
      {inForce && <span>{`Đổi cho tất cả từ ${fromWords(inForce.from)}${sourceTail(inForce.source)}`}</span>}
      <span className={inForce ? 'text-slate-500' : ''}>{defaultText}</span>
    </span>
  );
}

const nameOf = (people: readonly PayrollPersonDto[], id: string | null) => {
  const found = people.find((x) => x.employeeId === id);
  return found ? `${found.code} · ${found.fullName}` : (id ?? '');
};

/** "Bỏ ghi đè": a stop row from the month viewed; a row starting then or later is simply removed. */
function removal(row: ConfigRow, item: ConfigItem, month: string) {
  const from = item.scope === 'month' ? month : `${month}-01`;
  if (row.from >= from) return { kind: 'delete' as const, id: row.id };
  const input = { key: item.key, employeeId: row.employeeId, from, stop: true, source: '' };
  return { kind: 'add' as const, input };
}

function People(p: {
  item: ConfigItem;
  month: string;
  people: readonly PayrollPersonDto[];
  onEdit: (mode: FormMode) => void;
}) {
  const change = useSettingChange();
  const rows = personRows(p.item);
  const [removing, setRemoving] = useState<ConfigRow | null>(null);
  return (
    <section aria-label={`Riêng từng người: ${p.item.label}`} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="m-0 flex-1 text-sm font-semibold">{`Riêng từng người (${rows.length})`}</h4>
        <button type="button" onClick={() => p.onEdit({ kind: 'person', employeeId: null })} className={OUTLINE_BUTTON}>
          <UserPlus className="size-4 text-blue-600" />
          Thêm ghi đè
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 text-xs text-slate-600">Chưa ai có mức riêng. Mọi người theo mức cho tất cả.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map((r) => (
            <ItemRow
              key={r.id}
              label={`ghi đè của ${nameOf(p.people, r.employeeId)}`}
              text={`${nameOf(p.people, r.employeeId)}: ${valueWords(p.item.key, r.value)}`}
              sub={`Từ ${fromWords(r.from)}${sourceTail(r.source)}`}
              extra={<Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip>}
              onEdit={() => p.onEdit({ kind: 'person', employeeId: r.employeeId, value: r.value })}
              onDelete={() => setRemoving(r)}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!removing}
        title={`Bỏ ghi đè của ${nameOf(p.people, removing?.employeeId ?? null)} từ ${fromWords(p.month)}?`}
        confirmLabel="Bỏ ghi đè"
        isBusy={change.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) change.mutate(removal(removing, p.item, p.month));
          setRemoving(null);
        }}
      />
    </section>
  );
}

function History(p: { item: ConfigItem; people: readonly PayrollPersonDto[]; onCorrect: (row: ConfigRow) => void }) {
  const change = useSettingChange();
  const [deleting, setDeleting] = useState<ConfigRow | null>(null);
  if (p.item.rows.length === 0) return null;
  return (
    <section aria-label={`Các phiên bản: ${p.item.label}`} className="flex flex-col gap-1">
      <h4 className="m-0 text-sm font-semibold">Các phiên bản đã lưu</h4>
      {change.isError && (
        <p role="alert" className="m-0 text-sm text-red-600">
          {change.error.message}
        </p>
      )}
      <ul className="m-0 list-none p-0">
        {p.item.rows.map((r) => {
          const who = r.employeeId ? nameOf(p.people, r.employeeId) : 'Tất cả';
          const what = r.stop ? 'Bỏ ghi đè' : valueWords(p.item.key, r.value);
          const isLive = r.status !== 'superseded';
          return (
            <ItemRow
              key={r.id}
              label={`dòng ${who} từ ${fromWords(r.from)}`}
              text={`${who}: ${what}`}
              sub={`Từ ${fromWords(r.from)}${sourceTail(r.source)} · ${r.createdBy}`}
              extra={
                <>
                  <Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip>
                  {isLive && !r.stop && (
                    <button type="button" onClick={() => p.onCorrect(r)} className={OUTLINE_BUTTON}>
                      Sửa lỗi
                    </button>
                  )}
                </>
              }
              onDelete={isLive ? () => setDeleting(r) : undefined}
            />
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!deleting}
        title={`Xoá dòng từ ${fromWords(deleting?.from ?? '')}? Tháng đã duyệt dùng dòng này thì không xoá được.`}
        isBusy={change.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) change.mutate({ kind: 'delete', id: deleting.id });
          setDeleting(null);
        }}
      />
    </section>
  );
}

export function SettingItem(p: {
  item: ConfigItem;
  month: string;
  people: readonly PayrollPersonDto[];
  isOpen: boolean;
  /** The setting a link points at: marked and scrolled to. */
  isFocus?: boolean;
  /** Opened from a grid cell: a button to give this person their own value. */
  person?: { employeeId: string; name: string };
  onToggle: () => void;
}) {
  const { item } = p;
  const [mode, setMode] = useState<FormMode | null>(null);
  const upcoming = item.rows.filter((r) => r.status === 'upcoming').length;
  const open = (next: FormMode) => {
    setMode(next);
    if (!p.isOpen) p.onToggle();
  };
  return (
    <li
      ref={p.isFocus ? (el) => el?.scrollIntoView?.({ block: 'center' }) : undefined}
      aria-current={p.isFocus ? 'true' : undefined}
      className={`border-b last:border-b-0 ${p.isFocus ? 'bg-amber-50 ring-2 ring-amber-300 ring-inset' : ''}`}
      data-key={item.key}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
        <button
          type="button"
          aria-expanded={p.isOpen}
          onClick={p.onToggle}
          className="flex min-h-11 min-w-0 flex-1 basis-64 items-start gap-2 text-left"
        >
          <ChevronDown className={`mt-0.5 size-4 shrink-0 text-slate-400 ${p.isOpen ? 'rotate-180' : ''}`} />
          <span className="flex min-w-0 flex-col gap-0.5">
            {/* Over the grid there is no heading per component: the item names its own. */}
            <span title={item.key} className="text-sm font-medium">
              {p.person && item.entry ? `${item.entry} · ${item.label}` : item.label}
            </span>
            <Summary item={item} />
          </span>
        </button>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums">{valueWords(item.key, item.value)}</span>
          {item.inForce ? (
            <Chip tone="bg-amber-100 text-amber-800">Đã đổi</Chip>
          ) : (
            <Chip tone="bg-slate-100 text-slate-600">Mặc định</Chip>
          )}
          {upcoming > 0 && <Chip tone={STATUS.upcoming.tone}>{STATUS.upcoming.label}</Chip>}
          {item.overrides > 0 && <Chip tone="bg-violet-100 text-violet-800">{`${item.overrides} người riêng`}</Chip>}
        </span>
        <button
          type="button"
          aria-label={`Đổi ${item.entry ? `${item.entry}: ` : ''}${item.label}`}
          onClick={() => open({ kind: 'everyone' })}
          className={OUTLINE_BUTTON}
        >
          <Pencil className="size-3.5 text-blue-600" />
          Đổi
        </button>
        {p.person && item.perPerson && (
          <button
            type="button"
            aria-label={`Riêng ${p.person.name}: ${item.entry ? `${item.entry}: ` : ''}${item.label}`}
            onClick={() => open({ kind: 'person', employeeId: p.person?.employeeId ?? null })}
            className={OUTLINE_BUTTON}
          >
            <UserPlus className="size-3.5 text-blue-600" />
            {`Riêng ${p.person.name}`}
          </button>
        )}
      </div>
      {p.isOpen && (
        <div className="flex flex-col gap-3 border-t bg-slate-50/60 px-4 py-3">
          {mode && (
            <SettingForm
              key={JSON.stringify(mode)}
              item={item}
              month={p.month}
              mode={mode}
              people={p.people}
              onClose={() => setMode(null)}
            />
          )}
          {item.perPerson && <People item={item} month={p.month} people={p.people} onEdit={open} />}
          <History item={item} people={p.people} onCorrect={(row) => open({ kind: 'correct', row })} />
          {!isChanged(item) && !mode && (
            <p className="m-0 text-xs text-slate-600">Đang theo mặc định. Bấm Đổi để thêm mức mới từ một tháng.</p>
          )}
        </div>
      )}
    </li>
  );
}
