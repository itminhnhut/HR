import { money, percent } from './format';

/** A setting's value in HR's words for the "Tham số" sheet: 2.530.000, 1,5%, "Tròn từng ô khi tính". */

const OPTION_WORDS: Readonly<Record<string, string>> = {
  cell: 'Tròn từng ô khi tính',
  'as-hr': 'Như file HR',
  'income-plus-support': '(26) + Hỗ trợ',
  income: '(26)',
  taxable: 'Phần chịu thuế (34)',
  'when-social': '2% × (27) khi đóng BHXH',
  off: 'Tắt',
  'pay-except-sick': 'Đóng, trừ ốm, thai sản từ 14 ngày',
  pay: 'Đóng',
  skip: 'Không đóng',
  'within-limits': 'Miễn trong 40 giờ/tháng, 200 giờ/năm',
  suggest: 'HR gõ, web gợi ý',
  manual: 'HR gõ',
  typed: 'HR gõ',
  formula: 'Công thức công ÷ chuẩn × tỷ lệ',
  'mon-fri': 'T2–T6',
  'mon-fri-saturdays': 'T2–T6 và thứ Bảy làm việc',
  exempt: 'Miễn thuế',
  'no-withholding': 'Không khấu trừ khi có cam kết',
  withhold: 'Vẫn khấu trừ',
  'flat10-all': '10% mọi loại HĐ',
  'flat10-short-only': '10% chỉ HĐ dưới 3 tháng',
  progressive: 'Lũy tiến',
  'total-200': 'Mỗi công CN tổng 200%',
  'swap-day': 'Đổi ngày nghỉ theo nội quy',
  no: 'Không',
  agreed: 'Có, khi hai bên thoả thuận',
  'unpaid-days': 'Ngày không hưởng lương',
  'insured-days': 'Ngày thuộc HĐ đóng BH',
  'region-contract-block-code': 'Khu vực → loại HĐ → khối → mã',
  allowed: 'Được',
  blocked: 'Không được',
};

const FIELD_WORDS: Readonly<Record<string, string>> = {
  social: 'BHXH',
  health: 'BHYT',
  unemployment: 'BHTN',
  personal: 'Bản thân',
  dependant: 'Người phụ thuộc',
  rate: 'Tỷ lệ',
  threshold: 'Ngưỡng',
  month: 'Tháng',
  year: 'Năm',
  weekday: 'Ngày thường',
  restDay: 'Ngày nghỉ',
  holiday: 'Ngày lễ',
  manager: 'Quản lý doanh nghiệp',
  college: 'Cao đẳng trở lên',
  intermediate: 'Trung cấp',
  other: 'Việc khác',
  I: 'Vùng I',
  II: 'Vùng II',
  III: 'Vùng III',
  IV: 'Vùng IV',
  BO: 'Khối BO',
  KD: 'Khối KD',
};

/** A fraction below one is a rate (0,015 → 1,5%), an overtime factor stays a factor (1,5 → 150%). */
function numberWords(n: number, field = ''): string {
  if (['weekday', 'restDay', 'holiday'].includes(field)) return percent(n);
  if (!Number.isInteger(n) || (n > 0 && n < 1)) return percent(n);
  return money(n);
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function bracketWords(list: readonly unknown[]): string | null {
  const brackets = list.filter(isRecord).filter((b) => 'rate' in b && 'upTo' in b);
  if (brackets.length !== list.length || list.length === 0) return null;
  return brackets
    .map((b) => `${typeof b.upTo === 'number' ? `đến ${money(b.upTo)}` : 'trên'}: ${numberWords(Number(b.rate))}`)
    .join(' · ');
}

export function describeValue(value: unknown, field = ''): string {
  if (typeof value === 'number') return numberWords(value, field);
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'string') return OPTION_WORDS[value] ?? value;
  if (Array.isArray(value)) return bracketWords(value) ?? `${value.length} mục`;
  if (!isRecord(value)) return '';
  return Object.entries(value)
    .map(([key, v]) => `${FIELD_WORDS[key] ?? key} ${describeValue(v, key)}`)
    .join(' · ');
}
