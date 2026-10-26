import {
  daysLeft,
  EMPLOYMENT_TYPE_LABEL,
  formatDate,
  formatSalary,
  isRecentlyPublished,
  type JobCardDto,
} from '@careers/shared';
import { useId } from 'react';
import { departmentClasses } from '../lib/colors';
import { Icon, IconRing } from '../ui/icons';
import { CARD_PAD, CARD_TITLE_HOVER, CardFooter, CardLink, cardClass } from './Card';
import { cardPerkChips, shortPlace } from './jobCardText';

export function ExpiringChip({ deadline, className = '' }: { deadline: string; className?: string }) {
  const left = Math.max(daysLeft(deadline), 0);
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border border-cat-amber-line bg-cat-amber-soft px-2 py-0.5 text-xs font-semibold text-cat-amber ${className}`}
    >
      {left === 0 ? 'Hôm nay là hạn cuối' : `Còn ${left} ngày`}
    </span>
  );
}

/** One fact of the card: <div><dt>icon + label</dt><dd>value</dd></div>, the icon beside both lines. */
function Fact({
  icon,
  label,
  children,
  className = '',
}: {
  icon: 'pin' | 'clock' | 'calendar';
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex min-w-0 flex-col gap-0.5 pl-[38px] ${className}`}>
      <dt className="text-[13px] text-muted sm:text-xs">
        <IconRing name={icon} size={14} className="absolute left-0 top-0 p-[7px]" />
        {label}
      </dt>
      <dd className="m-0 flex flex-col gap-1 text-sm font-medium text-navy">{children}</dd>
    </div>
  );
}

/** The department as a chip in its colour (lib/colors): the same department is the same colour everywhere. */
export function DepartmentChip({ department, className = '' }: { department: string; className?: string }) {
  const c = departmentClasses(department);
  return (
    <span
      className={`inline-flex w-fit min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium leading-none ${c.soft} ${c.line} ${c.text} ${className}`}
    >
      <Icon name="briefcase" size={14} stroke={1.8} className="shrink-0" />
      <span className="truncate leading-[1.15]">{department}</span>
    </span>
  );
}

/** Department chip, and "Mới đăng" in green. */
function JobCardHeader({ job }: { job: JobCardDto }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <DepartmentChip department={job.department} />
      {isRecentlyPublished(job.publishedAt) && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ok-line bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok">
          <Icon name="star" size={14} stroke={2} />
          Mới đăng
        </span>
      )}
    </div>
  );
}

/**
 * One job on the board. Every card has the same skeleton so cards side by side line up: header row, title +
 * salary, three facts, then a footer pinned to the bottom (perks other than the pay as short chips, never a
 * cut-off sentence; "Xem chi tiết" always right). The link is named by the title alone, not the whole card.
 * Colour: navy text, the accent blue for salary, the department chip in its category colour, green for
 * "Mới đăng" and amber for a closing deadline.
 */
export function JobCard({ job }: { job: JobCardDto }) {
  const titleId = useId();
  const perks = cardPerkChips(job.perks);
  return (
    <CardLink to={`/viec-lam/${job.slug}`} aria-labelledby={titleId} className={`flex-col ${CARD_PAD} gap-4`}>
      <JobCardHeader job={job} />
      <div className="flex flex-col gap-2">
        <h3 id={titleId} className={`m-0 font-serif type-card-lg font-medium leading-snug ${CARD_TITLE_HOVER}`}>
          {job.title}
        </h3>
        <span className="inline-flex items-center gap-2 text-[17px] font-semibold text-accent">
          <Icon name="money" size={20} stroke={1.7} />
          {formatSalary(job)}
        </span>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line-soft pt-4 sm:grid-cols-3 sm:gap-3">
        {/* Phones: the place gets the whole first row, so it stays on one line. */}
        <Fact icon="pin" label="Địa điểm" className="max-sm:col-span-2">
          <span title={job.place}>{shortPlace(job.place)}</span>
        </Fact>
        <Fact icon="clock" label="Hình thức">
          {EMPLOYMENT_TYPE_LABEL[job.employmentType]}
        </Fact>
        <Fact icon="calendar" label="Hạn nộp">
          {formatDate(job.deadline)}
          {job.status === 'expiring' && <ExpiringChip deadline={job.deadline} />}
        </Fact>
      </dl>
      <CardFooter>
        {perks.length > 0 ? (
          <span className="flex min-w-0 items-center gap-2">
            <Icon name="gift" size={16} className="shrink-0 text-cat-rose" />
            <span className="sr-only">Quyền lợi: </span>
            <span className="flex min-w-0 flex-wrap gap-1.5">
              {perks.map((chip) => (
                <span
                  key={chip}
                  className="whitespace-nowrap rounded-full border border-line-soft bg-tint px-2.5 py-0.5 text-xs font-medium text-accent"
                >
                  {chip}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span />
        )}
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-link group-hover:text-navy"
        >
          Xem chi tiết
          <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </CardFooter>
    </CardLink>
  );
}

/**
 * Compact card for "Việc làm tương tự" and "Vị trí đang tuyển". Side by side (from md) the title always takes two
 * lines, so the salary and place lines of neighbouring cards are at the same height.
 */
export function MiniJobCard({ job }: { job: JobCardDto }) {
  const titleId = useId();
  return (
    <CardLink to={`/viec-lam/${job.slug}`} aria-labelledby={titleId} className={`flex-col ${CARD_PAD} gap-2`}>
      <DepartmentChip department={job.department} className="mb-1" />
      <h3
        id={titleId}
        className={`m-0 line-clamp-2 font-serif md:min-h-[2lh] type-card font-medium leading-snug ${CARD_TITLE_HOVER}`}
      >
        {job.title}
      </h3>
      <CardFooter className="flex-col items-start gap-1.5 pt-3">
        <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-accent">
          <Icon name="money" size={16} />
          {formatSalary(job)}
        </span>
        <span className="inline-flex items-center gap-2 text-[13px] text-slate">
          <Icon name="pin" size={14} />
          {shortPlace(job.place)}, hạn {formatDate(job.deadline).slice(0, 5)}
        </span>
      </CardFooter>
    </CardLink>
  );
}

const Bar = ({ className }: { className: string }) => (
  <span className={`block animate-pulse-soft rounded-control bg-skeleton ${className}`} />
);

/** Same box as JobCard, so nothing moves when the jobs arrive. */
export function JobCardSkeleton() {
  return (
    <div aria-hidden="true" className={cardClass(`flex-col ${CARD_PAD} gap-4`)}>
      <div className="flex min-h-7 items-center justify-between">
        <Bar className="h-6 w-28 rounded-full" />
        <Bar className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Bar className="h-7 w-2/3" />
        <Bar className="h-6 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-line-soft pt-4 sm:grid-cols-3">
        <Bar className="h-9 w-full" />
        <Bar className="h-9 w-full" />
        <Bar className="h-9 w-full max-sm:hidden" />
      </div>
      <div className="mt-auto flex justify-between border-t border-line-soft pt-4">
        <Bar className="h-4 w-40" />
        <Bar className="h-4 w-24" />
      </div>
    </div>
  );
}
