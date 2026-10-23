import {
  daysLeft,
  EMPLOYMENT_TYPE_LABEL,
  formatDate,
  formatSalary,
  isRecentlyPublished,
  locationLabel,
  type JobCardDto,
} from '@careers/shared';
import { Link } from 'react-router';
import { Icon, IconRing } from '../ui/icons';

export function ExpiringChip({ deadline, className = '' }: { deadline: string; className?: string }) {
  const left = Math.max(daysLeft(deadline), 0);
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full bg-remind px-2 py-0.5 text-xs font-semibold text-navy ${className}`}
    >
      {left === 0 ? 'Hôm nay là hạn cuối' : `Còn ${left} ngày`}
    </span>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: 'pin' | 'clock' | 'calendar';
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <IconRing name={icon} size={14} className="p-[7px]" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="m-0 flex flex-col gap-1 text-sm font-medium text-navy">{children}</dd>
      </div>
    </div>
  );
}

export function JobCard({ job }: { job: JobCardDto }) {
  return (
    <Link
      to={`/viec-lam/${job.slug}`}
      className="card-hover group flex flex-col gap-4 rounded-card border border-line bg-white p-5 text-navy no-underline hover:text-navy sm:p-7"
    >
      <div className="flex items-center justify-between gap-3 text-[13px] text-slate">
        <span className="inline-flex items-center gap-2.5">
          <IconRing name="briefcase" size={14} className="p-[7px]" />
          {job.department}
        </span>
        {isRecentlyPublished(job.publishedAt) && (
          <span className="inline-flex items-center gap-1.5 font-medium text-navy">
            <Icon name="star" size={13} stroke={1.8} />
            Mới đăng
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="m-0 font-serif text-[22px] font-medium sm:text-[26px]">{job.title}</h3>
        <span className="inline-flex items-center gap-2 text-[17px] font-semibold text-accent">
          <Icon name="money" size={18} stroke={1.7} />
          {formatSalary(job)}
        </span>
      </div>
      <dl className="m-0 flex flex-wrap gap-x-6 gap-y-3 border-t border-line-soft pt-4 sm:grid sm:grid-cols-3 sm:gap-3">
        <Fact icon="pin" label="Địa điểm">
          {locationLabel(job)}
        </Fact>
        <Fact icon="clock" label="Hình thức">
          {EMPLOYMENT_TYPE_LABEL[job.employmentType]}
        </Fact>
        <Fact icon="calendar" label="Hạn nộp">
          {formatDate(job.deadline)}
          {job.status === 'expiring' && <ExpiringChip deadline={job.deadline} />}
        </Fact>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {job.perks ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-slate">
            <Icon name="gift" size={15} />
            {job.perks}
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-navy">
          Xem chi tiết
          <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/** Compact card for "Việc làm tương tự". */
export function MiniJobCard({ job }: { job: JobCardDto }) {
  return (
    <Link
      to={`/viec-lam/${job.slug}`}
      className="card-hover flex flex-col gap-2 rounded-card border border-line bg-white px-6 py-5 text-navy no-underline hover:text-navy"
    >
      <span className="text-[13px] text-slate">{job.department}</span>
      <span className="font-serif text-[22px] font-medium">{job.title}</span>
      <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-accent">
        <Icon name="money" size={16} />
        {formatSalary(job)}
      </span>
      <span className="inline-flex items-center gap-2 text-[13px] text-slate">
        <Icon name="pin" size={14} />
        {locationLabel(job)}, hạn {formatDate(job.deadline).slice(0, 5)}
      </span>
    </Link>
  );
}

export function JobCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 rounded-card border border-line bg-white p-5 sm:p-7">
      <div className="flex justify-between">
        <span className="block h-3.5 w-24 animate-pulse-soft rounded-control bg-skeleton" />
        <span className="block h-3.5 w-16 animate-pulse-soft rounded-control bg-skeleton" />
      </div>
      <span className="block h-7 w-2/3 animate-pulse-soft rounded-control bg-skeleton" />
      <span className="block h-5 w-36 animate-pulse-soft rounded-control bg-skeleton" />
      <div className="flex gap-5 border-t border-line-soft pt-4">
        <span className="block h-4 w-24 animate-pulse-soft rounded-control bg-skeleton" />
        <span className="block h-4 w-24 animate-pulse-soft rounded-control bg-skeleton" />
        <span className="block h-4 w-20 animate-pulse-soft rounded-control bg-skeleton" />
      </div>
    </div>
  );
}
