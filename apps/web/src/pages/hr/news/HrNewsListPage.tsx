import { matchesQuery, NEWS_STATUS_LABEL, type HrNewsRowDto, type NewsStatus } from '@careers/shared';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useDeleteNews, useHrNews } from '../../../api/queries';
import { usePageMeta } from '../../../lib/hooks';
import { Button, ButtonLink } from '../../../ui/Button';
import { EmptyState, ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../../ui/feedback';
import { Icon } from '../../../ui/icons';
import { apiMessage, errorMessage, FilterTabs, PageHeading, type TabItem } from '../parts';
import { CategoryManager } from './CategoryManager';
import { BulkDeleteBar, useDraftSelection } from './BulkDelete';
import { NewsCards, NewsTable, type RowHandlers } from './NewsListRows';
import { ConfirmDialog } from './parts';
import type { RowNotice } from './RowStatus';

type ListTab = NewsStatus | 'all';
const TABS: ListTab[] = ['all', 'published', 'draft', 'hidden'];
const TAB_LABEL: Record<ListTab, string> = { all: 'Tất cả', ...NEWS_STATUS_LABEL };
const isTab = (value: string | null): value is ListTab => TABS.includes(value as ListTab);

function ListSkeleton() {
  return (
    <div aria-hidden="true">
      {['64%', '48%', '72%', '55%'].map((w) => (
        <div key={w} className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-5">
          <span className="flex flex-1 flex-col gap-2">
            <Sk w={w} h={16} />
            <Sk w={160} h={12} />
          </span>
          <Sk w={84} h={32} />
        </div>
      ))}
    </div>
  );
}

function useNewsRows(tab: ListTab, search: string) {
  const news = useHrNews();
  const rows = useMemo(() => news.data?.posts ?? [], [news.data]);
  const visible = useMemo(
    () => rows.filter((r) => (tab === 'all' || r.status === tab) && (!search.trim() || matchesQuery(r.title, search))),
    [rows, tab, search],
  );
  const tabs: TabItem<ListTab>[] = TABS.map((key) => ({
    key,
    label: TAB_LABEL[key],
    count: key === 'all' ? rows.length : rows.filter((r) => r.status === key).length,
  }));
  return { news, rows, visible, tabs };
}

function ListHeading({ onCategories }: { onCategories: () => void }) {
  return (
    <PageHeading
      title="Tin tức"
      titleHiddenOnPhone
      subtitle="Bài viết cho trang /tin-tuc. Nháp tự lưu khi gõ; bấm Đăng bài trong trang sửa bài để hiện trên trang."
      action={
        <div className="flex flex-wrap gap-2.5 max-sm:w-full">
          <Button variant="outline" icon="layers" className="text-sm max-sm:flex-1" onClick={onCategories}>
            Chuyên mục
          </Button>
          <ButtonLink to="/hr/tin-tuc/moi" icon="plus" className="text-sm font-medium hover:text-white max-sm:flex-1">
            Viết bài
          </ButtonLink>
        </div>
      }
    />
  );
}

/** "Đã xoá bài." after deleting from the editor (router state), errors, and status changes from a row. */
function Notices({ error, notice }: { error: string | null; notice: RowNotice | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const flash = (location.state as { notice?: string } | null)?.notice;
  return (
    <>
      {flash && (
        <Notice
          tone="ok"
          icon="check"
          action={
            <button
              type="button"
              onClick={() => navigate('.', { replace: true, state: null })}
              className="min-h-10 border-0 bg-transparent px-2 text-sm text-ok underline"
            >
              Đóng
            </button>
          }
        >
          <span role="status">{flash}</span>
        </Notice>
      )}
      {error && (
        <Notice tone="error" icon="alert">
          <span role="alert">{error}</span>
        </Notice>
      )}
      {notice && (
        <Notice tone={notice.tone} icon={notice.tone === 'ok' ? 'check' : 'alert'}>
          <span role={notice.tone === 'ok' ? 'status' : 'alert'}>
            {notice.text}
            {notice.editLink && (
              <>
                {' '}
                <Link to={notice.editLink} className="font-medium text-error underline">
                  Mở bài
                </Link>
              </>
            )}
          </span>
        </Notice>
      )}
    </>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  return (
    <label className="field-focus my-2 flex min-h-11 w-full items-center gap-2 rounded-control border border-field px-3 sm:w-[280px]">
      <Icon name="search" size={17} className="shrink-0 text-muted" />
      <span className="sr-only">Tìm theo tiêu đề</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tìm theo tiêu đề"
        className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-navy outline-none placeholder:text-placeholder"
      />
    </label>
  );
}

/** HR sees 20 posts at a time; the list is loaded whole, so paging is instant. */
export const NEWS_PAGE_SIZE = 20;

function Pager({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  if (pageCount <= 1) return null;
  const step =
    'inline-flex size-11 items-center justify-center rounded-control border border-silver bg-white text-navy hover:border-navy disabled:opacity-40';
  return (
    <nav aria-label="Trang danh sách bài" className="flex items-center justify-center gap-3 px-4 py-4">
      <button
        type="button"
        aria-label="Trang trước"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={step}
      >
        <Icon name="arrowLeft" size={16} />
      </button>
      <span className="text-sm text-slate">
        Trang {page} / {pageCount}
      </span>
      <button
        type="button"
        aria-label="Trang sau"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        className={step}
      >
        <Icon name="arrowRight" size={16} />
      </button>
    </nav>
  );
}

function ListBody({
  list,
  search,
  page,
  onPage,
  ...handlers
}: {
  list: ReturnType<typeof useNewsRows>;
  search: string;
  page: number;
  onPage: (page: number) => void;
} & RowHandlers) {
  const { news, rows, visible } = list;
  const showSkeleton = useDelayedFlag(news.isPending);
  const pageCount = Math.max(1, Math.ceil(visible.length / NEWS_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = visible.slice((current - 1) * NEWS_PAGE_SIZE, current * NEWS_PAGE_SIZE);
  const hint =
    rows.length === 0
      ? 'Bấm "Viết bài" để bắt đầu bài đầu tiên.'
      : search
        ? 'Thử từ khoá khác.'
        : 'Chọn mục khác để xem các bài còn lại.';
  return (
    <>
      {news.isPending && <LoadingStatus />}
      {news.isPending && showSkeleton && <ListSkeleton />}
      {news.isError && <ErrorState onRetry={() => news.refetch()} message={apiMessage(news.error)} />}
      {news.data && visible.length === 0 && (
        <EmptyState icon="newspaper" title={rows.length === 0 ? 'Chưa có bài nào' : 'Không có bài ở mục này'}>
          {hint}
        </EmptyState>
      )}
      {shown.length > 0 && (
        <>
          <NewsTable rows={shown} {...handlers} />
          <NewsCards rows={shown} {...handlers} />
          <Pager page={current} pageCount={pageCount} onPage={onPage} />
        </>
      )}
    </>
  );
}

function DeletePostDialog({
  row,
  onClose,
  onError,
}: {
  row: HrNewsRowDto | null;
  onClose: () => void;
  onError: (msg: string | null) => void;
}) {
  const remove = useDeleteNews();
  const confirm = () => {
    if (!row) return;
    onError(null);
    remove.mutate(row.id, { onSettled: onClose, onError: (e) => onError(errorMessage(e)) });
  };
  return (
    <ConfirmDialog
      open={!!row}
      title="Xoá bài viết?"
      confirmLabel="Xoá bài"
      busy={remove.isPending}
      onConfirm={confirm}
      onClose={onClose}
    >
      Bài <strong className="font-semibold text-navy">{row?.title || 'chưa có tiêu đề'}</strong> sẽ bị xoá hẳn
      {row?.status === 'published' ? ' và gỡ khỏi trang tin tức' : ''}. Không khôi phục được.
    </ConfirmDialog>
  );
}

/** The tab is kept in the address (?tab=published), so going back to the list opens the same one. */
function useTab(): [ListTab, (tab: ListTab) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get('tab');
  const tab = isTab(value) ? value : 'all';
  const setTab = (next: ListTab) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        if (next === 'all') copy.delete('tab');
        else copy.set('tab', next);
        return copy;
      },
      { replace: true },
    );
  return [tab, setTab];
}

export function HrNewsListPage() {
  usePageMeta('Tin tức');
  const [tab, setTabState] = useTab();
  const [notice, setNotice] = useState<RowNotice | null>(null);
  const [search, setSearchState] = useState('');
  const [page, setPage] = useState(1);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [toDelete, setToDelete] = useState<HrNewsRowDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useNewsRows(tab, search);
  const selection = useDraftSelection(list.rows);
  // Another tab or search starts again at page 1.
  const setTab = (next: ListTab) => {
    setTabState(next);
    setPage(1);
  };
  const setSearch = (q: string) => {
    setSearchState(q);
    setPage(1);
  };

  return (
    <>
      <ListHeading onCategories={() => setCategoriesOpen(true)} />
      <Notices error={error} notice={notice} />
      <div className="rounded-card border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-4 sm:px-[22px]">
          <FilterTabs items={list.tabs} value={tab} onChange={setTab} label="Lọc theo trạng thái" />
          <SearchBox value={search} onChange={setSearch} />
        </div>
        <BulkDeleteBar
          selected={selection.selected}
          onClear={selection.clear}
          onDone={(text) => setNotice({ tone: 'ok', text })}
          onError={setError}
        />
        <ListBody
          list={list}
          search={search}
          page={page}
          onPage={setPage}
          onDelete={setToDelete}
          onNotice={setNotice}
          selected={selection.selected}
          onSelect={selection.onSelect}
        />
      </div>
      <CategoryManager
        open={categoriesOpen}
        categories={list.news.data?.categories ?? []}
        onClose={() => setCategoriesOpen(false)}
      />
      <DeletePostDialog row={toDelete} onClose={() => setToDelete(null)} onError={setError} />
    </>
  );
}

export default HrNewsListPage;
