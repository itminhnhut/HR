import type { ReactNode } from 'react';
import { useNotFoundMeta } from '../lib/hooks';
import { Link } from 'react-router';
import { Icon, type IconName } from '../ui/icons';
import type { Crumb } from './Breadcrumbs';
import { PAGE_WIDTH, PageHero } from './PageHero';

const PLACES: [string, IconName, string, string][] = [
  ['/', 'briefcase', 'Việc làm đang mở', 'Xem các vị trí đang tuyển và gửi CV.'],
  ['/tin-tuc', 'newspaper', 'Tin tức', 'Đời sống công ty và cẩm nang ứng viên.'],
  ['/tra-cuu-ho-so', 'search', 'Tra cứu hồ sơ', 'Xem hồ sơ đã nộp tới bước nào.'],
];

interface NotFoundViewProps {
  title: string;
  intro: string;
  crumbs: Crumb[];
  actions?: ReactNode;
}

/** Every "not found" page: the hero says what happened (the page's H1), then where to go instead. */
export function NotFoundView({ title, intro, crumbs, actions }: NotFoundViewProps) {
  useNotFoundMeta(title);
  return (
    <>
      <PageHero crumbs={crumbs} eyebrow="Lỗi 404" title={title} intro={intro} actions={actions} />
      <main className={`${PAGE_WIDTH} flex flex-col gap-5 py-10 sm:py-14`}>
        <h2 className="m-0 font-serif type-h2-sm font-medium">Bạn có thể xem</h2>
        <ul className="stagger m-0 grid list-none gap-3 p-0 md:grid-cols-3 md:gap-6">
          {PLACES.map(([to, icon, label, text]) => (
            <li key={to}>
              <Link
                to={to}
                className="card-lift group flex h-full items-start gap-4 rounded-card border border-line bg-white p-5 text-navy no-underline hover:text-navy"
              >
                <span className="flex shrink-0 rounded-full border border-ring p-2.5 text-accent">
                  <Icon name={icon} size={20} stroke={1.5} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <strong className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
                    {label}
                    <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </strong>
                  <span className="text-sm leading-relaxed text-slate">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
