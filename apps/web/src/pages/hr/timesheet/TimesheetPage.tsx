import { periodMonthOf, standardPeriod, todayInVietnam } from '@careers/shared';
import { CalendarDays, ChevronRight, Home, Settings, Users, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { usePageMeta } from '../../../lib/hooks';
import { ErrorState, LoadingStatus } from '../../../ui/feedback';
import { Logo } from '../../../ui/Logo';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { errorMessage } from '../parts';
import { GridTab } from './GridTab';
import { PeopleTab } from './PeopleTab';
import { useTimesheet, type PeriodChoice } from './queries';
import { SettingsTab } from './SettingsTab';
import './timesheet.css';

const BASE = '/hr/cham-cong';
const TABS: { id: 'grid' | 'people' | 'settings'; label: string; icon: LucideIcon; path: string }[] = [
  { id: 'grid', label: 'Bảng công', icon: CalendarDays, path: BASE },
  { id: 'people', label: 'Nhân viên', icon: Users, path: `${BASE}/nhan-vien` },
  { id: 'settings', label: 'Cài đặt', icon: Settings, path: `${BASE}/cai-dat` },
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

function SheetTab({ slot }: { slot: HTMLElement | null }) {
  const { choice, apply } = useChoice();
  const sheet = useTimesheet(choice);
  if (sheet.isPending) return <LoadingStatus />;
  if (sheet.isError) return <ErrorState onRetry={() => sheet.refetch()} message={errorMessage(sheet.error)} />;
  // A new key for a new period: the grid's columns and its undo history belong to one period.
  return <GridTab key={`${sheet.data.from}|${sheet.data.to}`} dto={sheet.data} choice={choice} onPeriod={apply} actionsSlot={slot} />;
}

export function TimesheetPage() {
  usePageMeta('Chấm công');
  const { pathname } = useLocation();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const tab = TABS.find((t) => t.path === pathname.replace(/\/$/, '')) ?? TABS[0];
  useLayoutEffect(() => {
    document.body.classList.add('hr-timesheet');
    return () => document.body.classList.remove('hr-timesheet');
  }, []);
  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col">
        <header className="flex min-h-14 flex-wrap items-center gap-3 border-b bg-white px-5 py-2">
          <Link to="/hr" aria-label="Về trang quản trị" className="flex no-underline"><Logo isCompact className="h-8" /></Link>
          <span aria-hidden="true" className="h-6 w-px bg-slate-200 max-sm:hidden" />
          <nav aria-label="Đường dẫn" className="flex items-center gap-1 text-sm text-slate-500">
            <Link to="/hr" className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-slate-500 no-underline hover:text-blue-700 hover:underline"><Home className="size-3.5" />Quản trị</Link>
            <ChevronRight className="size-3.5" />
            <Link to={BASE} className="rounded px-1.5 py-0.5 text-slate-500 no-underline hover:text-blue-700 hover:underline">Chấm công</Link>
            <ChevronRight className="size-3.5" />
            <span aria-current="page" className="px-1.5 font-medium text-slate-800">{tab?.label}</span>
          </nav>
        </header>
        <div className="flex flex-col gap-3 p-5 max-sm:p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="m-0 text-2xl font-bold">Chấm công</h1>
            <nav aria-label="Mục chấm công" className="flex border-b">
              {TABS.map((t) => (
                <Link key={t.id} to={t.path} aria-current={tab?.id === t.id ? 'page' : undefined} className={`-mb-px inline-flex h-9 items-center gap-2 border-b-2 px-3 text-sm font-medium no-underline ${tab?.id === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                  <t.icon className="size-4" />
                  {t.label}
                </Link>
              ))}
            </nav>
            <div ref={setSlot} className="ml-auto flex flex-wrap items-center gap-2" />
          </div>
          {tab?.id === 'grid' && <SheetTab slot={slot} />}
          {tab?.id === 'people' && <PeopleTab />}
          {tab?.id === 'settings' && <SettingsTab />}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default TimesheetPage;
