import {
  CATALOGUE_SETTINGS,
  catalogueId,
  resolveSetting,
  type ContractType,
  type PayComponent,
  type PayrollSettingInput,
  type PayrollSettingsMonthDto,
} from '@careers/shared';
import { taxValue } from './valueKinds';

/**
 * Thêm, đổi tên, ngừng dùng a pay component or a contract type (F27), without React. Nothing is deleted: a new entry
 * is a new version of the list from a month, a new name and a stop are rows of the entry from a month, so the months
 * before keep what they had.
 */

export type CatalogueKind = 'khoan' | 'loai-hd';

export const KIND_WORDS: Record<CatalogueKind, { one: string; add: string }> = {
  khoan: { one: 'khoản lương', add: 'Thêm khoản lương' },
  'loai-hd': { one: 'loại HĐ', add: 'Thêm loại HĐ' },
};

export interface ComponentDraft {
  name: string;
  perDay: boolean;
  insured: boolean;
  /** A code of `TAX_OPTIONS`: "taxable", "exempt", "cap:meal"… */
  tax: string;
  contractPay: boolean;
  defaultAmount: string;
}

export interface ContractDraft {
  name: string;
  insured: boolean;
  taxMethod: 'progressive' | 'flat10';
  probationDays: string;
  commitmentIncluded: boolean;
}

export const EMPTY_COMPONENT: ComponentDraft = {
  name: '',
  perDay: true,
  insured: false,
  tax: 'taxable',
  contractPay: false,
  defaultAmount: '',
};

export const EMPTY_CONTRACT: ContractDraft = {
  name: '',
  insured: true,
  taxMethod: 'progressive',
  probationDays: '60',
  commitmentIncluded: false,
};

type Built = { ok: true; input: PayrollSettingInput } | { ok: false; error: string };

const rowsOf = (view: PayrollSettingsMonthDto) => view.lines.flatMap((l) => l.rows);

/** The lists the month reads: what a new entry is added to. */
export const componentsOf = (view: PayrollSettingsMonthDto): PayComponent[] =>
  resolveSetting(rowsOf(view), CATALOGUE_SETTINGS['khoan.danh-sach'], null, view.month).value;
export const contractsOf = (view: PayrollSettingsMonthDto): ContractType[] =>
  resolveSetting(rowsOf(view), CATALOGUE_SETTINGS['loai-hd.danh-sach'], null, view.month).value;

const isTaken = (list: readonly { name: string }[], name: string) =>
  list.some((e) => e.name.trim().toLocaleLowerCase('vi-VN') === name.toLocaleLowerCase('vi-VN'));

const wholeNumber = (text: string) => Number(text.replace(/[.\s,đ]/g, '') || '0');

/** A new component goes last: after Chuyên cần on the grid and in the Excel file, with its own sub-number. */
export function addComponent(list: readonly PayComponent[], draft: ComponentDraft, month: string): Built {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: 'Nhập tên khoản lương.' };
  if (isTaken(list, name)) return { ok: false, error: 'Đã có khoản lương tên này.' };
  const defaultAmount = wholeNumber(draft.defaultAmount);
  if (!Number.isInteger(defaultAmount) || defaultAmount < 0) return { ok: false, error: 'Mức điền sẵn là số đồng.' };
  const entry: PayComponent = {
    id: catalogueId(
      name,
      list.map((c) => c.id),
    ),
    name,
    order: Math.max(0, ...list.map((c) => c.order)) + 1,
    perDay: draft.perDay,
    probationRate: true,
    insured: draft.insured,
    contractPay: draft.contractPay,
    overtimeBase: true,
    tax: taxValue(draft.tax) as PayComponent['tax'],
    defaultAmount,
    regulatedCap: null,
    stoppedFrom: null,
  };
  return { ok: true, input: { key: 'khoan.danh-sach', from: month, value: [...list, entry], source: `Thêm ${name}` } };
}

export function addContract(list: readonly ContractType[], draft: ContractDraft, month: string): Built {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: 'Nhập tên loại HĐ.' };
  if (isTaken(list, name)) return { ok: false, error: 'Đã có loại HĐ tên này.' };
  const probationDays = wholeNumber(draft.probationDays);
  if (!Number.isInteger(probationDays) || probationDays < 0)
    return { ok: false, error: 'Số ngày thử việc là số nguyên.' };
  const entry: ContractType = {
    id: catalogueId(
      name,
      list.map((t) => t.id),
    ),
    name,
    insured: draft.insured,
    taxMethod: draft.taxMethod,
    shortTerm: draft.taxMethod === 'flat10',
    probationDays,
    commitmentIncluded: draft.commitmentIncluded,
  };
  return {
    ok: true,
    input: { key: 'loai-hd.danh-sach', from: month, value: [...list, entry], source: `Thêm ${name}` },
  };
}

/** A new name from a month; the months before keep the old one. */
export function renameEntry(kind: CatalogueKind, id: string, name: string, month: string): Built {
  const clean = name.trim();
  if (!clean) return { ok: false, error: 'Nhập tên mới.' };
  return { ok: true, input: { key: `${kind}.${id}.ten`, from: month, value: clean, source: '' } };
}

/** "Ngừng dùng từ tháng": kept for the months before, never deleted. */
export const stopEntry = (kind: CatalogueKind, id: string, month: string): PayrollSettingInput => ({
  key: `${kind}.${id}.ngung`,
  from: month,
  value: month,
  source: '',
});

/** `khoan.com.thue` → `com`: the entry a setting of the list belongs to. */
export const entryIdOf = (key: string): string | null => {
  const [prefix, id, attribute] = key.split('.');
  return (prefix === 'khoan' || prefix === 'loai-hd') && id && attribute ? id : null;
};
