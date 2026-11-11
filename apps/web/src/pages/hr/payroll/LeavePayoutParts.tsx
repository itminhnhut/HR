import type { PayrollCellKey, PayrollLeavePayoutDto, PayrollLineYearDto } from '@careers/shared';
import { formatValue } from './payrollModel';
import { leavePayoutLines, yearToDateOf } from './leavePayoutModel';

/** Tiền phép chưa nghỉ in the (24) editor, and the tax year's running numbers in a cell's sources. */

const FIELD = 'ts-field h-8 min-w-0 rounded-md border bg-white px-2 text-right text-sm tabular-nums';

/**
 * Its own item of (24) for someone leaving in the period: the formula with the row's numbers, and the amount HR may
 * type over it (empty: as computed; 0: pay nothing).
 */
export function LeavePayoutBox(p: {
  /** Null for someone not leaving in the period with nothing typed: the web computes none, HR may still type one. */
  payout: PayrollLeavePayoutDto | null;
  text: string;
  onText: (text: string) => void;
}) {
  const { payout } = p;
  const lines = payout && payout.days > 0 ? leavePayoutLines(payout) : [];
  return (
    <section
      aria-label="Tiền phép chưa nghỉ"
      className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-2"
    >
      <p className="m-0 text-xs font-semibold text-slate-800">Tiền phép chưa nghỉ</p>
      {lines.map((text) => (
        <p key={text} className="m-0 text-xs break-words text-slate-700 tabular-nums">
          {text}
        </p>
      ))}
      {lines.length === 0 && (
        <p className="m-0 text-xs text-slate-600">
          Không nghỉ việc trong kỳ nên web không tự tính. Số nhập ở đây chịu thuế toàn bộ.
        </p>
      )}
      <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-700">
        Số tiền trả
        <input
          aria-label="Tiền phép chưa nghỉ"
          inputMode="numeric"
          placeholder={lines.length > 0 ? 'Tự tính' : 'Không có'}
          value={p.text}
          onChange={(e) => p.onText(e.target.value)}
          className={`${FIELD} w-36`}
        />
      </label>
      <p className="m-0 text-[11px] text-slate-500">
        Để trống: web tự tính. Nhập 0: không trả. Khoản này nằm trong (24).
      </p>
      {payout && payout.typed !== null && payout.typed < payout.computed && (
        <p className="m-0 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
          Thấp hơn số tính: BLLĐ Đ.113 k3 yêu cầu trả đủ tiền lương cho những ngày phép chưa nghỉ.
        </p>
      )}
    </section>
  );
}

const show = (kind: 'money' | 'hours', n: number) =>
  kind === 'money' ? formatValue('money', n) : `${formatValue('hours', n)} giờ`;

/** Số cộng dồn năm thuế a cell reads: before this pay, this row, and both. Nothing for a cell the year does not touch. */
export function YearToDate({ cell, year }: { cell: PayrollCellKey; year: PayrollLineYearDto | undefined }) {
  const lines = yearToDateOf(cell, year);
  if (lines.length === 0) return null;
  return (
    <section aria-label="Cộng dồn năm thuế" className="flex flex-col gap-2 border-b px-5 py-4">
      <h3 className="m-0 text-base font-semibold">Cộng dồn năm thuế</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-xs text-slate-600">
              <th scope="col" className="py-1.5 pr-3 text-left font-semibold">
                Khoản
              </th>
              <th
                scope="col"
                className="px-3 py-1.5 text-right font-semibold whitespace-nowrap max-sm:px-2 max-sm:whitespace-normal"
              >
                Trước kỳ này
              </th>
              <th
                scope="col"
                className="px-3 py-1.5 text-right font-semibold whitespace-nowrap max-sm:px-2 max-sm:whitespace-normal"
              >
                Kỳ này
              </th>
              <th
                scope="col"
                className="py-1.5 pl-3 text-right font-semibold whitespace-nowrap max-sm:pl-2 max-sm:whitespace-normal"
              >
                Đến hết kỳ này
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.label} className="border-b last:border-b-0">
                <th scope="row" className="min-w-24 py-1.5 pr-3 text-left font-medium">
                  {l.label}
                </th>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums max-sm:px-2">
                  {show(l.kind, l.before)}
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums max-sm:px-2">
                  {show(l.kind, l.month)}
                </td>
                <td className="py-1.5 pl-3 text-right font-semibold whitespace-nowrap tabular-nums max-sm:pl-2">
                  {show(l.kind, l.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-xs text-slate-600">
        Năm thuế tính theo ngày chi trả. "Trước kỳ này" gồm số đầu năm HR nhập và các tháng lương đã chi trong năm.
      </p>
    </section>
  );
}
