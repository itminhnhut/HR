import { CalendarClock, Clock, Lock, Pencil, SearchX, Settings2, TriangleAlert, Wallet, X } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { PayrollMonthDto } from '../../../api';
import { OUTLINE } from '../timesheet/gridParts';
import { PayrollGrid } from './PayrollGrid';
import { filterLines, monthKeyOf, type PayrollFilters, type PayrollOnly } from './payrollModel';
import { RetroSection } from './RetroPanel';

/** Bảng lương (spec 11.2): what the month is, the grid, the counts under it. */

function Banner({ tone, icon, children }: { tone: string; icon: ReactNode; children: ReactNode }) {
  return <p role="status" className={`m-0 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${tone}`}>{icon}<span className="flex-1">{children}</span></p>;
}

/** `2026-10-26` → `26/10`. */
const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const timesheetOf = (month: PayrollMonthDto) => `/hr/cham-cong?ky=${month.monthKey}`;

/** Spec 4.5, 4.17: a month still ahead, one waiting for the timesheet close, one approved and read only. */
export function MonthBanners({ month, today }: { month: PayrollMonthDto; today: string }) {
  const name = `T${month.month}/${month.year}`;
  if (month.period.from > today) {
    return <Banner tone="border-slate-300 border-dashed bg-slate-50 text-slate-800" icon={<CalendarClock className="size-4 shrink-0" />}>{`Dự tính: kỳ ${name} chưa bắt đầu. Bảng lương có số khi đã chốt công.`}</Banner>;
  }
  if (month.status === 'waiting') {
    // Nothing to type in until the close gives the month its rows: say the next step and where it is done (F14).
    if (month.lines.length === 0) {
      return (
        <Banner tone="border-amber-300 bg-amber-50 text-amber-900" icon={<Clock className="size-4 shrink-0" />}>
          {`Kỳ công ${dayMonth(month.period.from)} – ${dayMonth(month.period.to)} chưa chốt. Bước tiếp: vào Chấm công, bấm Chốt công kỳ này — chốt xong bảng lương tự hiện ở đây. `}
          <Link to={timesheetOf(month)} className="font-semibold whitespace-nowrap text-amber-900 underline underline-offset-2">Mở Chấm công kỳ này ›</Link>
        </Banner>
      );
    }
    return <Banner tone="border-amber-300 bg-amber-50 text-amber-900" icon={<Clock className="size-4 shrink-0" />}>Chờ chốt công, gõ trước KPI và tạm ứng được.</Banner>;
  }
  if (month.status === 'approved' || month.status === 'paid') {
    const next = month.month === 12 ? `T1/${month.year + 1}` : `T${month.month + 1}/${month.year}`;
    return <Banner tone="border-green-300 bg-green-50 text-green-900" icon={<Lock className="size-4 shrink-0" />}>{`Đã duyệt lần ${month.approval?.no ?? 1}, chỉ xem. Muốn sửa: Mở lại, hoặc Truy lĩnh / truy thu ở ${next}.`}</Banner>;
  }
  return null;
}

function NoLines({ month }: { month: PayrollMonthDto }) {
  const before = month.month === 1 ? monthKeyOf(month.year - 1, 12) : monthKeyOf(month.year, month.month - 1);
  return (
    <div className="ts-card flex flex-col items-center gap-3 py-12 text-sm text-slate-600">
      <Wallet className="size-7 text-slate-400" />
      {month.status === 'waiting' ? 'Chưa có bảng lương vì kỳ công chưa chốt.' : 'Kỳ này chưa có dòng lương nào.'}
      <span className="flex flex-wrap justify-center gap-2">
        {month.status === 'waiting' && <Link to={timesheetOf(month)} className={`${OUTLINE} no-underline`}>Mở Chấm công kỳ này</Link>}
        <Link to={`/hr/luong?ky=${before}`} className={`${OUTLINE} no-underline`}>Xem kỳ trước</Link>
      </span>
    </div>
  );
}

function NoMatch({ hasQuery, onClearSearch, onClear }: { hasQuery: boolean; onClearSearch: () => void; onClear: () => void }) {
  return (
    <div className="ts-card flex flex-col items-center gap-2 py-12 text-sm text-slate-600">
      <SearchX className="size-6 text-slate-400" />
      Không có dòng nào khớp.
      <span className="flex gap-2">
        {hasQuery && <button type="button" onClick={onClearSearch} className={OUTLINE}><X className="size-4" />Xoá tìm</button>}
        <button type="button" onClick={onClear} className={OUTLINE}>Xoá lọc</button>
      </span>
    </div>
  );
}

const CHIP = 'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap disabled:opacity-50';

/** Spec 11.2, L-L14: how many typed cells and people with own settings; a click shows only those rows. */
function Legend({ month, only, onOnly }: { month: PayrollMonthDto; only: PayrollOnly; onOnly: (next: PayrollOnly) => void }) {
  const typed = month.lines.reduce((n, l) => n + l.overrides.length, 0);
  const own = month.lines.filter((l) => l.personSettings.length > 0).length;
  const toggle = (value: Exclude<PayrollOnly, null>) => onOnly(only === value ? null : value);
  return (
    <section aria-label="Chú giải" className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <button type="button" aria-pressed={only === 'go-de'} disabled={typed === 0} onClick={() => toggle('go-de')} className={`${CHIP} ${only === 'go-de' ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        <span aria-hidden="true" className="size-2.5 bg-amber-500 [clip-path:polygon(0_0,100%_0,100%_100%)]" />
        {`${typed} ô gõ đè`}
      </button>
      <button type="button" aria-pressed={only === 'rieng'} disabled={own === 0} onClick={() => toggle('rieng')} className={`${CHIP} ${only === 'rieng' ? 'border-teal-500 bg-teal-100 text-teal-900' : 'border-teal-200 bg-teal-50 text-teal-900'}`}>
        <span aria-hidden="true" className="size-1.5 rounded-full bg-teal-600" />
        {`${own} người có cấu hình riêng`}
      </button>
      {month.status !== 'approved' && month.status !== 'paid' && <span className="inline-flex items-center gap-1"><Pencil className="size-3 text-blue-500" />Ô gõ được</span>}
      <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-2.5 bg-sky-500 [clip-path:polygon(0_0,100%_0,100%_100%)]" />Đã gõ tay (để trống là về số tự tính)</span>
      <span className="inline-flex items-center gap-1"><Settings2 className="size-3.5" />Rê chuột vào số để xem công thức và cấu hình đã dùng.</span>
      <span className="inline-flex items-center gap-1"><TriangleAlert className="size-3.5" />Cảnh báo xem ở Rà soát.</span>
    </section>
  );
}

export interface PayrollGridTabProps {
  month: PayrollMonthDto;
  filters: PayrollFilters;
  today: string;
  onOnly: (next: PayrollOnly) => void;
  onClearSearch: () => void;
  onClear: () => void;
}

export function PayrollGridTab({ month, filters, today, onOnly, onClearSearch, onClear }: PayrollGridTabProps) {
  const lines = useMemo(() => filterLines(month.lines, filters), [month.lines, filters]);
  const body =
    month.lines.length === 0 ? <NoLines month={month} />
    : lines.length === 0 ? <NoMatch hasQuery={!!filters.query.trim()} onClearSearch={onClearSearch} onClear={onClear} />
    : <PayrollGrid month={month} lines={lines} />;
  return (
    <>
      <MonthBanners month={month} today={today} />
      <RetroSection month={month} />
      {body}
      {month.lines.length > 0 && <Legend month={month} only={filters.only ?? null} onOnly={onOnly} />}
    </>
  );
}
