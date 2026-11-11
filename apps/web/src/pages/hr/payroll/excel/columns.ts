import type { PayComponent, PayrollConfig, PayrollMoneyCell } from '@careers/shared';
import { percent } from './format';
import type { PayrollExportLine, PayrollExportRow } from './types';

/**
 * The columns of HR's payroll workbook (spec 12.1): groups A–H, numbered as the file numbers them. Group A has one
 * column per pay component of the month, in the configured order; with fuel and phone apart that is 54 columns
 * (câu 3). The "Khu vực làm việc" column has no number in HR's file and none here.
 */

export type ColumnGroup = 'info' | 'A' | 'B' | 'B2' | 'B3' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export const GROUP_LABELS: Record<ColumnGroup, string> = {
  info: 'THÔNG TIN NHÂN SỰ',
  A: 'A. ĐỊNH MỨC LƯƠNG CHÍNH THỨC / THÁNG',
  B: 'B. CHẤM CÔNG & ĐÁNH GIÁ',
  B2: 'B2. LÀM THÊM GIỜ',
  B3: 'B3. KHÁC',
  C: 'C. THU NHẬP',
  D: 'D. KHẤU TRỪ NGƯỜI LAO ĐỘNG',
  E: 'E. THUẾ THU NHẬP CÁ NHÂN',
  F: 'F. THANH TOÁN',
  G: 'G. CHI PHÍ CÔNG TY',
  H: 'H. THÔNG TIN CHUYỂN KHOẢN & LIÊN HỆ',
};

export type CellFormat = 'index' | 'text' | 'count' | 'bracket' | 'money' | 'days' | 'paidDays' | 'percent';

export interface PayrollColumn {
  /** Stable across months: `khoan:<id>` for a component, the engine's cell name otherwise. */
  key: string;
  /** HR's column number without brackets: "11a", "26"; empty for "Khu vực làm việc". */
  number: string;
  header: string;
  group: ColumnGroup;
  format: CellFormat;
  /** On the TỔNG CỘNG row and in Tổng hợp. */
  isTotalled: boolean;
  width: number;
  value: (row: PayrollExportRow) => string | number | null;
}

/** HR's numbers for the default components; a component HR's file never had takes the next letter. */
const COMPONENT_NUMBERS: Readonly<Record<string, string>> = {
  luong: '8',
  'trach-nhiem': '9',
  com: '10',
  'xang-dt': '11',
  xang: '11a',
  'dien-thoai': '11b',
  'trang-phuc': '12',
  'nha-o': '13',
  'chuyen-can': '14',
};

export function componentNumbers(components: readonly { id: string }[]): string[] {
  return components.reduce<string[]>((acc, c) => {
    const known = COMPONENT_NUMBERS[c.id];
    if (known) return [...acc, known];
    const previous = acc[acc.length - 1] ?? '7';
    const stem = previous.replace(/[a-z]$/, '');
    const letter = previous === stem ? 'a' : String.fromCharCode((previous.at(-1) ?? 'a').charCodeAt(0) + 1);
    return [...acc, `${stem}${letter}`];
  }, []);
}

type Spec = [key: string, number: string, header: string, format: CellFormat, isTotalled: boolean];

const cellOf = (line: PayrollExportLine, key: string): number => {
  const cells: Readonly<Record<string, number>> = line.cells;
  return cells[key] ?? 0;
};

/** (39): the bracket the person's (38) reaches, only when the month's tax is progressive. */
function bracketOf(line: PayrollExportLine, config: PayrollConfig): number {
  const assessable = line.cells.assessable;
  if (line.tax.method !== 'progressive' || assessable <= 0) return 0;
  const index = config.law.brackets.findIndex((b) => b.upTo === null || assessable <= b.upTo);
  return index + 1;
}

function infoColumns(): PayrollColumn[] {
  const specs: [Spec, number, (r: PayrollExportRow) => string | number | null][] = [
    [['stt', '1', 'STT', 'index', false], 5, () => null],
    [['code', '2', 'Mã NV', 'text', false], 9, (r) => r.person.code],
    [['name', '3', 'Họ và tên', 'text', false], 24, (r) => r.person.name],
    [['title', '4', 'Chức danh', 'text', false], 18, (r) => r.person.title],
    [['block', '5', 'Bộ phận', 'text', false], 8, (r) => r.person.block],
    [['contract', '6', 'Loại hợp đồng', 'text', false], 24, (r) => r.person.contractName],
    [['region', '', 'Khu vực làm việc', 'text', false], 9, (r) => r.person.region],
    [['dependants', '7', 'Số NPT', 'count', false], 6, (r) => r.person.dependants],
  ];
  return specs.map(([[key, number, header, format, isTotalled], width, value]) => ({
    key,
    number,
    header,
    format,
    isTotalled,
    width,
    value,
    group: 'info',
  }));
}

function groupA(components: readonly PayComponent[]): PayrollColumn[] {
  const numbers = componentNumbers(components);
  const money = { group: 'A' as const, format: 'money' as const, isTotalled: true, width: 12 };
  return [
    ...components.map((c, i) => ({
      ...money,
      key: `khoan:${c.id}`,
      number: numbers[i] ?? '',
      header: c.name,
      value: (r: PayrollExportRow) => r.line.amounts[c.id] ?? 0,
    })),
    {
      ...money,
      key: 'kpiAmount',
      number: '15',
      header: 'Thưởng KPI / Hiệu suất (100%)',
      value: (r) => r.person.kpiAmount,
    },
    { ...money, key: 'gross', number: '16', header: 'GROSS THỎA THUẬN', value: (r) => r.line.cells.gross },
  ];
}

