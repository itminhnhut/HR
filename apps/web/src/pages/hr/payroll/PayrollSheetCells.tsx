import type { PayrollCellKey } from '@careers/shared';
import { Link, useLocation } from 'react-router';
import type { PayrollLineDto } from '../../../api';
import { cellSearch } from './cellSources';

/** (7) Số NPT and (39) Bậc thuế of HR's file: small numbers that open where they come from, over the grid. */

function SourceNumber(p: { line: PayrollLineDto; cell: PayrollCellKey; text: string; label: string }) {
  const { pathname, search } = useLocation();
  return (
    <Link
      to={{ pathname, search: cellSearch(search, p.line.employeeId, p.cell) }}
      aria-label={p.label}
      title={p.label}
      className="block text-center text-sm text-slate-800 no-underline decoration-dotted underline-offset-2 tabular-nums hover:underline"
    >
      {p.text}
    </Link>
  );
}

const EMPTY = <span className="block text-center text-sm text-slate-400">—</span>;

/** The dependants counted on the pay date: a click opens the person's dependants (add, edit, stop) behind (36). */
export function DependantsCell({ line }: { line: PayrollLineDto }) {
  const count = line.sheet?.dependants;
  if (count === undefined) return EMPTY;
  return (
    <SourceNumber
      line={line}
      cell="dependantDeduction"
      text={String(count)}
      label={`Xem và sửa người phụ thuộc của ${line.fullName}`}
    />
  );
}

/** The bracket (38) reaches; empty when the month's tax is not progressive, as in HR's file. */
export function BracketCell({ line, bracket }: { line: PayrollLineDto; bracket: number }) {
  if (bracket <= 0) return <span />;
  return (
    <SourceNumber
      line={line}
      cell="tax"
      text={String(bracket)}
      label={`Xem cách tính thuế của ${line.fullName} (bậc ${bracket})`}
    />
  );
}
