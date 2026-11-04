import { rejectReasonLabel, sourceName, type SourceFunnelRow } from '@careers/shared';
import { Link } from 'react-router';
import { useSources } from '../../../api/queries';
import { TABLE_HEAD_CELL } from '../design/table';

/** Below this many applications a share says nothing: "1/2 = 50%" would mislead, so the table shows counts only. */
const MIN_FOR_SHARE = 30;

function Count({ value, of }: { value: number; of: number }) {
  return (
    <td className="border-b border-line-soft px-4 py-3 text-right tabular-nums">
      <span className={value > 0 ? 'font-semibold text-navy' : 'text-muted'}>{value}</span>
      {of >= MIN_FOR_SHARE && <span className="ml-1 text-xs text-muted">({Math.round((value / of) * 100)}%)</span>}
    </td>
  );
}

/** From applications to people hired, per source: which source brings someone who stays. */
export function SourceFunnel({ rows }: { rows: readonly SourceFunnelRow[] }) {
  const sources = useSources().data ?? [];
  if (rows.length === 0) return <p className="m-0 text-sm text-slate">Chưa có hồ sơ nào trong khoảng thời gian này.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={`${TABLE_HEAD_CELL} text-left`}>
                Nguồn
              </th>
              {['Hồ sơ', 'Hẹn phỏng vấn', 'Đạt', 'Nhận việc'].map((title) => (
                <th key={title} scope="col" className={`${TABLE_HEAD_CELL} text-right`}>
                  {title}
                </th>
              ))}
              <th scope="col" className={`${TABLE_HEAD_CELL} text-left`}>
                Lý do loại nhiều nhất
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.source}>
                <th scope="row" className="border-b border-line-soft px-4 py-3 text-left font-medium text-navy">
                  <Link to={`/hr/ho-so?nguon=${row.source}`} className="text-navy no-underline hover:underline">
                    {sourceName(sources, row.source)}
                  </Link>
                </th>
                <td className="border-b border-line-soft px-4 py-3 text-right font-semibold tabular-nums text-navy">
                  {row.received}
                </td>
                <Count value={row.interview} of={row.received} />
                <Count value={row.passed} of={row.received} />
                <Count value={row.hired} of={row.received} />
                <td className="border-b border-line-soft px-4 py-3 text-slate">
                  {row.topRejectReason ? rejectReasonLabel(row.topRejectReason) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-xs text-muted">Tính hồ sơ nộp trong khoảng đã chọn, theo bước xa nhất từng đạt.</p>
    </div>
  );
}
