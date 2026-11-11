import { decimal, money, percent } from './format';
import type { Payslip, PayslipLine, PayslipSection } from './payslip';

/**
 * A payslip on the Phiếu lương tab and in print (spec 11.7): one card a person, a page each when printed, NHÁP
 * across a draft (L-F19). No signature block on the web or in print (Q4, L-L34); it lives only in the Excel.
 */

const show = (line: PayslipLine) => {
  if (line.format === 'money') return money(line.amount);
  if (line.format === 'percent') return percent(line.amount);
  return `${decimal(line.amount)}${line.format === 'hours' ? ' giờ' : ''}`;
};

function Line({ line }: { line: PayslipLine }) {
  const tone = line.isTotal ? 'font-semibold' : line.isDetail ? 'pl-4 italic text-slate-500' : '';
  return (
    <tr className="border-b border-slate-100">
      <td className={`py-1 pr-2 ${tone}`}>{line.label}</td>
      <td className="py-1 pr-2 text-right tabular-nums text-slate-500">{line.base == null ? '' : money(line.base)}</td>
      <td className={`py-1 text-right tabular-nums ${line.isTotal ? 'font-semibold' : ''}`}>{show(line)}</td>
    </tr>
  );
}

function SectionTable({ section }: { section: PayslipSection }) {
  return (
    <table className="mt-3 w-full border-collapse text-xs">
      <thead>
        <tr className="bg-slate-50 text-left">
          <th className="py-1 pr-2">{section.title}</th>
          <th className="py-1 pr-2 text-right font-normal text-slate-500">Mức</th>
          <th className="py-1 text-right font-normal text-slate-500">Thực nhận</th>
        </tr>
      </thead>
      <tbody>
        {section.lines.map((line) => (
          <Line key={line.label} line={line} />
        ))}
      </tbody>
    </table>
  );
}

export function PayslipCard({ slip }: { slip: Payslip }) {
  return (
    <article
      className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 print:break-after-page print:border-0"
      aria-label={`Phiếu lương ${slip.code}`}
    >
      {slip.isDraft && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center text-7xl font-bold text-slate-300/40 -rotate-30"
        >
          NHÁP
        </div>
      )}
      <h2 className="m-0 text-center text-base font-bold text-slate-900">{slip.title}</h2>
      <p className="m-0 text-center text-xs text-slate-500">{slip.stamp}</p>
      {slip.replaces && <p className="m-0 text-center text-xs text-amber-700">{slip.replaces}</p>}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {slip.info.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className="m-0">{value}</dd>
          </div>
        ))}
      </dl>
      {slip.sections.map((section) => (
        <SectionTable key={section.title} section={section} />
      ))}
      <p className="mt-3 flex items-baseline justify-between border-t border-slate-300 pt-2 text-base font-bold">
        <span>THỰC NHẬN</span>
        <span data-testid="payslip-net" className="tabular-nums">
          {money(slip.netPay)}
        </span>
      </p>
      <p className="m-0 text-xs text-slate-600">Chuyển khoản: {slip.bank}</p>
      {slip.notes.map((note) => (
        <p key={note} className="m-0 text-xs italic text-slate-500">
          {note}
        </p>
      ))}
    </article>
  );
}
