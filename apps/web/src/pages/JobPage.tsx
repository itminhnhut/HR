import {
  acceptsApplications,
  daysBetween,
  formatSalary,
  hasSalary,
  JOB_SECTION,
  jobBreadcrumbData,
  jobPostingData,
  todayInVietnam,
  zaloLink,
  type JobCardDto,
  type JobDetailDto,
} from '@careers/shared';
import { useRef, type RefObject } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../api';
import { useJob } from '../api/queries';
import { useFlash, useJsonLd, usePageMeta, useScrolledPast } from '../lib/hooks';
import { SITE } from '../lib/site';
import { ApplyDialog } from '../site/ApplyDialog';
import { DepartmentChip, ExpiringChip } from '../site/JobCard';
import { NotFoundView } from '../site/NotFoundView';
import { PAGE_WIDTH, PageHero } from '../site/PageHero';
import { shareJob } from '../site/share';
import { Button, ButtonAnchor, ButtonLink } from '../ui/Button';
import { ErrorState } from '../ui/feedback';
import { Icon } from '../ui/icons';
import { ClosedJob } from './job/ClosedJob';
import { JobSidebar, SimilarJobs } from './job/JobAside';
import { Benefits, FactsCard, Roadmap, Section, Workplace, TaskList, CheckList } from './job/JobSections';
import { JobSkeleton } from './job/JobSkeleton';

export function JobPage() {
  const { slug = '' } = useParams();
  const query = useJob(slug);
  const job = query.data?.job;
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  // A missing job sets its own meta (NotFoundView: noindex, no canonical).
  usePageMeta(
    job?.title ?? (query.isError && !notFound ? 'Chưa tải được tin tuyển dụng' : undefined),
    job ? `${job.title} · ${formatSalary(job)} · ${job.place}` : undefined,
  );
  useJsonLd(job ? jobBreadcrumbData(job, { name: SITE.company, url: SITE.url }) : null);

  if (query.isPending) return <JobSkeleton />;
  if (notFound) return <JobMissing />;
  if (!query.data || !job) {
    return (
      <>
        <PageHero crumbs={[{ label: 'Việc làm', to: '/' }]} title="Chưa tải được tin tuyển dụng" />
        <main className={`${PAGE_WIDTH} py-10`}>
          <ErrorState onRetry={() => query.refetch()} />
        </main>
      </>
    );
  }
  const { similar } = query.data;
  // key: moving between two jobs must not carry form or subscribe state over.
  return acceptsApplications(job.status) ? (
    <OpenJob key={slug} job={job} similar={similar} />
  ) : (
    <ClosedJob key={slug} job={job} similar={similar} />
  );
}

export default JobPage;

function JobMissing() {
  return (
    <NotFoundView
      crumbs={[{ label: 'Việc làm', to: '/' }, { label: 'Không tìm thấy tin' }]}
      title="Không tìm thấy tin tuyển dụng"
      intro="Tin có thể đã bị gỡ hoặc link chưa đúng. Các vị trí đang mở vẫn ở trang Việc làm."
      actions={
        <ButtonLink to="/" variant="brand" size="lg" icon="briefcase">
          Xem vị trí đang mở
        </ButtonLink>
      }
    />
  );
}

// ── Open job ─────────────────────────────────────────────────────────────

