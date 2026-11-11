import { CircleAlert, CheckCircle2, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import type { PayrollMonthDto } from '../../../../api';
import { reviewCounts } from '../monthActionsModel';
import { filterLines, formatValue, isFiltered, type PayrollFilters } from '../payrollModel';
import {
  breakdownOf,
  gridLink,
  OVERVIEW_DIMENSIONS,
  NET_PAY_WORDS,
  OVERVIEW_MEASURES,
  reviewLink,
  sumsOf,
  type OverviewDimension,
  type OverviewSums,
} from './overviewModel';
import { MeasureCells, MeasureHeads, Note, TH_LEFT } from './overviewParts';

/** Tổng quan of one pay month (spec 11.8): the totals, the warnings and the split by block, department, region, contract. */

const day = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const nameOf = (month: PayrollMonthDto) => `T${month.month}/${month.year}`;

/** Every number says what it is (R8): an approved month reads its snapshot, a draft still moves. */
const KIND: Record<Exclude<PayrollMonthDto['status'], 'waiting'>, { label: string; tone: string }> = {
  draft: { label: 'Nháp · số còn đổi', tone: 'bg-amber-100 text-amber-900' },
  approved: { label: 'Đã duyệt', tone: 'bg-green-100 text-green-800' },
  paid: { label: 'Đã duyệt · đã chuyển khoản', tone: 'bg-blue-100 text-blue-800' },
};

function Card({
  to,
  label,
  hint,
  value,
  isStrong = false,
}: {
  to: string;
  label: string;
  hint: string;
  value: string;
  isStrong?: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}. Mở Bảng lương`}
      className={`flex min-h-20 flex-col justify-between gap-1 rounded-lg border bg-white px-3 py-2.5 no-underline hover:border-blue-400 hover:bg-blue-50/40 ${isStrong ? 'border-slate-400' : ''}`}
    >
      <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs font-medium text-slate-600">
        <span>{label}</span>
        <span className="text-[11px] whitespace-nowrap text-slate-400">{hint}</span>
      </span>
      <span className={`text-lg tabular-nums text-slate-900 ${isStrong ? 'font-bold' : 'font-semibold'}`}>{value}</span>
    </Link>
  );
}

function Cards({ sums, to }: { sums: OverviewSums; to: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
      <Card to={to} label="Số người" hint="dòng lương" value={`${sums.people} người`} />
      {OVERVIEW_MEASURES.map((m) => (
        <Card
          key={m.id}
          to={to}
          label={m.label}
          hint={m.columns}
          value={formatValue('money', sums[m.id])}
          isStrong={m.id === 'netPay' || m.id === 'totalCost'}
        />
      ))}
    </div>
  );
}

function ReviewCount({
  to,
  count,
  label,
  icon: Icon,
  tone,
}: {
  to: string;
  count: number;
  label: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Link
      to={to}
      aria-label={`${count} cảnh báo ${label}. Mở Rà soát`}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium no-underline hover:underline max-sm:min-h-11 ${tone}`}
    >
      <Icon className="size-4" />
      {`${count} ${label}`}
    </Link>
  );
}

/** The month's warnings are of the whole month, whatever the filters show. */
function Review({ month, filters }: { month: PayrollMonthDto; filters: PayrollFilters }) {
  const { red, yellow } = reviewCounts(month.review);
  const to = reviewLink(month.monthKey, filters);
  return (
    <section aria-label="Rà soát" className="flex flex-wrap items-center gap-2">
      <h3 className="m-0 text-sm font-semibold text-slate-700">Rà soát cả tháng</h3>
      {red + yellow === 0 && (
        <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
          <CheckCircle2 className="size-4" />
          Không có cảnh báo nào.
        </span>
      )}
      {red > 0 && (
        <ReviewCount to={to} count={red} label="đỏ" icon={CircleAlert} tone="border-red-300 bg-red-50 text-red-800" />
      )}
      {yellow > 0 && (
        <ReviewCount
          to={to}
          count={yellow}
          label="vàng"
          icon={TriangleAlert}
          tone="border-amber-300 bg-amber-50 text-amber-900"
        />
      )}
    </section>
  );
}

function Breakdown(p: {
  month: PayrollMonthDto;
  lines: PayrollMonthDto['lines'];
  filters: PayrollFilters;
  dimension: OverviewDimension;
  label: string;
}) {
  const rows = breakdownOf(p.month, p.lines, p.dimension);
  const name = nameOf(p.month);
  /** "Theo loại HĐ": only the first letter goes down. */
  const title = `Theo ${p.label.charAt(0).toLowerCase()}${p.label.slice(1)}`;
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-1">
      <h3 className="m-0 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th scope="col" className={`${TH_LEFT} sticky left-0 bg-slate-50`}>
                {p.label}
              </th>
              <MeasureHeads />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b last:border-b-0">
                <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-slate-800">
                  {row.label}
                </th>
                <MeasureCells
                  sums={row.sums}
                  to={gridLink(p.month.monthKey, p.filters, row.filter)}
                  what={`${row.label} ${name}`}
                />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-slate-50">
              <th scope="row" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-bold text-slate-900">
                Tổng cộng
              </th>
              <MeasureCells
                sums={sumsOf(p.lines)}
                to={gridLink(p.month.monthKey, p.filters)}
                what={`tổng cộng ${name}`}
                isStrong
              />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export function MonthOverview({ month, filters }: { month: PayrollMonthDto; filters: PayrollFilters }) {
  const lines = useMemo(() => filterLines(month.lines, filters), [month.lines, filters]);
  const heading = (
    <h2 className="m-0 flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
      <Users className="size-4 text-blue-600" />
      {`Tháng lương ${nameOf(month)}`}
      <span className="text-sm font-normal text-slate-600">{`kỳ công ${day(month.period.from)} – ${day(month.period.to)}`}</span>
      {month.status !== 'waiting' && (
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${KIND[month.status].tone}`}>
          {KIND[month.status].label}
        </span>
      )}
    </h2>
  );
  if (month.status === 'waiting') {
    return (
      <section aria-label={`Tổng quan ${nameOf(month)}`} className="ts-card flex flex-col gap-3 p-4 max-sm:p-3">
        {heading}
        <Note>
          {`${nameOf(month)} đang chờ chốt công nên chưa có số. `}
          <Link to={`/hr/cham-cong?ky=${month.monthKey}`} className="font-medium text-amber-900 underline">
            Mở Chấm công để chốt kỳ
          </Link>
          . Số dự tính cho tháng chưa chốt công chưa có trên web.
        </Note>
      </section>
    );
  }
  return (
    <section aria-label={`Tổng quan ${nameOf(month)}`} className="ts-card flex flex-col gap-4 p-4 max-sm:p-3">
      {heading}
      {isFiltered(filters) && (
        <p className="m-0 text-sm text-slate-600">{`Đang lọc: ${lines.length}/${month.lines.length} người. Mỗi số là tổng các dòng đang lọc, bằng dòng tổng của Bảng lương.`}</p>
      )}
      <Cards sums={sumsOf(lines)} to={gridLink(month.monthKey, filters)} />
      <p className="m-0 text-xs text-slate-600">{NET_PAY_WORDS}</p>
      <Review month={month} filters={filters} />
      {lines.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-slate-600">Không có dòng lương nào khớp bộ lọc.</p>
      ) : (
        OVERVIEW_DIMENSIONS.map((d) => (
          <Breakdown key={d.id} month={month} lines={lines} filters={filters} dimension={d.id} label={d.label} />
        ))
      )}
    </section>
  );
}
