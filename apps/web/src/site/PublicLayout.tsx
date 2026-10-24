import { Link, Outlet, ScrollRestoration } from 'react-router';
import { formatPhone } from '@careers/shared';
import { SITE, telLink } from '../lib/site';
import { Icon } from '../ui/icons';
import { SiteHeader } from './SiteHeader';

/** Waves at the bottom of navy heroes. Decorative only. */
export function Waves({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 360"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
    >
      <path
        d="M0 330 C 260 270, 520 390, 780 320 S 1240 260, 1440 300"
        fill="none"
        stroke="#C5CFDC"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <path
        d="M0 352 C 280 292, 540 412, 800 342 S 1260 282, 1440 322"
        fill="none"
        stroke="#C5CFDC"
        strokeOpacity="0.2"
        strokeWidth="1"
      />
    </svg>
  );
}

/** Navy band with the site header. Page heroes render inside it. */
export function NavyHero({
  children,
  waves = true,
  className = '',
}: {
  children?: React.ReactNode;
  waves?: boolean;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden bg-navy text-white ${className}`}>
      {waves && <Waves />}
      <SiteHeader />
      {children}
    </section>
  );
}

export function SiteFooter() {
  const phone = SITE.hrPhone ? formatPhone(SITE.hrPhone) : '';
  return (
    <footer className="bg-navy text-silver-soft">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-x-7 gap-y-3 px-5 py-9 text-sm sm:px-6">
        <span className="font-serif text-xl text-white">{SITE.company}</span>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {SITE.hrEmail && (
            <a
              href={`mailto:${SITE.hrEmail}`}
              className="inline-flex items-center gap-2 text-silver-soft no-underline hover:text-white"
            >
              <Icon name="mail" size={16} />
              {SITE.hrEmail}
            </a>
          )}
          {phone && (
            <a
              href={telLink(SITE.hrPhone)}
              className="inline-flex items-center gap-2 text-silver-soft no-underline hover:text-white"
            >
              <Icon name="phone" size={16} />
              {phone}
            </a>
          )}
          <Link to="/gioi-thieu" className="text-silver-soft no-underline hover:text-white">
            Về chúng tôi
          </Link>
          <Link to="/tra-cuu-ho-so" className="text-silver-soft no-underline hover:text-white">
            Tra cứu hồ sơ
          </Link>
          <Link to="/chinh-sach-du-lieu" className="text-silver-soft no-underline hover:text-white">
            Chính sách dữ liệu
          </Link>
        </div>
      </div>
    </footer>
  );
}

/** Keyboard users jump past the header straight to the page content. */
export function SkipLink() {
  return (
    <button
      type="button"
      className="sr-only-focusable border-0"
      onClick={() => {
        const main = document.querySelector<HTMLElement>('main');
        if (!main) return;
        main.tabIndex = -1;
        main.focus();
        main.scrollIntoView();
      }}
    >
      Bỏ qua menu
    </button>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <SiteFooter />
      <ScrollRestoration />
    </div>
  );
}
