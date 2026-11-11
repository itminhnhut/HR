import { periodMonthOf, todayInVietnam } from '@careers/shared';
import { useSearchParams } from 'react-router';
import { isCellKey } from './cellSources';
import {
  FILTER_PARAMS,
  filtersFromParams,
  monthFromParam,
  monthKeyOf,
  type PayrollFilters,
  type PayrollOnly,
} from './payrollModel';

/** The pay month and the filters live in the address (spec 4.1: `?ky=2026-11&kv=…&tim=…`), shared by every tab. */

type ListKey = keyof typeof FILTER_PARAMS;

const FILTER_NAMES = [...Object.values(FILTER_PARAMS), 'tim', 'loc'];

export function usePayrollAddress() {
  const [params, setParams] = useSearchParams();
  const today = todayInVietnam();
  const choice = monthFromParam(params.get('ky'), today);
  const filters: PayrollFilters = filtersFromParams(params);
  const cell = params.get('tinh');
  /** A wrong `?ky=` still lets HR step to a good month from the current one. */
  const period = choice.ok ? { year: choice.year, month: choice.month } : periodMonthOf(today);

  const write = (change: (next: URLSearchParams) => void, isTyping = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        change(next);
        return next;
      },
      { replace: isTyping },
    );
  const put = (next: URLSearchParams, name: string, value: string) =>
    value ? next.set(name, value) : next.delete(name);

  return {
    today,
    choice,
    period,
    filters,
    search: params.toString(),
    /** Hồ sơ lương open over the grid (`hs`), on the pay levels with `phan=muc`. */
    profileId: params.get('hs'),
    isLevels: params.get('phan') === 'muc',
    /** One computed cell's sources open over the grid (`tinh` the cell, `nguoi` the person). */
    sourceCell: isCellKey(cell) ? cell : null,
    sourcePerson: params.get('nguoi'),
    /** Phiếu lương of one person open over the grid (`phieu`). */
    payslipId: params.get('phieu'),
    closePayslip: () => write((next) => next.delete('phieu')),
    closeSource: () =>
      write((next) => {
        next.delete('tinh');
        next.delete('nguoi');
      }),
    closeProfile: () =>
      write((next) => {
        next.delete('hs');
        next.delete('phan');
      }),
    setPeriod: (year: number, month: number) => write((next) => next.set('ky', monthKeyOf(year, month))),
    setList: (key: ListKey, values: string[]) => write((next) => put(next, FILTER_PARAMS[key], values.join(','))),
    setQuery: (query: string) => write((next) => put(next, 'tim', query), true),
    setOnly: (only: PayrollOnly) => write((next) => put(next, 'loc', only ?? '')),
    clearSearch: () => write((next) => next.delete('tim')),
    clearFilters: () => write((next) => FILTER_NAMES.forEach((name) => next.delete(name))),
  };
}
