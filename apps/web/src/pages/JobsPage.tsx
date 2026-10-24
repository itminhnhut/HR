import { useState } from 'react';
import { useJobs } from '../api/queries';
import { useMediaQuery, usePageMeta } from '../lib/hooks';
import { SITE } from '../lib/site';
import { JobCard, JobCardSkeleton } from '../site/JobCard';
import { NavyHero } from '../site/PublicLayout';
import { Button } from '../ui/Button';
import { EmptyState, ErrorState, LoadingStatus, useDelayedFlag } from '../ui/feedback';

const MOBILE_LIMIT = 4;

export function JobsPage() {
  usePageMeta(
    `Việc làm tại ${SITE.company}`,
    'Xem vị trí đang mở và gửi CV trong khoảng một phút. Không cần tạo tài khoản.',
  );
  const jobs = useJobs();
  const [showAll, setShowAll] = useState(false);
  const isPhone = useMediaQuery('(max-width: 639px)');
  const showSkeleton = useDelayedFlag(jobs.isPending);

  const all = jobs.data?.jobs ?? [];
  const visible = isPhone && !showAll ? all.slice(0, MOBILE_LIMIT) : all;

  return (
    <>
      <NavyHero>
        <div className="relative mx-auto flex max-w-[1160px] flex-col gap-4 px-5 pb-14 pt-10 sm:px-6">
          <h1 className="m-0 max-w-[760px] animate-rise font-serif text-[32px] font-medium tracking-[-0.3px] sm:text-[46px]">
            Cùng xây sự nghiệp với {SITE.company}
          </h1>
          <p className="m-0 max-w-[520px] text-[15px] font-light leading-relaxed text-silver sm:text-[17px]">
            Xem vị trí đang mở và gửi CV trong khoảng một phút. Không cần tạo tài khoản.
          </p>
        </div>
      </NavyHero>

      <main className="mx-auto w-full max-w-[1160px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="border-b border-field">
          <div className="flex items-baseline gap-3 pb-3">
            <h2 className="m-0 font-serif text-[30px] font-medium sm:text-[36px]">Vị trí đang mở</h2>
            {jobs.data && <span className="text-sm text-slate">{all.length} vị trí</span>}
          </div>
        </div>

        <div className="mt-6">
          {jobs.isPending && (
            <>
              <LoadingStatus />
              {showSkeleton && (
                <div className="grid gap-5 md:grid-cols-2">
                  {Array.from({ length: 4 }, (_, i) => (
                    <JobCardSkeleton key={i} />
                  ))}
                </div>
              )}
            </>
          )}
          {jobs.isError && <ErrorState onRetry={() => jobs.refetch()} />}
          {jobs.data && all.length === 0 && (
            <EmptyState icon="briefcase" title="Hiện chưa có vị trí đang mở">
              <p className="m-0">Quay lại sau nhé, các vị trí mới sẽ được đăng ở đây.</p>
            </EmptyState>
          )}
          {visible.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2 md:gap-6">
              {visible.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
          {visible.length < all.length && (
            <Button variant="outline" className="mt-4 w-full" onClick={() => setShowAll(true)}>
              Xem thêm {all.length - visible.length} vị trí
            </Button>
          )}
        </div>
      </main>
    </>
  );
}
