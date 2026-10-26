import type { JobCardDto } from '@careers/shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useJobs } from '../api/queries';
import { useMediaQuery, usePageMeta } from '../lib/hooks';
import { SITE } from '../lib/site';
import { JobCard, JobCardSkeleton } from '../site/JobCard';
import { JobFilters, useJobFilters } from '../site/JobFilters';
import { filterJobs, filterOptions, hasActiveFilters, shownOnPhone } from '../site/jobFilterModel';
import { LoadMore } from '../site/LoadMore';
import { NewsTeaser } from '../site/news/NewsTeaser';
import { PAGE_WIDTH, PageHero } from '../site/PageHero';
import { SectionHeading } from '../site/SectionHeading';
import { Button } from '../ui/Button';
import { EmptyState, ErrorState, LoadingStatus } from '../ui/feedback';
import { Icon } from '../ui/icons';

const INTRO = 'Xem vị trí đang mở và gửi CV trong khoảng một phút. Không cần tạo tài khoản.';

/** The board's state: jobs, filters in the address, and on phones the first ten ("Xem thêm" for the rest). */
function useJobsBoard() {
  const jobs = useJobs();
  const [showAll, setShowAll] = useState(false);
  // A new filter starts the phone list short again.
  const { filters, update, clear } = useJobFilters(useCallback(() => setShowAll(false), []));
  const searchRef = useRef<HTMLInputElement>(null);
  const isPhone = useMediaQuery('(max-width: 639px)');
  const all = useMemo(() => jobs.data?.jobs ?? [], [jobs.data]);
  const filtered = useMemo(() => filterJobs(all, filters), [all, filters]);
  return {
    jobs,
    all,
    filtered,
    visible: isPhone ? shownOnPhone(filtered, showAll) : filtered,
    filters,
    update,
    searchRef,
    showAll: () => setShowAll(true),
    clearAll: () => {
      clear();
      searchRef.current?.focus();
    },
  };
}

export function JobsPage() {
  // "· TOP FLOW" is added after the title.
  usePageMeta('Tuyển dụng – việc làm đang mở', INTRO);
  const { jobs, all, filtered, visible, filters, update, searchRef, showAll, clearAll } = useJobsBoard();

  return (
    <>
      <PageHero title={`Cùng xây sự nghiệp với ${SITE.company}`} intro={INTRO} />
      {/* Sections are full-width stripes: the jobs on the page background, company life on the brand tint. */}
      <main className="flex min-h-svh flex-col">
        <section aria-labelledby="jobs-title" className={`${PAGE_WIDTH} flex-1 py-10 sm:py-14`}>
          <ResultsHeader
            count={jobs.data ? filtered.length : null}
            isFiltered={hasActiveFilters(filters)}
            onClear={clearAll}
          />
          {/* Also while loading, so the list below does not jump down when the jobs arrive. */}
          {(all.length > 0 || jobs.isPending) && (
            <JobFilters
              filters={filters}
              departments={filterOptions(
                all.map((j) => j.department),
                filters.department,
              )}
              places={filterOptions(
                all.map((j) => j.place),
                filters.place,
              )}
              onChange={update}
              searchRef={searchRef}
            />
          )}

          <JobResults
            state={jobs.isPending ? 'pending' : jobs.isError ? 'error' : 'ready'}
            onRetry={() => void jobs.refetch()}
            total={all.length}
            filtered={filtered.length}
            visible={visible}
            onClear={clearAll}
            onMore={showAll}
          />
        </section>
        <NewsTeaser />
      </main>
    </>
  );
}

interface JobResultsProps {
  state: 'pending' | 'error' | 'ready';
  onRetry: () => void;
  /** Open jobs, matching jobs, and the ones shown (phones show the first few). */
  total: number;
  filtered: number;
  visible: JobCardDto[];
  onClear: () => void;
  onMore: () => void;
}

function JobResults({ state, onRetry, total, filtered, visible, onClear, onMore }: JobResultsProps) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      {state === 'pending' && <JobsLoading />}
      {state === 'error' && <ErrorState onRetry={onRetry} />}
      {state === 'ready' && total === 0 && (
        <EmptyState icon="briefcase" title="Hiện chưa có vị trí đang mở">
          <p className="m-0">Quay lại sau nhé, các vị trí mới sẽ được đăng ở đây.</p>
        </EmptyState>
      )}
      {total > 0 && filtered === 0 && <NoMatch onClear={onClear} />}
      <JobGrid jobs={visible} />
      {visible.length < filtered && (
        <LoadMore
          label={`Xem thêm ${filtered - visible.length} vị trí`}
          onMore={onMore}
          status={`Đang xem ${visible.length} / ${filtered} vị trí`}
        />
      )}
    </div>
  );
}

interface ResultsHeaderProps {
  /** Matching jobs, or null while the list is not loaded. */
  count: number | null;
  isFiltered: boolean;
  onClear: () => void;
}

function ResultsHeader({ count, isFiltered, onClear }: ResultsHeaderProps) {
  return (
    <SectionHeading
      id="jobs-title"
      title="Vị trí đang mở"
      className="min-h-14 border-b border-field pb-3"
      note={
        <span aria-live="polite" className="text-sm text-slate">
          {count !== null && `${count} vị trí`}
        </span>
      }
    >
      {isFiltered && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-field bg-white px-3.5 text-[13px] text-body hover:bg-mist"
        >
          <Icon name="x" size={14} stroke={1.8} />
          Xoá lọc
        </button>
      )}
    </SectionHeading>
  );
}

/** Skeletons right away, faded in only if loading takes a moment (no blank screen, no flash). */
function JobsLoading() {
  return (
    <>
      <LoadingStatus />
      <div className="skeleton-in grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 md:gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}

function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      title="Không có vị trí phù hợp"
      actions={
        <Button variant="outline" onClick={onClear}>
          Xoá lọc
        </Button>
      }
    >
      Thử từ khoá khác hoặc bỏ bớt bộ lọc.
    </EmptyState>
  );
}

function JobGrid({ jobs }: { jobs: JobCardDto[] }) {
  if (jobs.length === 0) return null;
  return (
    <div className="stagger grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 md:gap-6">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
