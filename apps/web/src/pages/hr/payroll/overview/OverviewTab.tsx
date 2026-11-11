import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { PayrollMonthDto } from '../../../../api';
import type { PayrollFilters } from '../payrollModel';
import { MonthOverview } from './MonthOverview';
import { overviewFromParams, overviewSearch, type OverviewChoice, type OverviewView } from './overviewModel';
import { YearOverview } from './YearOverview';

/** Tổng quan (spec 11.8, step 26): one pay month, or the twelve of a year; the view and the year live in the address. */

const VIEWS: readonly { id: OverviewView; label: string; icon: LucideIcon }[] = [
  { id: 'thang', label: 'Theo tháng', icon: CalendarDays },
  { id: 'nam', label: 'Theo năm', icon: CalendarRange },
];

const STEP =
  'ts-field inline-flex w-9 items-center justify-center rounded-md border bg-white text-slate-700 no-underline hover:bg-slate-50 max-sm:w-11';

export interface OverviewTabProps {
  /** The year of the page's pay month: the year shown unless the address names one. */
  payYear: number;
  filters: PayrollFilters;
  /** The page's pay month once read. */
  month: PayrollMonthDto | undefined;
  /** What the page shows while that month is not there: loading, a wrong `?ky=`, an error. */
  fallback: ReactNode;
}

export function OverviewTab({ payYear, filters, month, fallback }: OverviewTabProps) {
  const [params] = useSearchParams();
  const choice = overviewFromParams(params, payYear);
  const to = (next: OverviewChoice) => ({ search: overviewSearch(params.toString(), next, payYear) });
  /** The month view on one month of the year table: the year stays, to come back to. */
  const monthSearch = (monthKey: string) => {
    const next = new URLSearchParams(params);
    next.set('ky', monthKey);
    next.delete('xem');
    return `?${next.toString()}`;
  };
  return (
    <>
      <section aria-label="Cách xem" className="flex flex-wrap items-center gap-2">
        <nav aria-label="Xem theo" className="inline-flex rounded-md border bg-white p-0.5">
          {VIEWS.map((v) => (
            <Link
              key={v.id}
              to={to({ ...choice, view: v.id })}
              aria-current={choice.view === v.id ? 'page' : undefined}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm font-medium no-underline max-sm:h-10 ${choice.view === v.id ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <v.icon className="size-4" />
              {v.label}
            </Link>
          ))}
        </nav>
        {choice.view === 'nam' && (
          <span role="group" aria-label="Chọn năm" className="inline-flex items-center gap-1">
            <Link to={to({ ...choice, year: choice.year - 1 })} aria-label={`Năm ${choice.year - 1}`} className={STEP}>
              <ChevronLeft className="size-4" />
            </Link>
            <span className="ts-field inline-flex items-center rounded-md border bg-white px-3 text-sm font-semibold tabular-nums">
              {`Năm ${choice.year}`}
            </span>
            <Link to={to({ ...choice, year: choice.year + 1 })} aria-label={`Năm ${choice.year + 1}`} className={STEP}>
              <ChevronRight className="size-4" />
            </Link>
          </span>
        )}
      </section>
      {choice.view === 'nam' && <YearOverview year={choice.year} filters={filters} monthSearch={monthSearch} />}
      {choice.view === 'thang' && (month ? <MonthOverview month={month} filters={filters} /> : fallback)}
    </>
  );
}
