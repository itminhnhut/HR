import type { TimesheetCellsInput, TimesheetDto } from '@careers/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
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
type Cells = TimesheetCellsInput['cells'];

const SAVED_SHOWN_MS = 3000;

/**
 * Entering is instant: the numbers move first and the server follows, one save at a time. Only the last answer is
 * shown, so an earlier one cannot undo a key pressed since. If a save fails the sheet is read again and what failed
 * is kept, so HR can send it again.
 */
export function useSaveCells(choice: PeriodChoice) {
  const qc = useQueryClient();
  const key = sheetKey(choice);
  const pending = useRef(0);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<unknown>(null);
  const [failed, setFailed] = useState<{ periodId: string; cells: Cells } | null>(null);
  useEffect(() => {
    if (state !== 'saved') return undefined;
    const timer = window.setTimeout(() => setState('idle'), SAVED_SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [state]);
  const mutation = useMutation({
    scope: { id: 'timesheet-cells' },
    mutationFn: ({ periodId, cells }: { periodId: string; cells: Cells }) => api.hrTimesheetCells(periodId, cells),
    onSuccess: (dto) => {
      pending.current -= 1;
      if (pending.current === 0) {
        qc.setQueryData(key, dto);
        setState('saved');
      }
    },
    onError: (e, { periodId, cells }) => {
      pending.current -= 1;
      setError(e);
      setState('failed');
      setFailed((old) => ({ periodId, cells: [...(old?.cells ?? []), ...cells] }));
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  const save = (periodId: string, cells: Cells) => {
    if (cells.length === 0) return;
    pending.current += 1;
    setState('saving');
    setError(null);
    setFailed(null);
    qc.setQueryData<TimesheetDto>(key, (old) => (old ? withCells(old, cells) : old));
    mutation.mutate({ periodId, cells });
  };
  /** Another kind of save (the norms) answers through the same status. */
  const track = (work: Promise<unknown>) => {
    setState('saving');
    setError(null);
    setFailed(null);
    work.then(() => setState('saved')).catch((e: unknown) => {
      setError(e);
      setState('failed');
    });
  };
  const dismiss = () => {
    setFailed(null);
    setError(null);
    setState('idle');
  };
  return { state, error, failed, save, track, dismiss, retry: () => failed && save(failed.periodId, failed.cells) };
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
