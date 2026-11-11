import type {
  PayrollCellKey,
  PayrollMonthDto,
  PayrollMonthInputsInput,
  PayrollRetroInputDto,
  PayrollRetroItemDto,
  PayrollRetroOutDto,
} from '@careers/shared';
import { payrollBands } from './payrollModel';

/**
 * Truy lĩnh / truy thu (spec R6 (a), 11.4): what an approved month computes differently now, carried to the next open
 * month per person. Words, the cells behind an item, and what HR's choice (leave out, type an amount, back to the
 * computed one) saves in the month inputs of each person.
 */

export type RetroKind = 'Truy lĩnh' | 'Truy thu' | 'Điều chỉnh';

/** By the difference of (42): more to receive, some to give back, or cells that move without it (company insurance). */
export const retroKindOf = (item: Pick<PayrollRetroItemDto, 'computed'>): RetroKind =>
  item.computed > 0 ? 'Truy lĩnh' : item.computed < 0 ? 'Truy thu' : 'Điều chỉnh';

/** "2026-11" → "T11/2026". */
export const monthName = (key: string) => `T${Number(key.slice(5))}/${key.slice(0, 4)}`;

/** +2.750.000, −310.000, 0. */
export function signedMoney(amount: number): string {
  const words = Math.abs(amount).toLocaleString('vi-VN');
  return amount > 0 ? `+${words}` : amount < 0 ? `−${words}` : '0';
}

/** One item of the month: a person and the month it comes from. */
export const retroId = (item: Pick<PayrollRetroItemDto, 'employeeId' | 'origin'>) =>
  `${item.employeeId}|${item.origin}`;

/** What the item pays in the receiving month, in words. */
export function retroAppliedWords(item: PayrollRetroItemDto): string {
  if (!item.placed) return 'Không có dòng lương tháng này';
  if (item.typed === null) return signedMoney(item.amount);
  return item.typed === 0 ? 'HR bỏ ra' : `HR gõ ${signedMoney(item.typed)}`;
}

/** The cells behind an item, in the grid's column order, each with its number and name in HR's file. */
export function retroCellRows(
  item: Pick<PayrollRetroItemDto, 'cells'>,
  components: PayrollMonthDto['components'],
): { cell: PayrollCellKey; label: string; value: number }[] {
  const columns = payrollBands(components).flatMap((band) => band.columns);
  const known = columns.flatMap((column) => {
    const value = column.cell ? item.cells[column.cell] : undefined;
    if (!column.cell || value === undefined) return [];
    return [{ cell: column.cell, label: [column.no, column.label].filter(Boolean).join(' '), value }];
  });
  const seen = new Set(known.map((row) => row.cell));
  const others = (Object.keys(item.cells) as PayrollCellKey[])
    .filter((cell) => !seen.has(cell))
    .map((cell) => ({ cell, label: cell, value: item.cells[cell] ?? 0 }));
  return [...known.filter((row, i) => known.findIndex((r) => r.cell === row.cell) === i), ...others];
}

/** HR's choice for the selected items: leave them out, pay a typed amount instead, or go back to the computed one. */
export type RetroEdit = { kind: 'exclude' } | { kind: 'amount'; amount: number } | { kind: 'reset' };

export interface RetroPatch {
  employeeId: string;
  input: PayrollMonthInputsInput;
}

function nextList(
  current: readonly PayrollRetroInputDto[],
  origins: readonly string[],
  edit: RetroEdit,
  reason: string,
): PayrollRetroInputDto[] {
  const kept = current.filter((r) => !origins.includes(r.origin));
  if (edit.kind === 'reset') return kept;
  const amount = edit.kind === 'exclude' ? 0 : edit.amount;
  return [...kept, ...origins.map((origin) => ({ origin, amount, reason }))];
}

/** One save per person: their list of typed adjustments with the selected months replaced or taken off. */
export function retroPatches(
  month: Pick<PayrollMonthDto, 'lines' | 'retro'>,
  selected: ReadonlySet<string>,
  edit: RetroEdit,
  reason: string,
): RetroPatch[] {
  const items = (month.retro ?? []).filter((item) => item.placed && selected.has(retroId(item)));
  const people = [...new Set(items.map((item) => item.employeeId))];
  return people.map((employeeId) => {
    const current = month.lines.find((l) => l.employeeId === employeeId)?.inputs.retro ?? [];
    const origins = items.filter((item) => item.employeeId === employeeId).map((item) => item.origin);
    return { employeeId, input: { retro: nextList(current, origins, edit, reason.trim()) } };
  });
}

/** The amount HR types over an adjustment: whole dong, a minus sign for a truy thu. */
export function parseRetroAmount(text: string): { value: number } | { error: string } {
  const digits = text.replace(/[.\s]/g, '').replace('−', '-');
  if (!/^-?\d+$/.test(digits)) return { error: 'Nhập số đồng, ví dụ 1.500.000 hoặc -300.000.' };
  return { value: Number(digits) };
}

/** The line on an approved month that computes differently now. */
export const retroOutWords = (out: PayrollRetroOutDto) =>
  `Số hiện tại khác bản đã duyệt — chênh lệch chuyển sang tháng ${out.month.slice(5)} (${out.people} người, thực nhận ${signedMoney(out.net)}).`;
