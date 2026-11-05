import type { TimesheetCellsInput, TimesheetDto } from '@careers/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { api } from '../../../api';
import { withCells } from './timesheetModel';

export type PeriodChoice = { kind: 'month'; year: number; month: number } | { kind: 'range'; from: string; to: string };

export const sheetKey = (choice: PeriodChoice) => ['hr', 'timesheet', choice] as const;

export const useTimesheet = (choice: PeriodChoice) =>
  useQuery({
    queryKey: sheetKey(choice),
    queryFn: () => (choice.kind === 'month' ? api.hrTimesheet(choice.year, choice.month) : api.hrTimesheetRange(choice.from, choice.to)),
    refetchOnWindowFocus: false,
  });

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Entering is instant: the numbers move first and the server follows, one save at a time. Only the last answer is
 * shown, so an earlier one cannot undo a key pressed since. If a save fails the sheet is read again.
 */
export function useSaveCells(choice: PeriodChoice) {
  const qc = useQueryClient();
  const key = sheetKey(choice);
  const pending = useRef(0);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<unknown>(null);
  const mutation = useMutation({
    scope: { id: 'timesheet-cells' },
    mutationFn: ({ periodId, cells }: { periodId: string; cells: TimesheetCellsInput['cells'] }) => api.hrTimesheetCells(periodId, cells),
    onSuccess: (dto) => {
      pending.current -= 1;
      if (pending.current === 0) {
        qc.setQueryData(key, dto);
        setState('saved');
      }
    },
    onError: (e) => {
      pending.current -= 1;
      setError(e);
      setState('failed');
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  return {
    state,
    error,
    save: (periodId: string, cells: TimesheetCellsInput['cells']) => {
      if (cells.length === 0) return;
      pending.current += 1;
      setState('saving');
      setError(null);
      qc.setQueryData<TimesheetDto>(key, (old) => (old ? withCells(old, cells) : old));
      mutation.mutate({ periodId, cells });
    },
  };
}

/** Any action that answers with the whole sheet: norms, adjustments, closing, reopening. */
export function useSheetAction<T>(choice: PeriodChoice, run: (input: T) => Promise<TimesheetDto>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (dto) => {
      qc.setQueryData(sheetKey(choice), dto);
    },
  });
}

export const useTimesheetLog = (periodId: string | null, isOpen: boolean) =>
  useQuery({
    queryKey: ['hr', 'timesheet-log', periodId],
    queryFn: () => api.hrTimesheetLog(periodId ?? ''),
    enabled: !!periodId && isOpen,
    staleTime: 0,
  });

export const useEmployees = () => useQuery({ queryKey: ['hr', 'employees'], queryFn: () => api.hrEmployees() });
export const useRegions = () => useQuery({ queryKey: ['hr', 'regions'], queryFn: () => api.hrRegions() });
export const useHolidays = () => useQuery({ queryKey: ['hr', 'holidays'], queryFn: () => api.hrHolidays() });
