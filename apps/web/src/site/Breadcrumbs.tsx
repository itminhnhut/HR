import { Link } from 'react-router';
import { Icon } from '../ui/icons';

export interface Crumb {
  label: string;
  /** Omitted for the current page (last crumb). */
  to?: string;
}

/**
 * "Trang chủ › Tin tức › Chuyên mục › Bài" on the navy hero. Always one line: long labels are cut with "…".
 * On phones the current page is left out once it is the third crumb or deeper: the H1 right below says it.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: 'Trang chủ', to: '/' }, ...items];
  return (
    <nav aria-label="Đường dẫn" className="min-w-0">
      <ol className="m-0 flex min-w-0 list-none flex-nowrap items-center gap-x-1.5 p-0 text-[13px] text-silver-soft sm:text-sm">
        {all.map((crumb, i) => {
          const last = i === all.length - 1;
          return (
            <li
              key={`${crumb.label}-${i}`}
              className={`flex min-w-0 items-center gap-1.5 ${i === 0 ? 'shrink-0' : ''} ${last && i >= 2 ? 'max-sm:hidden' : ''}`}
            >
              {i > 0 && <Icon name="chevronRight" size={14} className="shrink-0 opacity-60" />}
              {crumb.to && !last ? (
                <Link
                  to={crumb.to}
                  className="flex min-h-11 min-w-0 items-center gap-1.5 text-silver-soft no-underline hover:text-white"
                >
                  {i === 0 && <Icon name="home" size={14} className="shrink-0" />}
                  <span className="truncate">{crumb.label}</span>
                </Link>
              ) : (
                <span aria-current="page" className="block min-w-0 max-w-[420px] truncate text-silver">
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
