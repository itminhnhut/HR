import {
  ChartPie,
  ChevronRight,
  History,
  Home,
  IdCard,
  ReceiptText,
  Settings,
  Sheet,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { ApiError, type PayrollMonthDto } from '../../../api';
import { useHrMe } from '../../../api/queries';
import { usePageMeta } from '../../../lib/hooks';
import { EmptyState, ErrorState } from '../../../ui/feedback';
import { Logo } from '../../../ui/Logo';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { HR_SECTIONS } from '../design/sections';
import { TONE } from '../design/tone';
import { errorMessage } from '../parts';
import { showWhenOffScreen } from '../timesheet/ConfigTab';
import { SheetSkeleton } from '../timesheet/skeletons';
import '../timesheet/timesheet.css';
import { PayrollFilterBar } from './PayrollFilterBar';
import { MonthActions, MonthStatus } from './MonthActions';
import { PayrollGridTab } from './PayrollGridTab';
import { PayrollConfigTab } from './config/PayrollConfigTab';
import { PayrollLogTab } from './log/PayrollLogTab';
import { PayrollDownload } from './download/PayrollDownload';
import { PayslipDrawer } from './download/PayslipDrawer';
import { CellSourceDrawer } from './CellSourceDrawer';
import { GridProfileDrawer } from './profiles/GridProfileDrawer';
import { OverviewTab } from './overview/OverviewTab';
import { ProfilesTab } from './profiles/ProfilesTab';
import { filterLines } from './payrollModel';
import { usePayrollMonth } from './queries';
import { PayslipsTab } from './payslips/PayslipsTab';
import { PayslipTabCount } from './payslips/PayslipTabCount';
import { usePayrollAddress } from './usePayrollAddress';

/** Lương (spec 11.1): one header, six tabs, one filter bar; the pay month and the filters stay in the address. */

const BASE = '/hr/luong';
const TABS: {
  id: 'grid' | 'payslips' | 'profiles' | 'settings' | 'overview' | 'log';
  label: string;
  icon: LucideIcon;
  path: string;
}[] = [
  { id: 'grid', label: 'Bảng lương', icon: Sheet, path: BASE },
  { id: 'payslips', label: 'Phiếu lương', icon: ReceiptText, path: `${BASE}/phieu-luong` },
  { id: 'profiles', label: 'Hồ sơ lương', icon: IdCard, path: `${BASE}/ho-so` },
  { id: 'settings', label: 'Cấu hình', icon: Settings, path: `${BASE}/cau-hinh` },
  { id: 'overview', label: 'Tổng quan', icon: ChartPie, path: `${BASE}/tong-quan` },
  { id: 'log', label: 'Nhật ký', icon: History, path: `${BASE}/nhat-ky` },
];
type Tab = (typeof TABS)[number];

const TILE = TONE[HR_SECTIONS.find((s) => s.to === BASE)?.tone ?? 'slate'].tile;
const LINK_BUTTON =
  'ts-field inline-flex items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white no-underline hover:text-white';

function TopBar({ label }: { label: string }) {
  const crumb =
    'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-slate-500 no-underline hover:text-blue-700 hover:underline';
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-3 border-b bg-white px-5 py-2">
      <Link to="/hr" aria-label="Về trang quản trị" className="flex no-underline">
        <Logo isCompact className="h-8" />
      </Link>
      <span aria-hidden="true" className="h-6 w-px bg-slate-200 max-sm:hidden" />
      <nav aria-label="Đường dẫn" className="flex items-center gap-1 text-sm whitespace-nowrap text-slate-500">
        <Link to="/hr" className={crumb}>
          <Home className="size-3.5" />
          Quản trị
        </Link>
        <ChevronRight className="size-3.5" />
        <Link to={BASE} className={crumb}>
          Lương
        </Link>
        <ChevronRight className="size-3.5" />
        <span aria-current="page" className="px-1.5 font-medium text-slate-800">
          {label}
        </span>
      </nav>
    </header>
  );
}

function Heading({ tab, search, aside }: { tab: Tab | null; search: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] ${TILE}`}>
        <Wallet className="size-5" />
      </span>
      <h1 className="m-0 text-2xl font-bold whitespace-nowrap sm:text-[28px]">Lương</h1>
      {tab && (
        <nav aria-label="Mục lương" className="flex max-w-full overflow-x-auto border-b">
          {TABS.map((t) => (
            <Link
              key={t.id}
              ref={tab.id === t.id ? showWhenOffScreen : undefined}
              to={{ pathname: t.path, search }}
              aria-current={tab.id === t.id ? 'page' : undefined}
              className={`-mb-px inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium whitespace-nowrap no-underline ${tab.id === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              <t.icon className="size-4" />
              {t.label}
              {t.id === 'payslips' && <PayslipTabCount />}
            </Link>
          ))}
        </nav>
      )}
      {aside}
    </div>
  );
}

/** The month's chip on every tab (spec 11.1); its buttons on Bảng lương (spec 11.2). Same query as the body. */
function MonthHeader(p: { isGrid: boolean; hasDownload: boolean; approver: string; canApprove: boolean }) {
  const { isGrid, approver, canApprove } = p;
  const address = usePayrollAddress();
  const { choice } = address;
  const sheet = usePayrollMonth(choice.ok ? { year: choice.year, month: choice.month } : null);
  if (!sheet.data) return null;
  return (
    <section aria-label="Trạng thái tháng" className="flex flex-wrap items-center gap-2 lg:ml-auto">
      <MonthStatus month={sheet.data} />
      {isGrid && (
        <MonthActions month={sheet.data} approver={approver} canApprove={canApprove} search={address.search} />
      )}
      {p.hasDownload && <PayrollDownload key={sheet.data.monthKey} month={sheet.data} />}
    </section>
  );
}

