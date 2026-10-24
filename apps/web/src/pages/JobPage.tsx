import {
  acceptsApplications,
  daysBetween,
  EMPLOYMENT_TYPE_LABEL,
  formatDate,
  formatSalary,
  hasSalary,
  jobPostingData,
  NO_REQUIREMENT,
  ROADMAP_MILESTONES,
  todayInVietnam,
  type JobCardDto,
  type JobDetailDto,
} from '@careers/shared';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../api';
import { useJob } from '../api/queries';
import { useFlash, usePageMeta } from '../lib/hooks';
import { SITE } from '../lib/site';
import { zaloLink } from '@careers/shared';
import { ApplyDialog } from '../site/ApplyDialog';
import { ExpiringChip, MiniJobCard } from '../site/JobCard';
import { NavyHero } from '../site/PublicLayout';
import { shareJob } from '../site/share';
import { Button, ButtonAnchor, ButtonLink } from '../ui/Button';
import { EmptyState, ErrorState, LoadingStatus, Sk, useDelayedFlag } from '../ui/feedback';
import { Icon, IconRing, type IconName } from '../ui/icons';

export function JobPage() {
  const { slug = '' } = useParams();
  const query = useJob(slug);
  const showSkeleton = useDelayedFlag(query.isPending);
  const job = query.data?.job;
  usePageMeta(
    job?.title ?? (query.isError ? 'Không tìm thấy tin' : undefined),
    job ? `${job.title} · ${formatSalary(job)} · ${job.place}` : undefined,
  );

  if (query.isPending) {
    return (
      <>
        <LoadingStatus />
        {showSkeleton ? <DetailSkeleton /> : <NavyHero waves={false} />}
      </>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <NavyHero waves={false} />
        <main className="mx-auto w-full max-w-[1160px] px-5 py-16">
          {notFound ? (
            <EmptyState
              icon="search"
              title="Không tìm thấy tin tuyển dụng"
              actions={
                <ButtonLink to="/" icon="briefcase">
                  Xem vị trí đang mở
                </ButtonLink>
              }
            >
              Tin có thể đã bị gỡ hoặc link chưa đúng.
            </EmptyState>
          ) : (
            <ErrorState onRetry={() => query.refetch()} />
          )}
        </main>
      </>
    );
  }
  const { similar } = query.data;
  // key: moving between two jobs must not carry form or subscribe state over.
  return acceptsApplications(job!.status) ? (
    <OpenJob key={slug} job={job!} similar={similar} />
  ) : (
    <ClosedJob key={slug} job={job!} similar={similar} />
  );
}

export default JobPage;

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
  const [copied, flash] = useFlash();
  const fresh = publishedLabel(job.publishedAt);

  useJobPostingJsonLd(job);

  const onShare = async () => {
    if ((await shareJob(job)) === 'copied') flash();
  };

  return (
    <>
      <NavyHero>
        <div className="relative mx-auto flex max-w-[1160px] flex-col gap-3.5 px-5 pb-[84px] pt-7 sm:px-6">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-2 text-sm text-silver-soft no-underline hover:text-white"
          >
            <Icon name="arrowLeft" size={16} />
            Tất cả việc làm
          </Link>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-silver-soft">
            <span className="inline-flex items-center gap-2">
              <Icon name="briefcase" size={15} />
              {job.department}
            </span>
            {fresh && (
              <span className="inline-flex items-center gap-2 text-white">
                <Icon name="star" size={15} stroke={1.7} />
                {fresh}
              </span>
            )}
            {job.status === 'expiring' && <ExpiringChip deadline={job.deadline} />}
          </div>
          <h1 className="m-0 max-w-[820px] animate-rise font-serif text-[30px] font-medium sm:text-[44px]">
            {job.title}
          </h1>
          <span className="inline-flex items-center gap-2.5 text-lg font-semibold sm:text-xl">
            <Icon name="money" size={20} stroke={1.6} />
            {hasSalary(job) ? formatSalary(job).replace(' triệu', ' triệu/tháng') : 'Thỏa thuận'}
          </span>
          <div className="mt-3 grid grid-cols-2 gap-2.5 whitespace-nowrap sm:flex sm:flex-wrap">
            <Button variant="light" size="lg" icon="send" onClick={() => setApplyOpen(true)}>
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
        </div>
      </NavyHero>

      <main className="relative mx-auto w-full max-w-[1160px] px-4 pb-28 sm:px-6 lg:pb-20">
        <FactsCard job={job} />

        <div className="mt-12 flex flex-wrap items-start gap-10 lg:gap-12">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-14">
            {job.responsibilities.length > 0 && (
              <Section icon="checkSquare" title="Mô tả công việc">
                <Bullets items={job.responsibilities} />
              </Section>
            )}

            {job.requirements.length > 0 && (
              <Section icon="user" title="Yêu cầu">
                <Bullets items={job.requirements} />
              </Section>
            )}

            <Benefits job={job} />

            <Roadmap items={job.roadmap} />

            <Section icon="image" title="Nơi bạn sẽ làm việc">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[2fr_1fr] md:grid-rows-[150px_150px]">
                {WORKPLACE_PHOTOS.map(([src, alt], i) => (
                  <img
                    key={src}
                    src={src}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    className={`w-full rounded-card border border-ring bg-line object-cover ${i === 0 ? 'col-span-2 h-[180px] md:col-span-1 md:row-span-2 md:h-full' : 'h-[110px] md:h-full'}`}
                  />
                ))}
              </div>
              {job.address ? <AddressCard address={job.address} /> : <OfficeMap />}
            </Section>
          </div>

          <aside className="flex w-full flex-[1_1_300px] flex-col gap-4 lg:sticky lg:top-6">
            <div className="flex flex-col gap-3 rounded-card border border-line bg-white p-6 max-lg:hidden">
              <span className="text-sm text-slate">Hạn nộp {formatDate(job.deadline)}</span>
              <Button size="lg" icon="send" className="w-full" onClick={() => setApplyOpen(true)}>
                Ứng tuyển ngay
              </Button>
            </div>
            <CompanyCard />
            <AskHrCard />
          </aside>
        </div>

        {similar.length > 0 && <SimilarJobs jobs={similar} title="Việc làm tương tự" />}
      </main>

      {/* Phones: apply stays one tap away. */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2.5 border-t border-line bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
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
        <Button size="lg" icon="send" className="flex-1" onClick={() => setApplyOpen(true)}>
          Ứng tuyển ngay
        </Button>
      </div>

      <ApplyDialog job={job} open={applyOpen} onClose={() => setApplyOpen(false)} />
    </>
  );
}

