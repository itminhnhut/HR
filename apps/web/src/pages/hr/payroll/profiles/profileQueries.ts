import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '../../../../api';

/** Hồ sơ lương: the list, one person, the prefill and the checklist; every save refreshes all four and says so. */

const LIST = ['hr', 'payroll', 'profiles'] as const;
const CHECKLIST = ['hr', 'payroll', 'checklist'] as const;
const profileKey = (employeeId: string) => ['hr', 'payroll', 'profile', employeeId] as const;

export const useProfiles = () => useQuery({ queryKey: LIST, queryFn: () => api.hrPayrollProfiles() });

export const useChecklist = () =>
  useQuery({ queryKey: CHECKLIST, queryFn: () => api.hrPayrollChecklist(), refetchOnWindowFocus: false });

export const useProfile = (employeeId: string) =>
  useQuery({ queryKey: profileKey(employeeId), queryFn: () => api.hrPayrollProfile(employeeId) });

export const usePrefill = (employeeId: string, isWanted: boolean) =>
  useQuery({
    queryKey: [...profileKey(employeeId), 'prefill'],
    queryFn: () => api.hrPayrollProfilePrefill(employeeId),
    enabled: isWanted,
  });

/** Field errors of the last failed save, keyed like the API's (`effectiveOn`, `accountNumber`, …). */
export const fieldErrorsOf = (error: unknown): Record<string, string> =>
  error instanceof ApiError ? error.fieldErrors : {};

/** A save of one profile part: refreshes the person, the list and the checklist, then a toast with `done`. */
export function useProfileSave<T, R>(
  employeeId: string,
  run: (input: T) => Promise<R>,
  done: (result: R, input: T) => string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (result, input) => {
      void qc.invalidateQueries({ queryKey: profileKey(employeeId) });
      void qc.invalidateQueries({ queryKey: LIST });
      void qc.invalidateQueries({ queryKey: CHECKLIST });
      // Bảng lương computes from the profile: its rows follow a saved level, open over the grid or not.
      void qc.invalidateQueries({ queryKey: ['hr', 'payroll', 'month'] });
      toast.success(done(result, input));
    },
  });
}
