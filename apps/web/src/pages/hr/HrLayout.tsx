import { useState } from 'react';
import { Link, Navigate, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import { useHrJobs, useHrMe, useHrSignOut } from '../../api/queries';
import { SITE } from '../../lib/site';
import { SkipLink } from '../../site/PublicLayout';
import { Dialog } from '../../ui/Dialog';
import { ErrorState, LoadingStatus } from '../../ui/feedback';
import { Icon, LogoMark, type IconName } from '../../ui/icons';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Match only the exact path (the jobs index). */
  end?: boolean;
  badge?: boolean;
}

const NAV: NavItem[] = [
  { to: '/hr', label: 'Tổng quan', icon: 'bars', end: true },
  { to: '/hr/tin', label: 'Tin tuyển dụng', icon: 'briefcase' },
  { to: '/hr/ho-so', label: 'Hồ sơ ứng viên', icon: 'inbox', badge: true },
  { to: '/hr/mau-tin', label: 'Mẫu tin', icon: 'file' },
  { to: '/hr/mau-thu', label: 'Mẫu thư', icon: 'mail' },
  { to: '/hr/tai-khoan', label: 'Tài khoản HR', icon: 'users' },
];

/** Title for the phone top bar, from the current section. */
function sectionTitle(pathname: string): string {
  const match = [...NAV].reverse().find((item) => isActive(item, pathname));
  return match?.label ?? 'Tổng quan';
}

/** "Tin tuyển dụng" stays active while editing a job under /hr/tin/…. */
function isActive(item: NavItem, pathname: string): boolean {
  if (item.end) return pathname === item.to || pathname === `${item.to}/`;
  return pathname.startsWith(item.to);
}

function NewBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="min-w-[22px] rounded-full bg-white px-[7px] py-0.5 text-center text-xs font-semibold text-navy">
      {count}
      <span className="sr-only"> hồ sơ mới</span>
    </span>
  );
}

function useSignOut() {
  const signOut = useHrSignOut();
  const navigate = useNavigate();
  return {
    pending: signOut.isPending,
    run: () => signOut.mutate(undefined, { onSuccess: () => navigate('/hr/dang-nhap', { replace: true }) }),
  };
}

function Sidebar({ email, newCount }: { email: string; newCount: number }) {
  const { pathname } = useLocation();
  const signOut = useSignOut();
  return (
    <div className="hidden w-[240px] shrink-0 bg-navy lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col gap-7 overflow-y-auto px-4 py-[26px] text-silver-soft">
        <Link to="/" className="flex items-center gap-3 px-2.5 text-white no-underline hover:text-white">
          <LogoMark />
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-lg font-medium">{SITE.company}</span>
            <span className="text-xs text-silver-soft">Quản trị tuyển dụng</span>
          </span>
        </Link>
        <nav aria-label="Quản trị" className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[46px] items-center gap-3 rounded-control border-l-2 pl-3.5 pr-3 text-sm no-underline transition-colors ${
                  active
                    ? 'border-silver bg-white/[0.08] font-medium text-white hover:text-white'
                    : 'border-transparent text-silver-soft hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon name={item.icon} size={18} stroke={1.5} />
                <span className="flex-1">{item.label}</span>
                {item.badge && <NewBadge count={newCount} />}
              </Link>
            );
          })}
          <Link
            to="/"
            className="flex min-h-[46px] items-center gap-3 rounded-control border-l-2 border-transparent pl-3.5 pr-3 text-sm text-silver-soft no-underline transition-colors hover:bg-white/5 hover:text-white"
          >
            <Icon name="external" size={18} stroke={1.5} />
            Xem trang ứng viên
          </Link>
        </nav>
        <button
          type="button"
          onClick={signOut.run}
          disabled={signOut.pending}
          className="mt-auto flex min-h-[46px] items-center gap-3 rounded-control border-0 border-t border-silver/20 bg-transparent pl-3.5 pr-3 pt-2 text-left text-sm text-silver-soft transition-colors hover:text-white"
        >
          <Icon name="logout" size={18} stroke={1.5} />
          <span className="flex min-w-0 flex-1 flex-col leading-snug">
            <span>Đăng xuất</span>
            <span className="truncate text-xs text-silver-soft">{email}</span>
          </span>
        </button>
      </aside>
    </div>
  );
}

function TopBar({ email, newCount }: { email: string; newCount: number }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();
  const linkClass = 'flex min-h-[52px] items-center gap-3 border-b border-silver/20 text-base no-underline';
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white sm:px-6 lg:hidden">
      <span className="flex min-w-0 items-center gap-3">
        <LogoMark size={26} />
        <span className="truncate font-serif text-[22px] font-medium">{sectionTitle(pathname)}</span>
      </span>
      <button
        type="button"
        aria-label="Mở menu quản trị"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-control border border-silver/45 bg-transparent text-white"
      >
        <Icon name="menu" size={20} stroke={1.8} />
        {newCount > 0 && <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-white" />}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} label="Menu quản trị" className="lg:hidden">
        <nav aria-label="Menu quản trị" className="flex flex-col bg-navy px-5 pb-8 pt-3 text-white">
          <div className="flex items-center justify-between pb-2">
            <span className="flex flex-col leading-tight">
              <span className="font-serif text-xl font-medium">{SITE.company}</span>
              <span className="text-xs text-silver-soft">Quản trị tuyển dụng</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng menu"
              className="flex size-11 items-center justify-center rounded-control border border-silver/45 bg-transparent text-white"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
          {NAV.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`${linkClass} ${active ? 'font-medium text-white hover:text-white' : 'text-silver hover:text-white'}`}
              >
                <Icon name={item.icon} size={18} stroke={1.5} />
                <span className="flex-1">{item.label}</span>
                {item.badge && <NewBadge count={newCount} />}
              </Link>
            );
          })}
          <Link to="/" className={`${linkClass} text-silver hover:text-white`}>
            <Icon name="external" size={18} stroke={1.5} />
            Xem trang ứng viên
          </Link>
          <button
            type="button"
            onClick={signOut.run}
            disabled={signOut.pending}
            className="flex min-h-[52px] items-center gap-3 border-0 bg-transparent p-0 text-left text-base text-silver-soft hover:text-white"
          >
            <Icon name="logout" size={18} stroke={1.5} />
            <span className="flex min-w-0 flex-col leading-snug">
              <span>Đăng xuất</span>
              <span className="truncate text-xs">{email}</span>
            </span>
          </button>
        </nav>
      </Dialog>
    </header>
  );
}

/** Signed-in shell. Only rendered once useHrMe confirmed a session. */
function Shell({ email }: { email: string }) {
  const jobs = useHrJobs();
  const newCount = jobs.data?.newApplications ?? 0;
  return (
    <div className="flex min-h-dvh flex-col bg-mist text-navy lg:flex-row">
      <SkipLink />
      <Sidebar email={email} newCount={newCount} />
      <TopBar email={email} newCount={newCount} />
      <main id="hr-noi-dung" className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 lg:p-10">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}

export function HrLayout() {
  const me = useHrMe();
  if (me.isPending) return <LoadingStatus />;
  if (me.isError) return <ErrorState onRetry={() => me.refetch()} />;
  if (!me.data) return <Navigate to="/hr/dang-nhap" replace />;
  return <Shell email={me.data.email} />;
}

export default HrLayout;
