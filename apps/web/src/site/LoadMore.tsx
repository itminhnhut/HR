import type { ReactNode } from 'react';
import { Icon } from '../ui/icons';

const LOAD_MORE =
  'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-control border border-navy bg-white px-6 text-[15px] font-medium text-navy no-underline transition-colors hover:bg-tint hover:text-navy disabled:opacity-60 sm:w-auto sm:min-w-[300px]';

interface LoadMoreProps {
  label: string;
  onMore: () => void;
  /**
   * The address of the next page. With it the button is a real link, so crawlers still reach every page;
   * a click adds the posts in place instead.
   */
  href?: string;
  loading?: boolean;
  /** "Đã xem 12 / 34 bài" under the button. */
  status?: ReactNode;
}

/** "Xem thêm" on phones: one design for the jobs board and the news list. */
export function LoadMore({ label, onMore, href, loading = false, status }: LoadMoreProps) {
  const content = (
    <>
      {loading ? 'Đang tải…' : label}
      {!loading && <Icon name="chevronDown" size={16} />}
    </>
  );
  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      {href ? (
        <a
          href={href}
          aria-busy={loading}
          className={LOAD_MORE}
          onClick={(e) => {
            e.preventDefault();
            if (!loading) onMore();
          }}
        >
          {content}
        </a>
      ) : (
        <button type="button" onClick={onMore} disabled={loading} className={LOAD_MORE}>
          {content}
        </button>
      )}
      {status && (
        <span aria-live="polite" className="text-[13px] text-slate">
          {status}
        </span>
      )}
    </div>
  );
}

/** The end of a list grown with "Xem thêm". */
export function ListEnd({ children }: { children: ReactNode }) {
  return <p className="m-0 pt-2 text-center text-[13px] text-slate">{children}</p>;
}