/** The rates in the insurance headers are the month's own (R8): "BHYT (1,5%)". */
function moneySpecs(config: PayrollConfig): [ColumnGroup, Spec][] {
  const { employeeRates: e, companyRates: c, unionFund } = config.law;
  return [
    ['B', ['paidDays', '17', 'Ngày công thực tế', 'paidDays', false]],
    ['B', ['dailyRate', '18', 'Lương 1 ngày', 'money', false]],
    ['B', ['kpiPercent', '19', '% đánh giá KPI / Hiệu suất', 'percent', false]],
    ['B', ['kpiBonus', '20', 'Thưởng hiệu suất', 'money', true]],
    ['B2', ['weekdayHours', '21', 'Giờ làm thêm ngày thường', 'days', true]],
    ['B2', ['restDays', '22', 'Công làm thêm ngày nghỉ', 'days', true]],
    ['B2', ['holidayDays', '23', 'Công làm thêm ngày lễ', 'days', true]],
    ['B3', ['otherIncome', '24', 'Thu nhập khác', 'money', true]],
    ['C', ['overtimePay', '25', 'Tiền làm thêm giờ', 'money', true]],
    ['C', ['income', '26', 'THU NHẬP THỰC TẾ', 'money', true]],
    ['D', ['socialBase', '27', 'Lương đóng BH', 'money', true]],
    ['D', ['social', '28', `BHXH (${percent(e.social)})`, 'money', true]],
    ['D', ['health', '29', `BHYT (${percent(e.health)})`, 'money', true]],
    ['D', ['unemployment', '30', `BHTN (${percent(e.unemployment)})`, 'money', true]],
    ['D', ['unionFee', '31', 'Đoàn phí CĐ', 'money', true]],
    ['D', ['cash', '32', 'Hỗ Trợ/ Hoàn ứng/ tạm ứng', 'money', true]],
    ['E', ['exempt', '33', 'Thu nhập miễn thuế', 'money', true]],
    ['E', ['taxable', '34', 'Thu nhập chịu thuế', 'money', true]],
    ['E', ['personalDeduction', '35', 'Giảm trừ bản thân', 'money', true]],
    ['E', ['dependantDeduction', '36', 'Giảm trừ người phụ thuộc', 'money', true]],
    ['E', ['insuranceDeduction', '37', 'Giảm trừ BH bắt buộc', 'money', true]],
    ['E', ['assessable', '38', 'Thu nhập tính thuế', 'money', true]],
    ['E', ['bracket', '39', 'Bậc thuế', 'bracket', false]],
    ['E', ['tax', '40', 'Thuế TNCN khấu trừ', 'money', true]],
    ['F', ['totalDeductions', '41', 'TỔNG KHẤU TRỪ', 'money', true]],
    ['F', ['netPay', '42', 'THỰC NHẬN', 'money', true]],
    ['G', ['companySocial', '43', `BHXH (${percent(c.social)})`, 'money', true]],
    ['G', ['companyHealth', '44', `BHYT (${percent(c.health)})`, 'money', true]],
    ['G', ['companyUnemployment', '45', `BHTN (${percent(c.unemployment)})`, 'money', true]],
    ['G', ['unionFund', '46', `KPCĐ (${percent(unionFund)})`, 'money', true]],
    ['G', ['companyTotal', '47', 'Tổng BH + KPCĐ Cty', 'money', true]],
    ['G', ['totalCost', '48', 'TỔNG CHI PHÍ', 'money', true]],
  ];
}

const OVERTIME_KEYS = new Set(['weekdayHours', 'restDays', 'holidayDays']);

function valueOf(key: string, config: PayrollConfig): PayrollColumn['value'] {
  if (key === 'bracket') return (r) => bracketOf(r.line, config);
  if (OVERTIME_KEYS.has(key)) return (r) => r.line.overtime[key as 'weekdayHours' | 'restDays' | 'holidayDays'];
  return (r) => cellOf(r.line, key);
}

function groupH(hideBank: boolean): PayrollColumn[] {
  const text = { group: 'H' as const, format: 'text' as const, isTotalled: false };
  const note = (r: PayrollExportRow) =>
    [r.line.insurance.status.note, r.person.note ?? ''].filter((s) => s.length > 0).join(' · ') || null;
  const bank: PayrollColumn[] = [
    { ...text, key: 'email', number: '49', header: 'Email nhận phiếu lương', width: 24, value: (r) => r.person.email },
    {
      ...text,
      key: 'bankAccount',
      number: '50',
      header: 'Số tài khoản',
      width: 16,
      value: (r) => r.person.bankAccount,
    },
    { ...text, key: 'bankName', number: '51', header: 'Ngân hàng', width: 14, value: (r) => r.person.bankName },
  ];
  const last: PayrollColumn = { ...text, key: 'note', number: '52', header: 'Ghi chú', width: 30, value: note };
  return hideBank ? [last] : [...bank, last];
}

/** The month's columns, left to right. */
export function payrollColumns(config: PayrollConfig, options: { hideBank?: boolean } = {}): PayrollColumn[] {
  const middle = moneySpecs(config).map(([group, [key, number, header, format, isTotalled]]) => ({
    key,
    number,
    header,
    format,
    isTotalled,
    group,
    width: format === 'money' ? 13 : 9,
    value: valueOf(key, config),
  }));
  return [...infoColumns(), ...groupA(config.components), ...middle, ...groupH(options.hideBank ?? false)];
}

/** The money cells the engine totals itself (D01: Σ cells, or Tròn(Σ đủ) "as HR's file"). */
export const isEngineTotal = (
  key: string,
  totals: Readonly<Record<string, number | undefined>>,
): key is PayrollMoneyCell | 'gross' => totals[key] !== undefined;
