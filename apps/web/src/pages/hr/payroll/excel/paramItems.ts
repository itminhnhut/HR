import {
  PAYROLL_SETTINGS,
  settingFor,
  type ContractType,
  type PayComponent,
  type Resolved,
  type SettingRow,
} from '@careers/shared';
import { dayText, money, monthKeyText, monthText, percent, versionText } from './format';
import { describeValue } from './paramWords';
import { sourceTail } from '../config/sourceWords';
import type { PayrollExportMonth } from './types';

/**
 * What the "Tham số" sheet lists for one month (R8, L-F03): the period and its reference dates, every law parameter,
 * pay component, rule, contract type and option that month used (value, from, source), each person's override,
 * split periods and typed cells. Each item has a stable key so several months line up row by row (L-F08).
 */

export interface ParamItem {
  key: string;
  section: string;
  label: string;
  text: string;
}

const labelOf = (key: string) => {
  const entries: [string, { label: string }][] = Object.entries(PAYROLL_SETTINGS);
  return entries.find(([k]) => k === key)?.[1].label ?? key;
};

const fromText = (from: string) => (from.length === 7 ? monthKeyText(from) : dayText(from));
const withSource = (value: string, r: { from: string; source: string }) =>
  `${value}\nTừ ${fromText(r.from)}${sourceTail(r.source)}`;

function periodItems(month: PayrollExportMonth): ParamItem[] {
  const { dates, norms, stamp, closingNo, formulaVersion, labels = [] } = month;
  const item = (key: string, label: string, text: string): ParamItem => ({
    key: `ky:${key}`,
    section: 'Kỳ',
    label,
    text,
  });
  const items = [
    item('period', 'Kỳ công', `${dayText(dates.period.from)}–${dayText(dates.period.to)}`),
    item('pay-date', 'Ngày chi trả', dayText(dates.payDate)),
    item('insurance', 'Tháng BH', `${dates.insuranceMonth.slice(5)}/${dates.insuranceMonth.slice(0, 4)}`),
    item('tax-year', 'Năm thuế', String(dates.taxYear)),
    item('norms', 'Công chuẩn', norms.map((n) => `${n.region} ${n.norm}`).join(' · ')),
    item('closing', 'Lần chốt kỳ công', `Lần ${closingNo}`),
    item('formula', 'Phiên bản công thức', formulaVersion),
    item('version', 'Bản', versionText(stamp)),
  ];
  const labelled = labels.length > 0 ? [{ key: 'nhan', section: 'Nhãn', label: 'Nhãn', text: labels.join('\n') }] : [];
  return [...items, ...labelled];
}

const resolvedItem =
  (section: string, label: string) =>
  (r: Resolved<unknown>): ParamItem => ({
    key: r.key,
    section,
    label,
    text: withSource(describeValue(r.value), r),
  });

const optionLabel = (key: string) => `${key.replace('tuy-chon.', '').toUpperCase()} ${labelOf(key)}`;

function settingItems(month: PayrollExportMonth): ParamItem[] {
  const { law, used } = month.config;
  const laws = law.used.map((r) => resolvedItem('Tham số luật', labelOf(r.key))(r));
  const rules = used.filter((r) => r.key.startsWith('quy-tac.')).map((r) => resolvedItem('Quy tắc', labelOf(r.key))(r));
  const options = used
    .filter((r) => r.key.startsWith('tuy-chon.'))
    .map((r) => resolvedItem('Tuỳ chọn', optionLabel(r.key))(r));
  return [...laws, ...rules, ...options];
}

const TAX_WORDS: Record<string, string> = {
  taxable: 'Chịu thuế',
  exempt: 'Miễn thuế',
  meal: 'Miễn tới trần tiền ăn',
  regulated: 'Miễn tới mức HĐLĐ / quy chế',
  'clothing-year': 'Miễn tới trần trang phục năm',
};

