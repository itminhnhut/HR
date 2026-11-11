import type { PayrollSettingInput, PayrollSettingSavedDto } from '@careers/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../../../api';
import { fromWords } from './configModel';

/** Cấu hình lương of one month, and the three ways to change it; each save refreshes the month and the sheet. */

const SETTINGS = ['hr', 'payroll', 'settings'] as const;

export const useSettingsMonth = (month: string) =>
  useQuery({
    queryKey: [...SETTINGS, month],
    queryFn: () => api.hrPayrollSettingsMonth(month),
    refetchOnWindowFocus: false,
  });

export type SettingChange =
  | { kind: 'add'; input: PayrollSettingInput }
  | { kind: 'correct'; id: string; value: unknown; source: string }
  | { kind: 'delete'; id: string };

function run(change: SettingChange): Promise<PayrollSettingSavedDto | null> {
  if (change.kind === 'add') return api.hrPayrollAddSetting(change.input);
  if (change.kind === 'correct') return api.hrPayrollCorrectSetting(change.id, change);
  return api.hrPayrollDeleteSetting(change.id).then(() => null);
}

function doneWords(change: SettingChange, saved: PayrollSettingSavedDto | null): string {
  if (change.kind === 'delete' || !saved) return 'Đã xoá dòng cấu hình.';
  if (change.kind === 'correct') return `Đã sửa lỗi mức từ ${fromWords(saved.setting.from)}.`;
  const who = saved.setting.employeeId ? 'cho một người' : 'cho tất cả';
  const what = saved.setting.stop ? 'Đã bỏ' : 'Đã lưu';
  return `${what} ${who}, từ ${fromWords(saved.setting.from)}.`;
}

/** Every change is written in the payroll log by the API; the toast says what happened and what it touched. */
export function useSettingChange(onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (saved, change) => {
      void qc.invalidateQueries({ queryKey: SETTINGS });
      void qc.invalidateQueries({ queryKey: ['hr', 'payroll', 'month'] });
      toast.success(doneWords(change, saved));
      saved?.warnings.forEach((w) => toast.warning(w));
      if (saved && saved.approvedMonthsTouched.length > 0)
        toast.warning(`Chạm tháng đã duyệt: ${saved.approvedMonthsTouched.map(fromWords).join(', ')}.`);
      onDone?.();
    },
  });
}

export interface PeopleSaveResult {
  saved: PayrollSettingSavedDto[];
  failed: { employeeId: string; error: unknown }[];
}

/**
 * The same value for several people in one action: the API stores one row per person, so one request each. Those the
 * API refuses come back in `failed` for the form to name; the others are saved and the sheet computes again.
 */
export function useSettingForPeople() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: readonly PayrollSettingInput[]): Promise<PeopleSaveResult> => {
      const results = await Promise.allSettled(inputs.map((input) => api.hrPayrollAddSetting(input)));
      const saved = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      const failed = results.flatMap((r, i) =>
        r.status === 'rejected' ? [{ employeeId: inputs[i]?.employeeId ?? '', error: r.reason as unknown }] : [],
      );
      // One person refused is that person's error, on the form's own fields.
      if (saved.length === 0 && failed.length === 1) throw failed[0]?.error;
      return { saved, failed };
    },
    onSuccess: ({ saved, failed }) => {
      if (saved.length === 0) return;
      void qc.invalidateQueries({ queryKey: SETTINGS });
      void qc.invalidateQueries({ queryKey: ['hr', 'payroll', 'month'] });
      const from = saved[0] ? fromWords(saved[0].setting.from) : '';
      if (failed.length === 0) toast.success(`Đã lưu cho ${saved.length} người, từ ${from}.`);
      [...new Set(saved.flatMap((s) => s.warnings))].forEach((w) => toast.warning(w));
      const touched = [...new Set(saved.flatMap((s) => s.approvedMonthsTouched))];
      if (touched.length > 0) toast.warning(`Chạm tháng đã duyệt: ${touched.map(fromWords).join(', ')}.`);
    },
  });
}
