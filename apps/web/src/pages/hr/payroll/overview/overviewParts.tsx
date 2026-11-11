import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatValue } from '../payrollModel';
import { OVERVIEW_MEASURES, type OverviewSums } from './overviewModel';

/** The cells Tổng quan's tables share: a number that opens Bảng lương where its total row is that number (spec 4.4). */

export const TH = 'h-10 px-3 text-right text-xs font-semibold whitespace-nowrap text-slate-600';
/** The head of a column of words: left, as its cells. */
export const TH_LEFT = 'h-10 px-3 text-left text-xs font-semibold whitespace-nowrap text-slate-600';
export const TD = 'px-3 py-2 text-right whitespace-nowrap tabular-nums';
const LINK =
  'inline-flex min-h-8 items-center justify-end font-medium text-blue-700 underline-offset-2 hover:underline';

export function NumberLink({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Link to={to} aria-label={label} className={LINK}>
      {children}
    </Link>
  );
}

/** The head cells of the figures, people first: the same columns in the breakdowns and in the year. */
export function MeasureHeads() {
  return (
    <>
      <th scope="col" className={TH}>
        Số người
      </th>
      {OVERVIEW_MEASURES.map((m) => (
        <th key={m.id} scope="col" className={TH} title={`Cột ${m.columns} của Bảng lương`}>
          {m.label}
        </th>
      ))}
    </>
  );
}

/**
 * The figures of one row. `to`: Bảng lương showing exactly these lines; without it the numbers are plain (a total
 * over several months has no one grid to open). `what` names the row for a screen reader ("khối KD T10/2026").
 */
export function MeasureCells({
  sums,
  to,
  what,
  isStrong = false,
}: {
  sums: OverviewSums;
  to?: string;
  what: string;
  isStrong?: boolean;
}) {
  const weight = isStrong ? 'font-bold text-slate-900' : '';
  const cell = (label: string, text: string) =>
    to ? (
      <NumberLink to={to} label={`${label} ${what}: ${text}. Mở Bảng lương`}>
        {text}
      </NumberLink>
    ) : (
      text
    );
  return (
    <>
      <td className={`${TD} ${weight}`}>{cell('Số người', String(sums.people))}</td>
      {OVERVIEW_MEASURES.map((m) => (
        <td key={m.id} className={`${TD} ${weight}`}>
          {cell(m.label, formatValue('money', sums[m.id]))}
        </td>
      ))}
    </>
  );
}

/** Where the web parts from what HR might expect: amber, never blocking (owner's rule). */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{children}</p>
  );
}