function componentText(c: PayComponent): string {
  const tax = c.tax.kind === 'cap' ? TAX_WORDS[c.tax.cap] : TAX_WORDS[c.tax.kind];
  const flags: [boolean, string][] = [
    [true, c.perDay ? 'Chia theo ngày' : 'Trả đủ tháng'],
    [c.probationRate, '× tỷ lệ thử việc'],
    [c.insured, 'Tính BH'],
    [c.contractPay, 'Lương theo HĐ'],
    [c.overtimeBase, 'Vào lương làm thêm'],
    [true, tax ?? c.tax.kind],
    [!!c.stoppedFrom, `Ngừng từ ${monthKeyText(c.stoppedFrom ?? '')}`],
  ];
  return flags
    .filter(([on]) => on)
    .map(([, word]) => word)
    .join(' · ');
}

function contractText(t: ContractType): string {
  const parts = [
    t.insured ? 'Đóng BH' : 'Không đóng BH',
    t.taxMethod === 'flat10' ? 'Khấu trừ 10%' : 'Lũy tiến',
    t.shortTerm ? 'Dưới 3 tháng' : '',
    `Thử việc ${t.probationDays} ngày`,
  ];
  return parts.filter((p) => p.length > 0).join(' · ');
}

function catalogueItems(month: PayrollExportMonth): ParamItem[] {
  const { rows, dates, components, contractTypes } = month.config;
  const list = settingFor(rows, 'khoan.danh-sach', null, dates.monthKey);
  const types = settingFor(rows, 'loai-hd.danh-sach', null, dates.monthKey);
  return [
    ...components.map((c) => ({
      key: `khoan:${c.id}`,
      section: 'Khoản lương',
      label: c.name,
      text: withSource(componentText(c), list),
    })),
    ...contractTypes.map((t) => ({
      key: `loai-hd:${t.id}`,
      section: 'Loại hợp đồng',
      label: t.name,
      text: withSource(contractText(t), types),
    })),
  ];
}

function personItems(month: PayrollExportMonth): ParamItem[] {
  const codes = new Map(month.rows.map((r) => [r.person.employeeId, r.person.code]));
  const codeOf = (id: string) => codes.get(id) ?? id;
  const inForce = (r: SettingRow) => r.from <= (r.from.length === 7 ? month.dates.monthKey : month.dates.payDate);
  const overrides = month.config.rows
    .filter((r): r is SettingRow & { employeeId: string } => r.employeeId !== null && inForce(r) && !r.supersededBy)
    .map((r) => ({
      key: `ghi-de:${r.employeeId}:${r.key}`,
      section: 'Ghi đè từng người',
      label: `${codeOf(r.employeeId)} · ${labelOf(r.key)}`,
      text: withSource(r.stop ? 'Bỏ ghi đè' : describeValue(r.value), { from: r.from, source: r.source ?? '' }),
    }));
  const names = new Map(month.config.components.map((c) => [c.id, c.name]));
  const segments = (month.segments ?? []).map((s) => ({
    key: `tach-doan:${s.employeeId}`,
    section: 'Tách đoạn',
    label: codeOf(s.employeeId),
    text: s.parts
      .map((p) => {
        const pay = Object.entries(p.amounts).map(([id, amount]) => `${names.get(id) ?? id} ${money(amount)}`);
        return `${dayText(p.from)}–${dayText(p.to)}: ${pay.join(', ')}`;
      })
      .join('\n'),
  }));
  const typed = (month.typed ?? []).map((t) => {
    const show = (n: number) => (t.column === '19' ? percent(n) : money(n));
    return {
      key: `go-de:${t.employeeId}:${t.column}`,
      section: 'Ô gõ đè',
      label: `${codeOf(t.employeeId)} · (${t.column})`,
      text: `Tính ${show(t.computed)} → gõ ${show(t.typed)} · ${t.reason}`,
    };
  });
  return [...overrides, ...segments, ...typed];
}

export function paramItemsOf(month: PayrollExportMonth): ParamItem[] {
  return [...periodItems(month), ...settingItems(month), ...catalogueItems(month), ...personItems(month)];
}

export const monthHeader = (month: PayrollExportMonth) => monthText(month.dates);
