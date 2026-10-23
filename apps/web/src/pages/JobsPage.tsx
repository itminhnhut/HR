import { DEPARTMENTS, locationLabel, matchesQuery, EMPLOYMENT_TYPE_LABEL, type JobCardDto } from '@careers/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useJobs } from '../api/queries';
import { SubscribeBox } from '../site/SubscribeBox';
import { useMediaQuery, usePageMeta } from '../lib/hooks';
import { SITE } from '../lib/site';
import { JobCard, JobCardSkeleton } from '../site/JobCard';
import { NavyHero } from '../site/PublicLayout';
import { Button } from '../ui/Button';
import { EmptyState, ErrorState, LoadingStatus, useDelayedFlag } from '../ui/feedback';
import { Icon } from '../ui/icons';

const REMOTE = 'Làm từ xa';
const TYPES = ['Toàn thời gian', 'Bán thời gian', 'Thực tập', REMOTE] as const;
const MOBILE_LIMIT = 4;

function matchesType(job: JobCardDto, type: string) {
  if (!type) return true;
  if (type === REMOTE) return job.remote;
  return EMPLOYMENT_TYPE_LABEL[job.employmentType] === type;
}

export function JobsPage() {
  usePageMeta(
    `Việc làm tại ${SITE.company}`,
    'Xem vị trí đang mở và gửi CV trong khoảng một phút. Không cần tạo tài khoản.',
  );
  const jobs = useJobs();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const loc = params.get('noi') ?? '';
  const dep = params.get('phong') ?? '';
  const type = params.get('hinh-thuc') ?? '';
  const [draftQ, setDraftQ] = useState(q);
  const [draftLoc, setDraftLoc] = useState(loc);
  const [showAll, setShowAll] = useState(false);
  const isPhone = useMediaQuery('(max-width: 639px)');
  const showSkeleton = useDelayedFlag(jobs.isPending);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: true });
    setShowAll(false);
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    set({ q: draftQ.trim(), noi: draftLoc });
  };

  const all = jobs.data?.jobs ?? [];
  const filtered = useMemo(
    () =>
      all.filter(
        (j) =>
          (!dep || j.department === dep) &&
          matchesType(j, type) &&
          (!loc || (loc === REMOTE ? j.remote : j.city === loc)) &&
          matchesQuery(`${j.title} ${j.department} ${j.perks} ${locationLabel(j)}`, q),
      ),
    [all, dep, type, loc, q],
  );
  const visible = isPhone && !showAll ? filtered.slice(0, MOBILE_LIMIT) : filtered;
  const hasSearch = !!q || !!loc;
  const departments = DEPARTMENTS.filter((d) => all.some((j) => j.department === d));

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
          <form
            role="search"
            onSubmit={onSearch}
            className="mt-2 flex max-w-[760px] flex-col overflow-hidden rounded-card bg-white sm:flex-row"
          >
            <label className="flex min-h-[52px] flex-1 items-center gap-3 border-b border-line px-5 sm:border-b-0">
              <Icon name="search" size={18} stroke={1.8} className="text-slate" />
              <span className="sr-only">Từ khóa</span>
              <input
                type="search"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="Vị trí hoặc kỹ năng"
                className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-navy outline-none placeholder:text-muted"
              />
            </label>
            <label className="relative flex min-h-[52px] items-center gap-3 px-5 sm:w-[260px] sm:border-l sm:border-line">
              <Icon name="pin" size={18} stroke={1.8} className="text-slate" />
              <span className="sr-only">Địa điểm</span>
              <select
                value={draftLoc}
                onChange={(e) => setDraftLoc(e.target.value)}
                className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-[15px] text-navy outline-none"
              >
                <option value="">Mọi địa điểm</option>
                {(jobs.data?.cities ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={REMOTE}>{REMOTE}</option>
              </select>
              <Icon name="chevronDown" size={16} className="pointer-events-none text-slate" />
            </label>
            <button
              type="submit"
              className="btn-glow inline-flex min-h-[52px] items-center justify-center gap-2 border-0 bg-accent px-8 text-[15px] font-medium text-white"
            >
              <Icon name="search" size={18} stroke={1.8} />
              Tìm việc
            </button>
          </form>
        </div>
      </NavyHero>

      <main className="mx-auto w-full max-w-[1160px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-field">
          <div className="flex items-baseline gap-3 pb-3">
            <h2 className="m-0 font-serif text-[30px] font-medium sm:text-[36px]">Vị trí đang mở</h2>
            {jobs.data && <span className="text-sm text-slate">{filtered.length} vị trí</span>}
          </div>
          <div
            role="group"
            aria-label="Lọc theo phòng ban"
            className="-mb-px flex gap-5 overflow-x-auto whitespace-nowrap"
          >
            {['', ...departments].map((d) => (
              <button
                key={d || 'all'}
                type="button"
                aria-pressed={dep === d}
                onClick={() => set({ phong: d })}
                className={`min-h-11 shrink-0 border-0 border-b-2 bg-transparent px-0.5 text-sm ${
                  dep === d ? 'border-navy font-semibold text-navy' : 'border-transparent text-slate hover:text-navy'
                }`}
              >
                {d || 'Tất cả'}
              </button>
            ))}
          </div>
          <label className="relative mb-3 flex min-h-11 items-center gap-2 rounded-control border border-field bg-white pl-3.5 pr-9 max-sm:w-full">
            <Icon name="clock" size={16} className="text-slate" />
            <span className="sr-only">Hình thức</span>
            <select
              value={type}
              onChange={(e) => set({ 'hinh-thuc': e.target.value })}
              className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-sm text-navy outline-none"
            >
              <option value="">Mọi hình thức</option>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 text-slate" />
          </label>
        </div>

        {hasSearch && (
          <div role="status" className="mt-5 flex flex-wrap items-center gap-2.5 text-sm text-body">
            <span>
              Kết quả cho{' '}
              <strong className="font-semibold text-navy">{[q && `"${q}"`, loc].filter(Boolean).join(' · ')}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setDraftQ('');
                setDraftLoc('');
                set({ q: '', noi: '' });
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-field bg-white px-3 text-[13px] text-body"
            >
              <Icon name="x" size={13} stroke={1.8} />
              Xóa tìm kiếm
            </button>
          </div>
        )}

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
              <p className="m-0 mb-4">Để lại số Zalo để nhận tin khi công ty mở tuyển.</p>
              <SubscribeBox department="" compact />
            </EmptyState>
          )}
          {jobs.data && all.length > 0 && filtered.length === 0 && (
            <EmptyState
              title="Không có vị trí phù hợp"
              actions={
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraftQ('');
                    setDraftLoc('');
                    setParams(new URLSearchParams(), { replace: true });
                  }}
                >
                  Xóa bộ lọc
                </Button>
              }
            >
              Thử bỏ bớt bộ lọc hoặc chọn phòng ban khác.
            </EmptyState>
          )}
          {visible.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2 md:gap-6">
              {visible.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
          {visible.length < filtered.length && (
            <Button variant="outline" className="mt-4 w-full" onClick={() => setShowAll(true)}>
              Xem thêm {filtered.length - visible.length} vị trí
            </Button>
          )}
        </div>
      </main>
    </>
  );
}
