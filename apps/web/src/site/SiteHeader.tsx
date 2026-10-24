import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useCandidate } from '../api/queries';
import { SITE } from '../lib/site';
import { Dialog } from '../ui/Dialog';
import { Icon, LogoMark, type IconName } from '../ui/icons';

export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <Link to="/" className="flex items-center gap-3 text-white no-underline hover:text-white">
      <LogoMark size={size === 'lg' ? 32 : 28} />
      <span className={`whitespace-nowrap font-serif font-medium ${size === 'lg' ? 'text-[22px]' : 'text-[19px]'}`}>
        {SITE.company}
      </span>
    </Link>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

function useNavItems(): NavItem[] {
  const { data: candidate } = useCandidate();
  return [
    { to: '/', label: 'Việc làm', icon: 'briefcase', end: true },
    { to: '/gioi-thieu', label: 'Về chúng tôi', icon: 'building' },
    { to: '/tra-cuu-ho-so', label: 'Tra cứu hồ sơ', icon: 'search' },
    ...(candidate ? [{ to: '/ho-so-cua-toi', label: 'Hồ sơ của tôi', icon: 'user' } as const] : []),
  ];
}

/** Sits at the top of every navy hero. */
export function SiteHeader() {
  const items = useNavItems();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => setMenu(false), [location.pathname]);

  return (
    <header className="relative mx-auto flex max-w-[1160px] items-center justify-between gap-3 border-b border-silver/20 px-5 py-3.5 sm:px-6">
      <Wordmark />
      <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 whitespace-nowrap border-b px-3 py-3 lg:px-3.5 text-sm no-underline ${
                isActive
                  ? 'border-white font-medium text-white hover:text-white'
                  : 'border-transparent text-silver-soft hover:text-white'
              }`
            }
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </NavLink>
        ))}
        <Link
          to="/hr"
          className="ml-1 inline-flex items-center gap-2 whitespace-nowrap rounded-control border border-silver/45 px-4 py-2.5 text-sm text-white no-underline hover:bg-white/10 hover:text-white"
        >
          <Icon name="lock" size={16} />
          Dành cho HR
        </Link>
      </nav>
      <button
        type="button"
        aria-label="Mở menu"
        aria-expanded={menu}
        onClick={() => setMenu(true)}
        className="flex size-11 items-center justify-center rounded-control border border-silver/45 bg-transparent text-white lg:hidden"
      >
        <Icon name="menu" size={20} stroke={1.8} />
      </button>

      <Dialog open={menu} onClose={() => setMenu(false)} label="Menu" variant="drawer" className="bg-navy lg:hidden">
        <nav aria-label="Menu" className="flex h-full flex-col overflow-y-auto bg-navy px-5 pb-8 pt-3.5 text-white">
          <div className="flex items-center justify-between gap-3 border-b border-silver/20 pb-3.5">
            <Wordmark />
            <button
              type="button"
              onClick={() => setMenu(false)}
              aria-label="Đóng menu"
              className="flex size-11 shrink-0 items-center justify-center rounded-control border border-silver/45 bg-transparent text-white"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
          <div className="flex flex-col pt-2">
            {[...items, { to: '/chinh-sach-du-lieu', label: 'Chính sách dữ liệu', icon: 'shield' as IconName }].map(
              (item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-[56px] items-center gap-3.5 border-b border-silver/15 text-[17px] no-underline ${
                      isActive ? 'font-medium text-white hover:text-white' : 'text-silver hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon name={item.icon} size={20} className={isActive ? 'text-white' : 'text-silver-soft'} />
                      {item.label}
                      {isActive && <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-white" />}
                    </>
                  )}
                </NavLink>
              ),
            )}
          </div>
          <Link
            to="/hr"
            className="mt-auto inline-flex min-h-[52px] items-center justify-center gap-2 rounded-control border border-silver/45 text-[15px] text-white no-underline hover:bg-white/10 hover:text-white"
          >
            <Icon name="lock" size={18} />
            Dành cho HR
          </Link>
        </nav>
      </Dialog>
    </header>
  );
}
