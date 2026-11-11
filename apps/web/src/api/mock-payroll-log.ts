import { PAYROLL_LOG_APPROVAL_ACTIONS, PAYROLL_SETTING_DEFS, periodMonthOf, todayInVietnam } from '@careers/shared';
import { DEMO_HR } from './demo-accounts';
import type { MockDb, MockHrUser } from './mock-seed';
import { delay, fail, load, requireHr, save, uid } from './mock-store';
import type { PayrollLogLineDto, PayrollLogPageDto, PayrollLogQuery } from './types';

/**
 * The demo's Nhật ký lương (spec-luong.md 11.9): a few made-up lines about the golden month's anonymous people, then
 * what Duyệt, Mở lại and Đã chuyển khoản write. Filtered the way the API filters, 100 lines at a time.
 */

const PAGE_SIZE = 100;
const FIRST_MONTH = '2026-10';
const ACCOUNTANT = 'Kế toán lương';

type Seed = Omit<PayrollLogLineDto, 'id'>;

const monthName = (key: string) => `T${Number(key.slice(5))}/${key.slice(0, 4)}`;

function currentMonth(): string {
  const { year, month } = periodMonthOf(todayInVietnam());
  return `${year}-${String(month).padStart(2, '0')}`;
}

type Row = [area: Seed['area'], actor: string, action: string, detail: string, month: string | null, at: string];

function seeds(): Seed[] {
  const now = currentMonth();
  const deduction = PAYROLL_SETTING_DEFS['luat.giam-tru']?.label ?? 'Giảm trừ gia cảnh';
  const hr = DEMO_HR.name;
  const level = 'Thêm hồ sơ của NV01 NV A, từ 26/09/2026: Lương thời gian 9.000.000, Tiền cơm 1.100.000';
  const own = 'Thêm khoan.com.thue cho NV01 NV A: chịu thuế, từ T10/2026. Nguồn: Demo: quyết định riêng';
  const law = `Sửa ${deduction} cho tất cả: 11.000.000 → 15.500.000, từ ${monthName(now)}. Nguồn: Demo`;
  const typed = 'NV10 NV J: % KPI trống → 0%; ghi chú trống → "Vào giữa kỳ"';
  const rows: Row[] = [
    ['quyen', hr, 'Cấp quyền', 'ketoan@congty.vn: Xem, sửa lương', null, '2026-10-20T02:00:00.000Z'],
    ['ho-so', hr, 'Thêm', level, FIRST_MONTH, '2026-10-21T03:10:00.000Z'],
    ['cau-hinh', hr, 'Thêm', own, FIRST_MONTH, '2026-10-21T03:40:00.000Z'],
    ['cham-cong', hr, 'Kỳ công chốt', 'Tháng 10/2026: 12 người', FIRST_MONTH, '2026-10-26T02:05:00.000Z'],
    [
      'tai-xem',
      ACCOUNTANT,
      'Hiện số tài khoản',
      'Hiện đủ số tài khoản của NV02 NV B',
      null,
      '2026-11-02T08:15:00.000Z',
    ],
    ['cau-hinh', ACCOUNTANT, 'Sửa', law, now, '2026-11-02T09:00:00.000Z'],
    ['bang-luong', hr, 'Sửa đầu vào tháng', typed, FIRST_MONTH, '2026-11-03T02:00:00.000Z'],
  ];
  return rows.map(([area, actor, action, detail, month, at]) => ({ area, actor, action, detail, month, at }));
}

const SEEDED: () => PayrollLogLineDto[] = () => seeds().map((line, i) => ({ ...line, id: `nk-${i + 1}` }));

/** One more line, by the signed-in HR, now. */
export function writeMockPayrollLog(
  db: MockDb,
  me: MockHrUser,
  line: Pick<Seed, 'area' | 'action' | 'detail' | 'month'>,
) {
  const written: PayrollLogLineDto = {
    ...line,
    id: uid('nk-'),
    actor: me.name ?? me.email,
    at: new Date().toISOString(),
  };
  db.payrollLog = [...(db.payrollLog ?? []), written];
  save();
}

const fold = (words: string) => words.toLocaleLowerCase('vi');
const escaped = (words: string) => words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The code as a whole word: "NV01" is not in "NV010". */
const names = (detail: string, code: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escaped(code)}($|[^\\p{L}\\p{N}])`, 'iu').test(detail);

function matches(line: PayrollLogLineDto, q: PayrollLogQuery): boolean {
  const words = fold(q.search?.trim() ?? '');
  const approvals: readonly string[] = PAYROLL_LOG_APPROVAL_ACTIONS;
  return (
    (!q.area || line.area === q.area) &&
    (!q.month || line.month === q.month) &&
    (!q.actor || line.actor === q.actor) &&
    (!q.personCode || names(line.detail, q.personCode)) &&
    (!q.isApprovalOnly || approvals.includes(line.action)) &&
    (!words || [line.detail, line.actor, line.action].some((text) => fold(text).includes(words)))
  );
}

export const payrollLogMockApi = {
  async hrPayrollLog(query: PayrollLogQuery): Promise<PayrollLogPageDto> {
    const db = load();
    if (requireHr(db).canPayroll === false) return fail(403, 'Bạn không có quyền xem lương.');
    // Written oldest first; equal times keep the later line on top.
    const all = [...SEEDED(), ...(db.payrollLog ?? [])].reverse().sort((a, b) => b.at.localeCompare(a.at));
    const found = all.filter((line) => matches(line, query));
    return delay({
      lines: found.slice(query.offset, query.offset + PAGE_SIZE),
      hasMore: found.length > query.offset + PAGE_SIZE,
      actors: [...new Set(all.map((l) => l.actor))].sort((a, b) => a.localeCompare(b, 'vi')),
    });
  },
};