function Section({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="m-0 mb-5 flex items-center gap-3 font-serif text-[26px] font-medium sm:text-[30px]">
        <Icon name={icon} size={20} stroke={1.5} className="text-accent" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Bullets({ items, small }: { items: string[]; small?: boolean }) {
  return (
    <ul
      className={`m-0 flex list-disc flex-col gap-2.5 pl-5 marker:text-silver-soft leading-relaxed text-body ${small ? 'text-[14.5px]' : 'text-base'}`}
    >
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function FactsCard({ job }: { job: JobDetailDto }) {
  const facts: [IconName, string, string | null][] = [
    ['money', 'Mức lương', formatSalary(job)],
    ['bars', 'Kinh nghiệm', job.experience],
    ['briefcase', 'Hình thức', EMPLOYMENT_TYPE_LABEL[job.employmentType]],
    ['cap', 'Học vấn', job.education === NO_REQUIREMENT ? null : job.education],
    ['calendar', 'Hạn nộp', formatDate(job.deadline)],
  ];
  return (
    <div className="-mt-12 rounded-card border border-line bg-white shadow-[0_8px_30px_rgba(11,31,58,0.06)]">
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-5 p-5 sm:p-7 lg:grid-cols-4">
        {facts
          .filter(([, , v]) => v)
          .map(([icon, label, value]) => (
            <div key={label} className="flex min-w-0 items-start gap-3">
              <IconRing name={icon} size={15} className="max-sm:hidden" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="m-0 text-[15px] font-medium">{value}</dd>
              </div>
            </div>
          ))}
      </dl>
      <div className="flex flex-col gap-3 border-t border-line-soft px-5 py-4 text-sm sm:flex-row sm:justify-between sm:px-7">
        <span className="flex items-start gap-2.5">
          <Icon name="pin" size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>
            <span className="text-slate">Nơi làm việc: </span>
            <span className="font-medium">{job.address ?? SITE.officeAddress}</span>
          </span>
        </span>
        {job.workingHours && (
          <span className="flex items-start gap-2.5">
            <Icon name="clock" size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <span className="text-slate">Giờ làm: </span>
              <span className="font-medium">{job.workingHours}</span>
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function Benefits({ job }: { job: JobDetailDto }) {
  if (job.benefits.length === 0) return null;
  return (
    <Section icon="gift" title="Quyền lợi">
      <ul className="m-0 grid list-none gap-x-8 gap-y-3 rounded-card border border-line bg-white p-6 sm:grid-cols-2">
        {job.benefits.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-body">
            <Icon name="check" size={17} stroke={2} className="mt-1 shrink-0 text-ok" />
            {b}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** "Lộ trình 2 tháng thử việc": one step per milestone that has text. */
function Roadmap({ items }: { items: string[] }) {
  const steps = ROADMAP_MILESTONES.map((when, i) => [when, items[i] ?? ''] as const).filter(([, text]) => text);
  if (steps.length === 0) return null;
  return (
    <Section icon="trend" title="Lộ trình 2 tháng thử việc">
      <ol className="m-0 flex list-none flex-col p-0">
        {steps.map(([when, text], i) => {
          const last = i === steps.length - 1;
          return (
            <li key={when} className="grid grid-cols-[28px_minmax(0,1fr)] gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-1 flex size-[18px] shrink-0 rounded-full border-2 ${last ? 'border-ok bg-ok' : i === 0 ? 'border-navy bg-navy' : 'border-accent bg-white'}`}
                />
                {!last && <span className="w-px flex-1 bg-ring" />}
              </div>
              <div className={last ? '' : 'pb-6'}>
                <h3 className="m-0 text-[15px] font-semibold">{when}</h3>
                <p className="m-0 mt-1 text-[15px] leading-relaxed text-body">{text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function CompanyCard() {
  return (
    <div className="rounded-card border border-line bg-white p-6">
      <div className="flex items-center gap-3.5">
        <span className="flex size-[52px] items-center justify-center rounded-card bg-navy">
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            <circle cx="15" cy="15" r="14" fill="none" stroke="#C5CFDC" strokeWidth="1.2" />
            <path
              d="M7 14c2.6-2.4 5.2-2.4 8 0s5.4 2.4 8 0M7 18.5c2.6-2.4 5.2-2.4 8 0s5.4 2.4 8 0"
              fill="none"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div className="flex flex-col">
          <strong className="font-serif text-[20px] font-medium">{SITE.company}</strong>
          <span className="text-[13px] text-slate">{SITE.industry}</span>
        </div>
      </div>
      <dl className="m-0 mt-5 flex flex-col gap-3.5 border-t border-line pt-5">
        {(
          [
            ['users', 'Quy mô', SITE.size],
            ['calendar', 'Hoạt động', SITE.founded],
            ['pin', 'Văn phòng', SITE.office],
          ] as const
        ).map(([icon, k, v]) => (
          <div key={k} className="flex items-start gap-3">
            <IconRing name={icon} size={14} className="p-[7px]" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="m-0 text-sm font-medium leading-snug text-navy">{v}</dd>
            </div>
          </div>
        ))}
      </dl>
      <Link to="/gioi-thieu" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium no-underline">
        Tìm hiểu về công ty
        <Icon name="arrowRight" size={15} />
      </Link>
    </div>
  );
}

function AskHrCard() {
  if (!SITE.hrZalo && !SITE.hrEmail) return null;
  return (
    <div className="rounded-card bg-tint p-6">
      <h2 className="m-0 text-[15px] font-semibold">Có câu hỏi? Hỏi HR</h2>
      {SITE.hrContactName && (
        <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-slate">
          {SITE.hrContactName}, chuyên viên tuyển dụng
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {SITE.hrZalo && (
          <ButtonAnchor
            variant="outline"
            size="sm"
            icon="chat"
            href={zaloLink(SITE.hrZalo)}
            target="_blank"
            rel="noreferrer"
          >
            Nhắn Zalo
          </ButtonAnchor>
        )}
        {SITE.hrEmail && (
          <ButtonAnchor variant="outline" size="sm" icon="mail" href={`mailto:${SITE.hrEmail}`}>
            Gửi email
          </ButtonAnchor>
        )}
      </div>
    </div>
  );
}

function SimilarJobs({ jobs, title, className = 'mt-16' }: { jobs: JobCardDto[]; title: string; className?: string }) {
  return (
    <section className={className}>
      <h2 className="m-0 mb-5 font-serif text-[28px] font-medium sm:text-[32px]">{title}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {jobs.map((j) => (
          <MiniJobCard key={j.id} job={j} />
        ))}
      </div>
    </section>
  );
}

/** Photos from topflow.vn (the company's own site). Same for every job until HR can upload per job. */
const WORKPLACE_PHOTOS: [string, string][] = [
  ['/images/company/team-expo.jpg', 'Đội ngũ TOP FLOW tại gian hàng triển lãm'],
  ['/images/company/team-charity.jpg', 'TOP FLOW trong chương trình từ thiện tại Vĩnh Hy'],
  ['/images/company/team-community.jpg', 'TOP FLOW trong chương trình "Phát triển để phụng sự"'],
];

/** Where the office is, with an embedded map and a "directions from where I am" link. */
function OfficeMap() {
  const at = SITE.officeLatLng;
  return (
    <div className="mt-4 overflow-hidden rounded-card border border-line">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <IconRing name="pin" size={14} className="p-[7px]" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium leading-snug text-navy">{SITE.officeAddress}</span>
            <span className="text-xs text-muted">Giờ làm việc: {SITE.officeHours}</span>
            <span className="text-xs text-muted">Trụ sở đăng ký: {SITE.headOffice}</span>
          </div>
        </div>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${at}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control border border-silver px-4 text-sm font-medium text-navy no-underline hover:bg-mist hover:text-navy"
        >
          <Icon name="send" size={16} />
          Chỉ đường
        </a>
      </div>
      <iframe
        title={`Bản đồ văn phòng ${SITE.company}`}
        src={`https://www.google.com/maps?q=${at}&hl=vi&z=16&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-[240px] w-full border-0 border-t border-line sm:h-[300px]"
      />
    </div>
  );
}

/** A job away from the office: its own address, with directions found by text. */
function AddressCard({ address }: { address: string }) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-card border border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <IconRing name="pin" size={14} className="p-[7px]" />
        <span className="text-sm font-medium leading-snug text-navy">{address}</span>
      </div>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control border border-silver px-4 text-sm font-medium text-navy no-underline hover:bg-mist hover:text-navy"
      >
        <Icon name="send" size={16} />
        Chỉ đường
      </a>
    </div>
  );
}

/** Google for Jobs. Only for jobs that take applications (BR-16). */
function useJobPostingJsonLd(job: JobDetailDto) {
  useEffect(() => {
    const data = jobPostingData(job, { name: SITE.company, url: SITE.url });
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
    return () => el.remove();
  }, [job]);
}

// ── Closed job (BR-05: never an error page) ──────────────────────────────

function ClosedJob({ job, similar }: { job: JobDetailDto; similar: JobCardDto[] }) {
  return (
    <>
      <NavyHero waves={false}>
        <div className="mx-auto flex max-w-[1160px] flex-col gap-3 px-5 pb-16 pt-9 sm:px-6">
          <span className="text-sm text-silver-soft">{job.department}</span>
          <h1 className="m-0 max-w-[820px] font-serif text-[30px] font-medium text-silver sm:text-[42px]">
            {job.title}
          </h1>
        </div>
      </NavyHero>
      <main className="relative mx-auto flex w-full max-w-[1160px] flex-col gap-12 px-4 pb-20 sm:px-6">
        <div
          role="status"
          className="-mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-card border border-l-[3px] border-line border-l-navy bg-white px-6 py-6 sm:px-8"
        >
          <span className="flex shrink-0 rounded-full border border-silver p-2.5">
            <Icon name="clock" size={20} stroke={1.4} />
          </span>
          <div className="flex min-w-[min(100%,420px)] flex-1 flex-col gap-1">
            <h2 className="m-0 font-serif text-[24px] font-medium sm:text-[28px]">Vị trí này đã ngừng nhận hồ sơ</h2>
            <p className="m-0 text-[15px] leading-relaxed text-body">
              Cảm ơn bạn đã quan tâm. Bạn có thể xem các vị trí khác đang tuyển bên dưới.
            </p>
          </div>
          <ButtonLink to="/" icon="briefcase">
            Xem vị trí đang mở
          </ButtonLink>
        </div>

        {similar.length > 0 && <SimilarJobs jobs={similar} title="Vị trí tương tự đang tuyển" className="" />}

        <details className="text-[15px] text-slate">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium text-body">
            Xem lại mô tả công việc cũ
          </summary>
          <div className="flex flex-col gap-4 pt-2 leading-relaxed">
            {job.responsibilities.length > 0 && <Bullets items={job.responsibilities} small />}
          </div>
        </details>
      </main>
    </>
  );
}

function DetailSkeleton() {
  return (
    <>
      <NavyHero waves={false}>
        <div aria-hidden="true" className="mx-auto flex max-w-[1160px] flex-col gap-4 px-5 pb-20 pt-8 sm:px-6">
          <Sk dark w={140} h={14} />
          <Sk dark w="min(520px, 80%)" h={44} />
          <div className="flex gap-2.5">
            <Sk dark w={110} h={28} round />
            <Sk dark w={90} h={28} round />
            <Sk dark w={120} h={28} round />
          </div>
          <div className="flex gap-3">
            <Sk dark w={180} h={52} />
            <Sk dark w={140} h={52} />
          </div>
        </div>
      </NavyHero>
      <main aria-hidden="true" className="relative mx-auto w-full max-w-[1160px] px-4 sm:px-6">
        <div className="-mt-12 grid grid-cols-2 gap-5 rounded-card border border-line bg-white p-7 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Sk w={38} h={38} round />
              <div className="flex flex-1 flex-col gap-1.5">
                <Sk w="60%" h={11} />
                <Sk w="85%" h={14} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 flex max-w-[680px] flex-col gap-3 pb-20">
          <Sk w={220} h={26} />
          <Sk w="100%" h={14} />
          <Sk w="94%" h={14} />
          <Sk w="70%" h={14} />
        </div>
      </main>
    </>
  );
}
