import { RotateCw } from 'lucide-react';
import { Link } from 'react-router';
import { PILL, STATUS_LOOK } from '../MonthActions';
import type { PayrollFilters } from '../payrollModel';
import { usePayrollYear } from '../queries';
import { gridLink, OVERVIEW_MEASURES, yearRowsOf, yearTotalsOf, type YearPart, type YearRow } from './overviewModel';
import { MeasureCells, MeasureHeads, Note, TH_LEFT } from './overviewParts';

/** Tổng quan of a pay year (spec 11.8): T1–T12, one row a month with its status, then the year, split by status. */

const STATUS_WORDS: Record<YearRow['status'], string> = {
  loading: 'Đang tải…',
  none: 'Chưa có dữ liệu',
  error: 'Không tải được',
  waiting: 'Chờ chốt công',
  draft: 'Nháp',
  approved: 'Đã duyệt',
  paid: 'Đã chuyển khoản',
};

const PLAIN_TONE = 'border-slate-200 bg-white text-slate-500';

function statusWords(row: YearRow): string {
  const no = row.loaded?.approval?.no;
  return row.status === 'approved' && no ? `Đã duyệt lần ${no}` : STATUS_WORDS[row.status];
}

function StatusChip({ row }: { row: YearRow }) {
  if (row.status === 'loading' || row.status === 'none')
    return <span className={`${PILL} ${PLAIN_TONE}`}>{statusWords(row)}</span>;
  if (row.status === 'error')
    return <span className={`${PILL} border-red-300 bg-red-50 text-red-800`}>{statusWords(row)}</span>;
  const look = STATUS_LOOK[row.status];
  return (
    <span className={`${PILL} ${look.tone}`}>
      <look.icon className="size-3.5" />
      {statusWords(row)}
    </span>
  );
}

/** Why a month has no number, in the place of its numbers. */
function emptyWords(row: YearRow): string {
  if (row.status === 'none') return 'Chưa có bảng lương trên web';
  if (row.status === 'waiting') return 'Chưa chốt công, chưa có số';
  if (row.status === 'error') return row.message ?? 'Không tải được';
  return 'Đang tải…';
}

function MonthRow(p: {
  row: YearRow;
  year: number;
  filters: PayrollFilters;
  monthSearch: (monthKey: string) => string;
}) {
  const { row } = p;
  const name = `T${row.month}/${p.year}`;
  return (
    <tr className="border-b">
      <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium whitespace-nowrap">
        {row.loaded ? (
          <Link
            to={{ search: p.monthSearch(row.monthKey) }}
            aria-label={`Xem tổng quan ${name}`}
            className="inline-flex min-h-8 items-center font-semibold text-blue-700 underline-offset-2 hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="text-slate-500">{name}</span>
        )}
      </th>
      <td className="px-3 py-2 whitespace-nowrap">
        <StatusChip row={row} />
      </td>
      {row.sums ? (
        <MeasureCells sums={row.sums} to={gridLink(row.monthKey, p.filters)} what={name} />
      ) : (
        <td colSpan={OVERVIEW_MEASURES.length + 1} className="px-3 py-2 text-sm text-slate-500">
          {emptyWords(row)}
        </td>
      )}
    </tr>
  );
}

function TotalRow({ label, part, year }: { label: string; part: YearPart; year: number }) {
  if (part.months === 0) return null;
  return (
    <tr className="border-t bg-slate-50">
      <th
        scope="row"
        colSpan={2}
        className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-bold whitespace-nowrap text-slate-900"
      >
        {`${label} · ${part.months} tháng`}
      </th>
      <MeasureCells sums={part.sums} what={`${label} năm ${year}`} isStrong />
    </tr>
  );
}

export function YearOverview(p: { year: number; filters: PayrollFilters; monthSearch: (monthKey: string) => string }) {
  const { loads, isLoading, retry } = usePayrollYear(p.year);
  const rows = yearRowsOf(p.year, loads, p.filters);
  const totals = yearTotalsOf(rows);
  const hasError = rows.some((r) => r.status === 'error');
  return (
    <section aria-label={`Tổng quan năm ${p.year}`} className="ts-card flex flex-col gap-3 p-4 max-sm:p-3">
      <h2 className="m-0 flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
        {`Năm lương ${p.year}`}
        <span className="text-sm font-normal text-slate-600">{`T1–T12/${p.year}, theo kỳ công`}</span>
        {isLoading && <span className="text-sm font-normal text-slate-500">Đang tải từng tháng…</span>}
      </h2>
      <Note>
        {`Năm ở đây là 12 tháng lương T1–T12/${p.year} theo kỳ công. Khác với năm thuế (tính theo ngày chi trả) và năm đóng bảo hiểm. Tổng năm tách riêng Đã duyệt và Nháp, không cộng lẫn. Tháng chưa chốt công chưa có số dự tính.`}
      </Note>
      {hasError && (
        <button
          type="button"
          onClick={retry}
          className="ts-field inline-flex items-center gap-1.5 self-start rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50"
        >
          <RotateCw className="size-4 text-blue-600" />
          Tải lại tháng bị lỗi
        </button>
      )}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th scope="col" className={`${TH_LEFT} sticky left-0 bg-slate-50`}>
                Tháng
              </th>
              <th scope="col" className={TH_LEFT}>
                Trạng thái
              </th>
              <MeasureHeads />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <MonthRow key={row.monthKey} row={row} year={p.year} filters={p.filters} monthSearch={p.monthSearch} />
            ))}
          </tbody>
          <tfoot>
            <TotalRow label="Đã duyệt" part={totals.approved} year={p.year} />
            <TotalRow label="Nháp" part={totals.draft} year={p.year} />
          </tfoot>
        </table>
      </div>
      <p className="m-0 text-xs text-slate-500">
        Số người ở dòng tổng năm: mỗi người tính một lần. Bấm một số để mở Bảng lương của tháng đó với cùng bộ lọc.
      </p>
    </section>
  );
}
