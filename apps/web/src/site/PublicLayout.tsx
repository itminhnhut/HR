import { Link, Outlet, ScrollRestoration } from 'react-router';
import { formatPhone } from '@careers/shared';
import { SITE, telLink } from '../lib/site';
import { Icon, type IconName } from '../ui/icons';
import { NavyHero } from './NavyHero';
import { RouteProgress } from './RouteProgress';
import { Wordmark } from './SiteHeader';

export { NavyHero, Waves } from './NavyHero';

const FOOTER_LINKS: [string, string][] = [
  ['/', 'Việc làm'],
  ['/tin-tuc', 'Tin tức'],
  ['/gioi-thieu', 'Về chúng tôi'],
  ['/tra-cuu-ho-so', 'Tra cứu hồ sơ'],
  ['/chinh-sach-du-lieu', 'Chính sách dữ liệu'],
];

const FOOTER_LINK = 'inline-flex min-h-11 items-center gap-2 text-sm text-silver-soft no-underline hover:text-white';

function ContactLink({ href, icon, children }: { href: string; icon: IconName; children: string }) {
  return (
    <a href={href} className={FOOTER_LINK}>
      <Icon name={icon} size={16} className="shrink-0" />
      {children}
    </a>
  );
}

export function SiteFooter() {
  const phone = SITE.hrPhone ? formatPhone(SITE.hrPhone) : '';
  return (
    <footer className="border-t-[3px] border-brand bg-navy text-silver-soft">
      <div className="mx-auto grid max-w-[1160px] gap-6 px-5 pb-6 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-2">
          <div className="flex self-start [&>a]:min-h-11">
            <Wordmark />
          </div>
          <p className="m-0 mt-1 max-w-[360px] text-sm leading-relaxed">{SITE.industry}.</p>
          {(SITE.hrEmail || phone) && (
            <div className="flex flex-wrap gap-x-6">
              {SITE.hrEmail && (
                <ContactLink href={`mailto:${SITE.hrEmail}`} icon="mail">
                  {SITE.hrEmail}
                </ContactLink>
              )}
              {phone && (
                <ContactLink href={telLink(SITE.hrPhone)} icon="phone">
                  {phone}
                </ContactLink>
              )}
            </div>
          )}
        </div>
        <nav aria-label="Liên kết cuối trang">
          <ul className="m-0 grid list-none grid-cols-2 gap-x-6 p-0 sm:flex sm:flex-wrap sm:gap-x-7">
            {FOOTER_LINKS.map(([to, label]) => (
              <li key={to}>
                <Link to={to} className={FOOTER_LINK}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-[1160px] px-5 sm:px-6">
        <p className="m-0 border-t border-silver/15 py-5 text-xs text-silver-soft/80">
          © {new Date().getFullYear()} {SITE.legalName}
        </p>
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

/**
 * Every public page: the page's own navy hero and main, then the footer. A new page fades in (its <main>
 * mounts fresh), and a thin bar at the top shows that the next page is loading.
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <RouteProgress />
      <SkipLink />
      <div className="flex flex-1 flex-col [&_main]:animate-page">
        <Outlet />
      </div>
      <SiteFooter />
      <ScrollRestoration />
    </div>
  );
}

/** Shown on the very first load while the page's code arrives: header and footer in place, no blank screen. */
export function PublicShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <RouteProgress />
      <NavyHero>
        <div className="h-[200px] sm:h-[240px]" />
      </NavyHero>
      <main className="min-h-svh" />
      <SiteFooter />
    </div>
  );
}
