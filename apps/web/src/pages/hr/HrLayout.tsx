import { useState } from 'react';
import { Link, Navigate, Outlet, ScrollRestoration, useLocation, useMatch, useNavigate } from 'react-router';
import { useHrJobs, useHrMe, useHrSignOut } from '../../api/queries';
import { useNoIndex } from '../../lib/hooks';
import { SkipLink } from '../../site/PublicLayout';
import { Dialog } from '../../ui/Dialog';
import { ErrorState, LoadingStatus } from '../../ui/feedback';
import { Icon, LogoMark } from '../../ui/icons';
import { Logo } from '../../ui/Logo';
import { IconTile } from './design/IconTile';
import { HR_SECTIONS, isSectionActive, sectionOf, type HrSection } from './design/sections';
import { TONE } from './design/tone';
import { useAdminTheme } from './design/useAdminTheme';

/** Title for the phone top bar, from the current section. */
const sectionTitle = (pathname: string) => sectionOf(pathname)?.label ?? 'Tổng quan';

function NewBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="min-w-[22px] rounded-full bg-red-600 px-[7px] py-0.5 text-center text-xs font-bold text-white">
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

/** One menu entry, the same on the wide menu and the phone menu. */
function NavLink({ item, newCount, onNavigate }: { item: HrSection; newCount: number; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const active = isSectionActive(item, pathname);
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-[46px] items-center gap-3 rounded-control px-2 text-sm no-underline hover:text-navy ${
        active ? `${TONE[item.tone].tile} font-semibold hover:brightness-[0.98]` : 'font-medium text-body hover:bg-tint'
      }`}
    >
      <IconTile icon={item.icon} tone={item.tone} size={32} />
      <span className="flex-1">{item.label}</span>
      {item.badge && <NewBadge count={newCount} />}
    </Link>
  );
}

function SiteLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      className="flex min-h-[46px] items-center gap-3 rounded-control px-2 text-sm font-medium text-body no-underline hover:bg-tint hover:text-navy"
    >
      <span className="inline-flex size-8 items-center justify-center text-muted">
        <Icon name="external" size={18} />
      </span>
      Xem trang ứng viên
    </Link>
  );
}

function SignOut({ email }: { email: string }) {
  const signOut = useSignOut();
  return (
    <button
      type="button"
      onClick={signOut.run}
      disabled={signOut.pending}
      className="flex min-h-[46px] w-full items-center gap-3 rounded-control border-0 bg-transparent px-2 py-1.5 text-left text-sm font-medium text-body hover:bg-red-50 hover:text-red-700"
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center text-muted">
        <Icon name="logout" size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span>Đăng xuất</span>
        <span className="truncate text-xs font-normal text-muted">{email}</span>
      </span>
    </button>
  );
}

function Brand() {
  return (
    <span className="flex flex-col gap-1.5">
      <Logo isCompact className="h-[27px]" />
      <span className="text-xs text-muted">Quản trị tuyển dụng</span>
    </span>
  );
}

function Sidebar({ email, newCount }: { email: string; newCount: number }) {
  return (
    <div className="hidden w-[248px] shrink-0 border-r border-line bg-white lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto px-3 py-5">
        <Link to="/" className="flex px-2 no-underline">
          <Brand />
        </Link>
        <nav aria-label="Quản trị" className="flex flex-col gap-1">
          {HR_SECTIONS.map((item) => (
            <NavLink key={item.to} item={item} newCount={newCount} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
          <SiteLink />
          <SignOut email={email} />
        </div>
      </aside>
    </div>
  );
}

function TopBar({ email, newCount }: { email: string; newCount: number }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const section = sectionOf(pathname);
  const close = () => setOpen(false);
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2.5 sm:px-6 lg:hidden">
      <span className="flex min-w-0 items-center gap-2.5">
        {section ? <IconTile icon={section.icon} tone={section.tone} size={34} /> : <LogoMark size={30} />}
        <span className="truncate font-serif text-lg text-navy">{sectionTitle(pathname)}</span>
      </span>
      <button
        type="button"
        aria-label="Mở menu quản trị"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-control border border-field bg-white text-navy hover:bg-tint"
      >
        <Icon name="menu" size={20} />
        {newCount > 0 && <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-red-600" />}
      </button>

      <Dialog open={open} onClose={close} label="Menu quản trị" variant="drawer" className="lg:hidden">
        <nav
          aria-label="Menu quản trị"
          className="flex h-full flex-col gap-1 overflow-y-auto bg-white px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3"
        >
          <div className="flex items-center justify-between pb-2">
            <Brand />
            <button
              type="button"
              onClick={close}
              aria-label="Đóng menu"
              className="flex size-11 items-center justify-center rounded-control border border-field bg-white text-navy hover:bg-tint"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
          {HR_SECTIONS.map((item) => (
            <NavLink key={item.to} item={item} newCount={newCount} onNavigate={close} />
          ))}
          <div className="mt-auto flex flex-col gap-1 border-t border-line pt-2">
            <SiteLink onNavigate={close} />
            <SignOut email={email} />
          </div>
        </nav>
      </Dialog>
    </header>
  );
}

/** Signed-in shell. Only rendered once useHrMe confirmed a session. */
function Shell({ email }: { email: string }) {
  const jobs = useHrJobs();
  const newCount = jobs.data?.newApplications ?? 0;
  // Master-detail: from 1024px this page is exactly the window and nothing outside its panes can scroll.
  const isWindowSized = !!useMatch('/hr/ho-so');
  const { pathname } = useLocation();
  // 31 cột ngày cần cả màn hình: trang này có thanh logo và đường dẫn riêng thay cho menu.
  if (pathname.startsWith('/hr/cham-cong')) {
    return (
      <div data-clarity-mask="true" className="min-h-dvh bg-mist text-navy">
        <SkipLink />
        <main id="hr-noi-dung" className="min-w-0">
          <Outlet />
        </main>
        <ScrollRestoration />
      </div>
    );
  }
  return (
    // Masked in Clarity too, in case a recording ever reaches an HR screen.
    <div
      data-clarity-mask="true"
      className={`flex min-h-dvh flex-col bg-mist text-navy lg:flex-row ${isWindowSized ? 'relative lg:h-dvh lg:overflow-hidden' : ''}`}
    >
      <SkipLink />
      <Sidebar email={email} newCount={newCount} />
      <TopBar email={email} newCount={newCount} />
      <main
        id="hr-noi-dung"
        className={`flex min-w-0 flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 ${isWindowSized ? 'relative gap-2 lg:h-dvh lg:overflow-hidden lg:p-4' : 'gap-6 lg:p-10'}`}
      >
        <div
          key={sectionTitle(pathname)}
          className={`flex min-w-0 flex-1 flex-col animate-page ${isWindowSized ? 'gap-2 lg:min-h-0' : 'gap-6'}`}
        >
          <Outlet />
        </div>
      </main>
      <ScrollRestoration />
    </div>
  );
}

export function HrLayout() {
  // Every HR screen stays out of search results (vercel.json also sends X-Robots-Tag: noindex).
  useNoIndex();
  useAdminTheme();
  const me = useHrMe();
  if (me.isPending) return <LoadingStatus />;
  if (me.isError) return <ErrorState onRetry={() => me.refetch()} />;
  if (!me.data) return <Navigate to="/hr/dang-nhap" replace />;
  return <Shell email={me.data.email} />;
}

export default HrLayout;
