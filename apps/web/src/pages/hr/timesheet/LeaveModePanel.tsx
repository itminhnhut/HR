import { periodMonthOf, todayInVietnam, type LeaveMode } from '@careers/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BookOpenCheck, Check, FileSpreadsheet, Info, type LucideIcon } from 'lucide-react';
import { api } from '../../../api';
import { ErrorState } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { ConfirmDialog } from './dialogs';
import { TabSkeleton } from './skeletons';

const MODES: { id: LeaveMode; icon: LucideIcon; title: string; points: string[] }[] = [
  {
    id: 'law',
    icon: BookOpenCheck,
    title: 'Theo luật (NĐ 145/2020)',
    points: [
      'Ngày lễ được tính vào số ngày xét cộng phép (Điều 66)',
      'Nghỉ không lương có duyệt được tính, tối đa 1 tháng mỗi năm; ốm tối đa 2 tháng (Điều 65 k4, k6)',
      'Thử việc giữ phép cũ; phép các tháng thử việc được cộng khi lên chính thức (Điều 65 k2)',
    ],
  },
  {
    id: 'excel',
    icon: FileSpreadsheet,
    title: 'Như Excel cũ của HR',
    points: ['Ngày lễ, nghỉ không lương không được tính', 'Thử việc không có phép, phép cũ về 0'],
  },
];

/** How annual leave counts, for the open period and the ones after it. Closed periods keep what they closed with. */
export function LeaveModePanel() {
  const qc = useQueryClient();
  const { year, month } = periodMonthOf(todayInVietnam());
  const period = useQuery({ queryKey: ['hr', 'timesheet', 'month', year, month], queryFn: () => api.hrTimesheet(year, month) });
  const [asking, setAsking] = useState(false);
  const change = useMutation({
    mutationFn: (mode: LeaveMode) => api.hrSetLeaveMode(period.data?.periodId ?? '', mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] }),
  });
  if (period.isPending) return <TabSkeleton />;
  if (period.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => period.refetch()} message={errorMessage(period.error)} /></div>;
  const current = period.data.rule.mode ?? 'law';
  const isOpen = period.data.status === 'open';
  // The workbook's way keeps nothing for probation: say what goes before it goes.
  const held = (period.data.rows ?? []).map((r) => r.leaveSoFar?.leavePending ?? 0).filter((d) => d > 0);
  const heldDays = String(held.reduce((sum, d) => sum + d, 0)).replace('.', ',');
  const pick = (mode: LeaveMode) => (mode === 'excel' && current === 'law' && held.length > 0 ? setAsking(true) : change.mutate(mode));
  return (
    <section className="ts-card flex flex-col gap-3 p-4">
      <p className="m-0 flex items-start gap-2 text-sm text-slate-600"><Info className="mt-0.5 size-4 shrink-0 text-blue-600" />Áp dụng cho kỳ T{month}/{year} và các kỳ sau. Kỳ đã chốt giữ nguyên cách tính lúc chốt.</p>
      <div role="radiogroup" aria-label="Cách tính phép" className="grid gap-3 md:grid-cols-2">
        {MODES.map((m) => {
          const isOn = current === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={isOn}
              disabled={!isOpen || change.isPending}
              onClick={() => pick(m.id)}
              className={`flex flex-col gap-2 rounded-lg border p-3 text-left hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 ${isOn ? 'border-blue-600 ring-2 ring-blue-200' : 'bg-white'}`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold"><m.icon className="size-4 text-blue-600" />{m.title}{isOn && <Check className="ml-auto size-4 text-blue-600" />}</span>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-xs text-slate-600">{m.points.map((t) => <li key={t}>{t}</li>)}</ul>
            </button>
          );
        })}
      </div>
      {!isOpen && <p className="m-0 text-sm text-amber-800">Kỳ T{month}/{year} đã chốt. Mở lại kỳ, hoặc đổi ở kỳ sau.</p>}
      {change.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(change.error)}</p>}
      <ConfirmDialog
        open={asking}
        title={`${held.length} người đang giữ ${heldDays} ngày phép chờ từ lúc thử việc. Đổi sang Excel cũ thì số này không được cộng nữa.`}
        confirmLabel="Vẫn đổi"
        isBusy={change.isPending}
        onCancel={() => setAsking(false)}
        onConfirm={() => { setAsking(false); change.mutate('excel'); }}
      />
    </section>
  );
}