/** ?ung-tuyen=1 opens the form, so Back closes it and the link is shareable. */
function useApplyParam(): [boolean, (open: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const open = params.get('ung-tuyen') === '1';
  const set = (next: boolean) => {
    if (!next && (location.state as { applyPushed?: boolean } | null)?.applyPushed) return navigate(-1);
    const p = new URLSearchParams(params);
    if (next) p.set('ung-tuyen', '1');
    else p.delete('ung-tuyen');
    setParams(p, next ? { state: { applyPushed: true } } : { replace: true });
  };
  return [open, set];
}

function publishedLabel(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const days = daysBetween(todayInVietnam(new Date(publishedAt)), todayInVietnam());
  if (days <= 0) return 'Mới đăng hôm nay';
  if (days <= 7) return `Mới đăng ${days} ngày trước`;
  return null;
}

function OpenJob({ job, similar }: { job: JobDetailDto; similar: JobCardDto[] }) {
  const [applyOpen, setApplyOpen] = useApplyParam();
  const heroActions = useRef<HTMLDivElement>(null);
  // No observer (old browser, tests): keep the bar, so apply stays one tap away.
  const showBar = useScrolledPast(heroActions, true);
  // Google for Jobs. Only for jobs that take applications (BR-16).
  useJsonLd(jobPostingData(job, { name: SITE.company, url: SITE.url }));
  const apply = () => setApplyOpen(true);

  return (
    <>
      <JobHero job={job} actionsRef={heroActions} onApply={apply} />

      <main className={`relative ${PAGE_WIDTH} flex flex-col gap-16 pb-28 lg:pb-20`}>
        <FactsCard job={job} />

        <div className="flex flex-wrap items-start gap-10 lg:gap-12">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-14">
            {job.responsibilities.length > 0 && (
              <Section icon="checkSquare" title={JOB_SECTION.responsibilities}>
                <TaskList items={job.responsibilities} />
              </Section>
            )}
            {job.requirements.length > 0 && (
              <Section icon="user" title={JOB_SECTION.requirements}>
                <CheckList items={job.requirements} variant="required" />
              </Section>
            )}
            {job.preferred.length > 0 && (
              <Section icon="star" title={JOB_SECTION.preferred}>
                <CheckList items={job.preferred} variant="preferred" />
              </Section>
            )}
            <Benefits job={job} />
            <Roadmap items={job.roadmap} />
            <Workplace address={job.address} />
          </div>

          <JobSidebar deadline={job.deadline} onApply={apply} />
        </div>

        <SimilarJobs jobs={similar} title="Việc làm tương tự" />
      </main>

      {showBar && <ApplyBar onApply={apply} />}
      <ApplyDialog job={job} open={applyOpen} onClose={() => setApplyOpen(false)} />
    </>
  );
}

interface JobHeroProps {
  job: JobDetailDto;
  actionsRef: RefObject<HTMLDivElement | null>;
  onApply: () => void;
}

function JobHero({ job, actionsRef, onApply }: JobHeroProps) {
  const [copied, flash] = useFlash();
  const fresh = publishedLabel(job.publishedAt);
  const onShare = async () => {
    if ((await shareJob(job)) === 'copied') flash();
  };
  return (
    <PageHero
      crumbs={[{ label: 'Việc làm', to: '/' }, { label: job.title }]}
      eyebrow={<DepartmentChip department={job.department} className="normal-case tracking-normal" />}
      title={job.title}
      overlap
      actions={
        <div
          ref={actionsRef}
          className="grid w-full grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3 whitespace-nowrap sm:flex sm:w-auto"
        >
          <Button variant="brand" size="lg" icon="send" onClick={onApply} className="px-4 sm:px-7">
            Ứng tuyển ngay
          </Button>
          <Button
            variant="outlineLight"
            size="lg"
            icon={copied ? 'check' : 'share'}
            onClick={onShare}
            aria-live="polite"
            className="px-4"
          >
            {copied ? 'Đã sao chép link' : 'Chia sẻ'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="inline-flex items-center gap-2.5 text-lg font-semibold sm:text-xl">
          <Icon name="money" size={20} stroke={1.6} />
          {hasSalary(job) ? formatSalary(job).replace(' triệu', ' triệu/tháng') : 'Thỏa thuận'}
        </span>
        {fresh && (
          <span className="inline-flex items-center gap-2 text-sm text-silver">
            <Icon name="star" size={16} stroke={1.7} />
            {fresh}
          </span>
        )}
        {job.status === 'expiring' && <ExpiringChip deadline={job.deadline} />}
      </div>
    </PageHero>
  );
}

/** Phones: once the hero's button has scrolled away, apply stays one tap away at the bottom. */
function ApplyBar({ onApply }: { onApply: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 flex animate-slide-up gap-2.5 border-t border-line bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(11,31,58,0.08)] backdrop-blur lg:hidden">
      {(SITE.hrZalo || SITE.hrEmail) && (
        <ButtonAnchor
          variant="outline"
          size="lg"
          href={SITE.hrZalo ? zaloLink(SITE.hrZalo) : `mailto:${SITE.hrEmail}`}
          aria-label={SITE.hrZalo ? 'Nhắn Zalo cho HR' : 'Gửi email cho HR'}
          className="px-4"
        >
          <Icon name="chat" size={20} />
        </ButtonAnchor>
      )}
      <Button variant="brand" size="lg" icon="send" className="flex-1" onClick={onApply}>
        Ứng tuyển ngay
      </Button>
    </div>
  );
}
