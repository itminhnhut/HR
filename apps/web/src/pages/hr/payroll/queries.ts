import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, ApiError, type PayrollLogQuery, type PayrollMonthDto, type PayrollMonthInputsInput } from '../../../api';
import { errorMessage } from '../parts';
import { withSavedLine } from './monthInputsModel';
import type { MonthLoad } from './overview/overviewModel';

type MonthChoice = { year: number; month: number };

const monthKey = (choice: MonthChoice | null) => ['hr', 'payroll', 'month', choice?.year, choice?.month];

/** One payroll month; reading it writes nothing (spec 4.13). A month the server refuses is not asked again. */
const monthOptions = (choice: MonthChoice | null) => ({
  queryKey: monthKey(choice),
  queryFn: () => (choice ? api.hrPayrollMonth(choice.year, choice.month) : Promise.reject(new Error('Chưa chọn kỳ'))),
  enabled: choice !== null,
  refetchOnWindowFocus: false,
  retry: (count: number, error: unknown) => !(error instanceof ApiError && error.status < 500) && count < 2,
});

export const usePayrollMonth = (choice: MonthChoice | null) => useQuery(monthOptions(choice));

/** A month the server has no payroll for (before the web, too far ahead): said as such, not as a failure. */
export const isNoSuchMonth = (error: unknown) => error instanceof ApiError && error.status < 500;

const YEAR_MONTHS = Array.from({ length: 12 }, (_, i) => 12 - i);
/** A month read by Tổng quan is not read again for a while; a change made on the web marks it stale itself. */
const YEAR_STALE_MS = 5 * 60_000;

/**
 * T12 down to T1 of a pay year for Tổng quan (spec 11.8), one request at a time so a year never asks the server
 * for twelve months at once; each month is the cache entry Bảng lương reads. The months before the first one the
 * server has are not asked: once a later month answered, a "no such month" ends the walk.
 */
export function usePayrollYear(year: number) {
  const [walk, setWalk] = useState({ year, asked: 1 });
  const asked = walk.year === year ? walk.asked : 1;
  const results = useQueries({
    queries: YEAR_MONTHS.map((month, i) => ({
      ...monthOptions({ year, month }),
      staleTime: YEAR_STALE_MS,
      enabled: i < asked,
    })),
  });
  const last = results[asked - 1];
  const isSettled = !last || (!last.isPending && !last.isFetching);
  const isEnd = !!last && isNoSuchMonth(last.error) && results.slice(0, asked - 1).some((r) => r.isSuccess);
  useEffect(() => {
    if (isSettled && !isEnd && asked < YEAR_MONTHS.length) setWalk({ year, asked: asked + 1 });
  }, [isSettled, isEnd, asked, year]);
  const loads = results.map((r, i): MonthLoad => {
    if (r.data) return { kind: 'month', month: r.data };
    if (isNoSuchMonth(r.error) || (isEnd && i >= asked)) return { kind: 'none' };
    return r.isError ? { kind: 'error', message: errorMessage(r.error) } : { kind: 'loading' };
  });
  /** T1 first. */
  return {
    loads: [...loads].reverse(),
    isLoading: loads.some((l) => l.kind === 'loading'),
    retry: () => results.filter((r) => r.isError && !isNoSuchMonth(r.error)).forEach((r) => void r.refetch()),
  };
}

/** Duyệt, Mở lại, Đã chuyển khoản: each answers with the whole month, which replaces the one on screen. */
export function usePayrollAction<T>(choice: MonthChoice, run: (input: T) => Promise<PayrollMonthDto>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (month) => qc.setQueryData(monthKey(choice), month),
  });
}

/** Đầu vào tháng of one person: the answer's row, computed again, replaces the person's row on screen. */
export function useSaveMonthInputs(monthKeyText: string) {
  const qc = useQueryClient();
  const choice = { year: Number(monthKeyText.slice(0, 4)), month: Number(monthKeyText.slice(5, 7)) };
  return useMutation({
    mutationFn: ({ employeeId, input }: { employeeId: string; input: PayrollMonthInputsInput }) =>
      api.hrPayrollSaveInputs(monthKeyText, employeeId, input),
    onSuccess: (saved, { employeeId }) =>
      qc.setQueryData<PayrollMonthDto>(monthKey(choice), (month) =>
        month ? withSavedLine(month, employeeId, saved) : month,
      ),
  });
}

const LOG_PAGE_SIZE = 100;

/** Nhật ký lương, a hundred lines at a time (spec 11.9); always read again, a line may have been written since. */
export const usePayrollLog = (query: Omit<PayrollLogQuery, 'offset'>) =>
  useInfiniteQuery({
    queryKey: ['hr', 'payroll', 'log', query],
    queryFn: ({ pageParam }) => api.hrPayrollLog({ ...query, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, _all, offset) => (last.hasMore ? offset + LOG_PAGE_SIZE : undefined),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