function Notice({
  icon,
  title,
  children,
  action,
}: {
  icon: 'calendar' | 'lock';
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ts-site-tokens ts-card">
      <EmptyState icon={icon} title={title} actions={action}>
        {children}
      </EmptyState>
    </div>
  );
}

function MonthError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // A month out of the server's range will not get better by trying again.
  if (!(error instanceof ApiError && error.status < 500)) {
    return (
      <div className="ts-site-tokens">
        <ErrorState onRetry={onRetry} message={errorMessage(error)} />
      </div>
    );
  }
  const back = (
    <Link to={BASE} className={LINK_BUTTON}>
      Về kỳ này
    </Link>
  );
  return (
    <Notice icon="calendar" title="Không mở được kỳ này" action={back}>
      {errorMessage(error)}
    </Notice>
  );
}

function PayrollBody({ tab }: { tab: Tab }) {
  const address = usePayrollAddress();
  const { choice, filters } = address;
  const sheet = usePayrollMonth(choice.ok ? { year: choice.year, month: choice.month } : null);
  const month: PayrollMonthDto | undefined = sheet.data;
  const shown = useMemo(() => (month ? filterLines(month.lines, filters).length : null), [month, filters]);
  /** What stands in for the month while it is not there: a wrong `?ky=`, loading, an error. */
  const notReady = () => {
    if (!choice.ok)
      return (
        <Notice icon="calendar" title="Không mở được kỳ này">
          {choice.message}
        </Notice>
      );
    if (sheet.isPending) return <SheetSkeleton />;
    return sheet.isError ? <MonthError error={sheet.error} onRetry={() => void sheet.refetch()} /> : null;
  };
  const grid = () => {
    if (!sheet.data) return notReady();
    const onOnly = address.setOnly;
    return (
      <>
        <PayrollGridTab
          key={sheet.data.monthKey}
          month={sheet.data}
          filters={filters}
          today={address.today}
          onOnly={onOnly}
          onClearSearch={address.clearSearch}
          onClear={address.clearFilters}
        />
        {address.profileId && (
          <GridProfileDrawer
            employeeId={address.profileId}
            month={sheet.data}
            today={address.today}
            isLevels={address.isLevels}
            onClose={address.closeProfile}
          />
        )}
        {address.payslipId && (
          <PayslipDrawer
            key={address.payslipId}
            month={sheet.data}
            employeeId={address.payslipId}
            onClose={address.closePayslip}
          />
        )}
        {address.sourceCell && address.sourcePerson && (
          <CellSourceDrawer
            key={`${address.sourceCell}-${address.sourcePerson}`}
            cell={address.sourceCell}
            employeeId={address.sourcePerson}
            month={sheet.data}
            today={address.today}
            onClose={address.closeSource}
          />
        )}
      </>
    );
  };
  if (tab.id === 'profiles')
    return <ProfilesTab period={address.period} month={month} today={address.today} onPeriod={address.setPeriod} />;
  if (tab.id === 'settings') return <PayrollConfigTab />;
  if (tab.id === 'log') return <PayrollLogTab period={address.period} />;
  return (
    <>
      <PayrollFilterBar
        period={address.period}
        month={month}
        filters={filters}
        shown={shown}
        onPeriod={address.setPeriod}
        onList={address.setList}
        onQuery={address.setQuery}
        onClear={address.clearFilters}
      />
      {tab.id === 'payslips' && (month ? <PayslipsTab month={month} filters={filters} /> : notReady())}
      {tab.id === 'payslips' ? null : tab.id === 'grid' ? (
        grid()
      ) : (
        <OverviewTab payYear={address.period.year} filters={filters} month={month} fallback={notReady()} />
      )}
    </>
  );
}

function NoRight() {
  return (
    <Notice icon="lock" title="Không có quyền xem lương">
      Nhờ người quản trị bật quyền Lương cho tài khoản này.
    </Notice>
  );
}

export function PayrollPage() {
  usePageMeta('Lương');
  const { pathname, search } = useLocation();
  const me = useHrMe();
  const tab = TABS.find((t) => t.path === pathname.replace(/\/$/, '')) ?? TABS[0];
  const canPayroll = me.data?.canPayroll === true;
  useLayoutEffect(() => {
    document.body.classList.add('hr-timesheet');
    return () => document.body.classList.remove('hr-timesheet');
  }, []);
  const body = () => {
    if (me.isPending) return <SheetSkeleton />;
    if (me.isError) return <ErrorState onRetry={() => void me.refetch()} message={errorMessage(me.error)} />;
    return canPayroll && tab ? <PayrollBody tab={tab} /> : <NoRight />;
  };
  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col">
        <TopBar label={tab?.label ?? 'Bảng lương'} />
        <div className="flex min-w-0 flex-col gap-2.5 px-5 py-3 max-sm:px-3">
          <Heading
            tab={canPayroll ? (tab ?? null) : null}
            search={search}
            aside={
              canPayroll && (
                <MonthHeader
                  isGrid={tab?.id === 'grid'}
                  hasDownload={tab?.id === 'grid' || tab?.id === 'overview'}
                  approver={me.data?.name ?? me.data?.email ?? ''}
                  canApprove={me.data?.canApprovePayroll === true}
                />
              )
            }
          />
          {body()}
        </div>
      </div>
      <Toaster
        position="bottom-center"
        offset={{ bottom: 72 }}
        mobileOffset={{ bottom: 72 }}
        richColors
        duration={2500}
      />
    </TooltipProvider>
  );
}

export default PayrollPage;
