import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api';
import type { RetroPatch } from './retroModel';

/**
 * Truy lĩnh / truy thu left out, typed over or put back for one or many people: one save of the month inputs per
 * person, one after the other, then the month is read again (its items, totals and Rà soát all move).
 */
export function useSaveRetro(monthKeyText: string) {
  const qc = useQueryClient();
  const year = Number(monthKeyText.slice(0, 4));
  const month = Number(monthKeyText.slice(5, 7));
  return useMutation({
    mutationFn: async (patches: readonly RetroPatch[]) => {
      for (const patch of patches) await api.hrPayrollSaveInputs(monthKeyText, patch.employeeId, patch.input);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['hr', 'payroll', 'month', year, month] }),
  });
}
