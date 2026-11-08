import { periodMonthOf, standardPeriod, todayInVietnam } from '@careers/shared';
import { Building2, CalendarDays, CalendarOff, ChevronRight, History, Home, Settings, Users, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Toaster } from 'sonner';
import { ApiError } from '../../../api';
import { usePageMeta } from '../../../lib/hooks';
import { EmptyState, ErrorState } from '../../../ui/feedback';
import { Logo } from '../../../ui/Logo';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { errorMessage } from '../parts';
import { GridTab } from './GridTab';
import { PeopleTab } from './PeopleTab';
import { useTimesheet, type PeriodChoice } from './queries';
import { LeaveTab } from './LeaveTab';
import { CompanyLeaveTab } from './CompanyLeaveTab';
import { ConfigTab, showWhenOffScreen } from './ConfigTab';
import { LogTab } from './LogTab';
import { SheetSkeleton } from './skeletons';
import './timesheet.css';

const BASE = '/hr/cham-cong';
const TABS: { id: 'grid' | 'leave' | 'company-leave' | 'people' | 'settings' | 'log'; label: string; icon: LucideIcon; path: string }[] = [
  { id: 'grid', label: 'Bảng công', icon: CalendarDays, path: BASE },
  { id: 'leave', label: 'Nghỉ, đi muộn', icon: CalendarOff, path: `${BASE}/nghi` },
  { id: 'company-leave', label: 'Nghỉ công ty', icon: Building2, path: `${BASE}/nghi-cong-ty` },
  { id: 'people', label: 'Nhân viên', icon: Users, path: `${BASE}/nhan-vien` },
  { id: 'settings', label: 'Cấu hình', icon: Settings, path: `${BASE}/cau-hinh` },
  { id: 'log', label: 'Nhật ký', icon: History, path: `${BASE}/nhat-ky` },
];

function useChoice() {
  const [params, setParams] = useSearchParams();
  const from = params.get('tu');
  const to = params.get('den');
  const month = /^(\d{4})-(\d{2})$/.exec(params.get('ky') ?? '');
  const current = periodMonthOf(todayInVietnam());
  const choice: PeriodChoice =
    from && to ? { kind: 'range', from, to } : month ? { kind: 'month', year: Number(month[1]), month: Number(month[2]) } : { kind: 'month', ...current };
  const apply = ({ from: start, to: stop }: { from: string; to: string }) => {
    const owner = periodMonthOf(stop);
    const standard = standardPeriod(owner.year, owner.month);
    if (standard.from === start && standard.to === stop) setParams({ ky: `${owner.year}-${String(owner.month).padStart(2, '0')}` });
    else setParams({ tu: start, den: stop });
  };
  return { choice, apply };
}

function SheetError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // A wrong month in the link will not get better by trying again.
  if (error instanceof ApiError && error.status < 500) {
    return (
      <div className="ts-site-tokens">
        <EmptyState icon="calendar" title="Không mở được kỳ này" actions={<Link to={BASE} className="ts-field inline-flex items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white no-underline hover:text-white">Về kỳ này</Link>}>
          {errorMessage(error)}
        </EmptyState>
      </div>
    );
  }
  return <div className="ts-site-tokens"><ErrorState onRetry={onRetry} message={errorMessage(error)} /></div>;
}

function SheetTab({ slot }: { slot: HTMLElement | null }) {
  const { choice, apply } = useChoice();
  const sheet = useTimesheet(choice);
  if (sheet.isPending) return <SheetSkeleton />;
  if (sheet.isError) return <SheetError error={sheet.error} onRetry={() => void sheet.refetch()} />;
  // A new key for a new period: the grid's columns and its undo history belong to one period.
  return <GridTab key={`${sheet.data.from}|${sheet.data.to}`} dto={sheet.data} choice={choice} onPeriod={apply} actionsSlot={slot} />;
}

function TopBar({ label }: { label?: string }) {
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-3 border-b bg-white px-5 py-2">
      <Link to="/hr" aria-label="Về trang quản trị" className="flex no-underline"><Logo isCompact className="h-8" /></Link>
      <span aria-hidden="true" className="h-6 w-px bg-slate-200 max-sm:hidden" />
      <nav aria-label="Đường dẫn" className="flex items-center gap-1 text-sm whitespace-nowrap text-slate-500">
        <Link to="/hr" className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-slate-500 no-underline hover:text-blue-700 hover:underline"><Home className="size-3.5" />Quản trị</Link>
        <ChevronRight className="size-3.5" />
        <Link to={BASE} className="inline-flex items-center rounded px-1.5 py-0.5 text-slate-500 no-underline hover:text-blue-700 hover:underline">Chấm công</Link>
        <ChevronRight className="size-3.5" />
        <span aria-current="page" className="px-1.5 font-medium text-slate-800">{label}</span>
      </nav>
    </header>
  );
}

export function TimesheetPage() {
  usePageMeta('Chấm công');
  const { pathname } = useLocation();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // The old address of Cấu hình still opens it, for links already saved.
  const path = pathname.replace(/\/$/, '').replace(/\/cai-dat$/, '/cau-hinh');
  const tab = TABS.find((t) => t.path === path) ?? TABS[0];
  useLayoutEffect(() => {
    document.body.classList.add('hr-timesheet');
    return () => document.body.classList.remove('hr-timesheet');
  }, []);
  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col">
        <TopBar label={tab?.label} />
        <div className="flex flex-col gap-2.5 px-5 py-3 max-sm:px-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-red-100 text-red-700"><CalendarDays className="size-5" /></span>
            <h1 className="m-0 text-2xl font-bold whitespace-nowrap sm:text-[28px]">Chấm công</h1>
            <nav aria-label="Mục chấm công" className="max-w-full overflow-x-auto flex border-b">
              {TABS.map((t) => (
                <Link key={t.id} ref={tab?.id === t.id ? showWhenOffScreen : undefined} to={t.path} aria-current={tab?.id === t.id ? 'page' : undefined} className={`-mb-px inline-flex shrink-0 whitespace-nowrap h-9 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium whitespace-nowrap no-underline ${tab?.id === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                  <t.icon className="size-4" />
                  {t.label}
                </Link>
              ))}
            </nav>
            <div ref={setSlot} className="ml-auto flex flex-wrap items-center gap-2 max-md:ml-0" />
          </div>
          {tab?.id === 'grid' && <SheetTab slot={slot} />}
          {tab?.id === 'leave' && <LeaveTab />}
          {tab?.id === 'company-leave' && <CompanyLeaveTab />}
          {tab?.id === 'people' && <PeopleTab />}
          {tab?.id === 'settings' && <ConfigTab />}
          {tab?.id === 'log' && <LogTab />}
        </div>
      </div>
      <Toaster position="bottom-center" offset={{ bottom: 72 }} mobileOffset={{ bottom: 72 }} richColors duration={2500} />
    </TooltipProvider>
  );
}

export default TimesheetPage;
