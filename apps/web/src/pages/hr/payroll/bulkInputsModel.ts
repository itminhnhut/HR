import type { PayrollCashKind } from '@careers/shared';
import type { PayrollLineDto, PayrollMonthInputsInput } from '../../../api';
import { lockReasonOf, parseNumberInput } from './monthInputsModel';
import { filterLines, isFiltered, NOTE_MAX, type PayrollFilters } from './payrollModel';

/**
 * "Nhập cho nhiều người" without React (F11): one value of (19), or one more line of (24) or (32), for the people
 * picked. A list is sent whole, so a new line is added after the lines each person already has this month.
 */

export type BulkColumn = 'kpiPercent' | 'otherIncome' | 'cash' | 'retro' | 'note';

export const BULK_COLUMNS: readonly { value: BulkColumn; label: string }[] = [
  { value: 'kpiPercent', label: '(19) % đánh giá KPI' },
  { value: 'otherIncome', label: '(24) Thu nhập khác' },
  { value: 'cash', label: '(32) Hỗ trợ / hoàn ứng / tạm ứng' },
  { value: 'retro', label: 'Truy lĩnh / truy thu (thêm tay)' },
  { value: 'note', label: 'Ghi chú' },
];

export interface BulkDraft {
  column: BulkColumn;
  /** A % for (19) ("100"; empty: back to the computed %), whole dong for the lists. */
  amount: string;
  kind: PayrollCashKind;
  tax: '' | 'taxable' | 'exempt';
  reason: string;
  /** Truy lĩnh / truy thu added by hand (C03): the month it is for, "YYYY-MM", and which way the money goes. */
  origin: string;
  retroKind: 'pay' | 'take';
  /** Ghi chú HR: the same text for everyone picked, in place of the note each of them has this month. */
  note: string;
}

export const EMPTY_BULK: BulkDraft = {
  column: 'kpiPercent',
  amount: '',
  kind: 'support',
  tax: '',
  reason: '',
  origin: '',
  retroKind: 'pay',
  note: '',
};

const MAX_LINES = 20;

/** Who the column can be typed for: (19) only for people with a KPI; a list only while it has room for a line. */
export function bulkPeople(lines: readonly PayrollLineDto[], column: BulkColumn): PayrollLineDto[] {
  if (column === 'kpiPercent') return lines.filter((l) => !lockReasonOf('kpiPercent', l, null));
  if (column === 'retro' || column === 'note') return [...lines];
  return lines.filter((l) => l.inputs[column].length < MAX_LINES);
}

/**
 * The people ticked when the dialog opens: nobody while the grid shows everyone, so a value never lands on people HR
 * did not pick. With a filter on the grid: the rows it shows, among those the column takes.
 */
export function defaultPicked(lines: readonly PayrollLineDto[], filters: PayrollFilters, column: BulkColumn): string[] {
  if (!isFiltered(filters)) return [];
  const shown = new Set(filterLines(lines, filters).map((l) => l.employeeId));
  return bulkPeople(lines, column)
    .filter((l) => shown.has(l.employeeId))
    .map((l) => l.employeeId);
}

export type BulkPatch =
  { ok: true; patchFor: (line: PayrollLineDto) => PayrollMonthInputsInput } | { ok: false; error: string };

const moneyOf = (text: string) => Number(text.replace(/[.\s,đ]/g, ''));

/**
 * A truy lĩnh (+) or truy thu (−) HR adds by hand for a month: it replaces the person's own line of that month, the
 * other months they have stay. The reason is required: the amount goes straight into (32) and (42).
 */
function retroPatch(origin: string, amount: number, reason: string): BulkPatch {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(origin)) return { ok: false, error: 'Chọn tháng gốc của khoản này.' };
  if (!reason) return { ok: false, error: 'Nhập lý do.' };
  const item = { origin, amount, reason };
  return {
    ok: true,
    patchFor: (line) => ({ retro: [...(line.inputs.retro ?? []).filter((r) => r.origin !== origin), item] }),
  };
}

/** The same note for everyone picked. An empty one is refused here: a note is deleted on the person's own cell. */
function notePatch(text: string): BulkPatch {
  const note = text.trim();
  if (!note) return { ok: false, error: 'Nhập ghi chú. Xoá ghi chú: bấm ô Ghi chú của từng người trên lưới.' };
  if (note.length > NOTE_MAX) return { ok: false, error: `Ghi chú tối đa ${NOTE_MAX} ký tự.` };
  return { ok: true, patchFor: () => ({ note }) };
}

/** What to send for each person, or the first thing to fix in the form. */
export function bulkPatch(draft: BulkDraft): BulkPatch {
  if (draft.column === 'note') return notePatch(draft.note);
  if (draft.column === 'kpiPercent') {
    const parsed = parseNumberInput('kpiPercent', draft.amount);
    return parsed.ok ? { ok: true, patchFor: () => parsed.patch } : parsed;
  }
  const amount = moneyOf(draft.amount);
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'Nhập số tiền lớn hơn 0, số đồng.' };
  const reason = draft.reason.trim();
  if (draft.column === 'retro') return retroPatch(draft.origin, draft.retroKind === 'take' ? -amount : amount, reason);
  if (draft.column === 'cash') {
    const item = { kind: draft.kind, amount, reason };
    return { ok: true, patchFor: (line) => ({ cash: [...line.inputs.cash, item] }) };
  }
  if (!draft.tax) return { ok: false, error: 'Chọn chịu thuế hay miễn thuế.' };
  if (!reason) return { ok: false, error: 'Nhập lý do.' };
  const item = { amount, taxable: draft.tax === 'taxable', reason };
  return { ok: true, patchFor: (line) => ({ otherIncome: [...line.inputs.otherIncome, item] }) };
}

/** "Đã lưu 11/12 người. Chưa lưu: NV C (lý do)". */
export function bulkResultWords(total: number, failed: readonly { name: string; reason: string }[]): string {
  const saved = `Đã lưu ${total - failed.length}/${total} người.`;
  if (failed.length === 0) return saved;
  return `${saved} Chưa lưu: ${failed.map((f) => `${f.name} (${f.reason})`).join('; ')}`;
}
