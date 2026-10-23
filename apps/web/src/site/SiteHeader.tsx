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
    candidate
      ? { to: '/ho-so-cua-toi', label: 'Hồ sơ của tôi', icon: 'user' }
      : { to: '/dang-nhap', label: 'Đăng nhập', icon: 'user' },
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
      <nav aria-label="Điều hướng chính" className="hidden items-center gap-2 md:flex">
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
        className="flex size-11 items-center justify-center rounded-control border border-silver/45 bg-transparent text-white md:hidden"
      >
        <Icon name="menu" size={20} stroke={1.8} />
      </button>

      <Dialog open={menu} onClose={() => setMenu(false)} label="Menu" className="md:hidden">
        <nav aria-label="Menu" className="flex flex-col bg-navy px-5 pb-8 pt-3 text-white">
          <div className="flex items-center justify-between pb-2">
            <span className="font-serif text-lg font-medium">{SITE.company}</span>
            <button
              type="button"
              onClick={() => setMenu(false)}
              aria-label="Đóng menu"
              className="flex size-11 items-center justify-center rounded-control border border-silver/45 bg-transparent text-white"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
          {[
            ...items,
            { to: '/chinh-sach-du-lieu', label: 'Chính sách dữ liệu', icon: 'shield' as IconName },
            { to: '/hr', label: 'Dành cho HR', icon: 'lock' as IconName },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-[52px] items-center gap-3 border-b border-silver/20 text-base text-silver no-underline hover:text-white"
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
      </Dialog>
    </header>
  );
}
