import { useQuery } from '@tanstack/react-query';
import { Building2, BadgeCheck, Flag, MapPin, Tags, UserCheck, type LucideIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { api } from '../../../api';
import { KindsPanel } from './AbsenceKinds';
import { ApproversPanel, useApprovers } from './ApproverField';
import { HolidaysCard } from './HolidaysCard';
import { DepartmentsPanel, StaffKindsPanel } from './MasterPanels';
import { useDepartments, useRegions, useStaffKinds } from './queries';
import { RegionsPanel } from './SettingsTab';

type SectionId = 'bo-phan' | 'loai-nv' | 'khu-vuc' | 'ngay-le' | 'ly-do' | 'nguoi-duyet';

/** On a phone the list scrolls sideways: the open one must not hide past the edge. */
export const showWhenOffScreen = (el: HTMLElement | null) => el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });

function SectionLink({ icon: Icon, tone, label, count, isOn, onPick }: { icon: LucideIcon; tone: string; label: string; count?: number; isOn: boolean; onPick: () => void }) {
  return (
    <button ref={isOn ? showWhenOffScreen : undefined} type="button" aria-current={isOn ? 'page' : undefined} onClick={onPick} className={`flex h-10 shrink-0 items-center gap-2.5 rounded-md px-3 text-left text-sm font-medium whitespace-nowrap max-lg:h-11 ${isOn ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}>
      <Icon className={`size-4 shrink-0 ${tone}`} />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-700 tabular-nums">{count}</span>}
    </button>
  );
}

/** Everything HR sets up once, in one place. A change reaches the filters, the staff form and the sheet at once. */
export function ConfigTab() {
  const [params, setParams] = useSearchParams();
  const departments = useDepartments();
  const kinds = useStaffKinds();
  const regions = useRegions();
  const reasons = useQuery({ queryKey: ['hr', 'absence-kinds'], queryFn: () => api.hrAbsenceKinds() });
  const approvers = useApprovers();
  const current = (params.get('muc') ?? 'bo-phan') as SectionId;
  const sections: { id: SectionId; icon: LucideIcon; tone: string; label: string; count?: number }[] = [
    { id: 'bo-phan', icon: Building2, tone: 'text-blue-600', label: 'Bộ phận', count: departments.data?.length },
    { id: 'loai-nv', icon: BadgeCheck, tone: 'text-green-600', label: 'Loại nhân viên', count: kinds.data?.length },
    { id: 'khu-vuc', icon: MapPin, tone: 'text-rose-600', label: 'Khu vực', count: regions.data?.length },
    { id: 'ngay-le', icon: Flag, tone: 'text-teal-600', label: 'Ngày lễ, Tết' },
    { id: 'ly-do', icon: Tags, tone: 'text-indigo-600', label: 'Lý do nghỉ', count: reasons.data?.length },
    { id: 'nguoi-duyet', icon: UserCheck, tone: 'text-emerald-600', label: 'Người duyệt', count: approvers.data?.length },
  ];
  return (
    <div className="grid items-start gap-3 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Mục cấu hình" className="ts-card flex gap-1 overflow-x-auto p-2 lg:flex-col">
        {sections.map((s) => <SectionLink key={s.id} icon={s.icon} tone={s.tone} label={s.label} count={s.count} isOn={s.id === current} onPick={() => setParams({ muc: s.id })} />)}
      </nav>
      <div className="min-w-0">
        {current === 'bo-phan' && <div className="ts-card p-4"><DepartmentsPanel departments={departments.data ?? []} /></div>}
        {current === 'loai-nv' && <div className="ts-card p-4"><StaffKindsPanel kinds={kinds.data ?? []} /></div>}
        {current === 'khu-vuc' && <RegionsPanel />}
        {current === 'ngay-le' && <HolidaysCard />}
        {current === 'ly-do' && <div className="ts-card p-4"><KindsPanel kinds={reasons.data ?? []} /></div>}
        {current === 'nguoi-duyet' && <div className="ts-card p-4"><ApproversPanel /></div>}
      </div>
    </div>
  );
}
