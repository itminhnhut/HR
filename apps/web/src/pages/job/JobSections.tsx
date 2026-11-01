import {
  EMPLOYMENT_TYPE_LABEL,
  formatDate,
  formatSalary,
  NO_REQUIREMENT,
  groupBenefits,
  openingsLabel,
  ROADMAP_MILESTONES,
  WORK_MODE_LABEL,
  type BenefitGroupKey,
  type JobDetailDto,
  type JobSection,
} from '@careers/shared';
import type { ReactNode } from 'react';
import { COLOR_CLASSES, type CategoryColor } from '../../lib/colors';
import { SITE } from '../../lib/site';
import { SectionHeading } from '../../site/SectionHeading';
import { Icon, IconRing, type IconName } from '../../ui/icons';
import { ItemBadge } from './GroupedLists';
import { benefitLook } from './itemIcons';

export function Section({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <SectionHeading icon={icon} title={title} />
      {children}
    </section>
  );
}

/** A plain list of a grouped field (closed jobs): each heading HR typed, then its items. */
export function Bullets({ sections, small }: { sections: JobSection[]; small?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 leading-relaxed text-body ${small ? 'text-[14.5px]' : 'text-base'}`}>
      {sections.map((section, group) => (
        <div key={group} className="flex flex-col gap-2">
          {section.title != null && <p className="m-0 font-semibold text-navy">{section.title}</p>}
          {section.items.length > 0 && (
            <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5 marker:text-silver-soft">
              {section.items.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Where each fact sits so every row is full: two columns on phones; on six tracks from sm, rows of three and the
 * last row(s) of two (5 facts: 3 + 2, 7: 3 + 2 + 2); from lg up to five facts share one row, more make two rows
 * on twelve tracks (6: 3 + 3, 7: 4 + 3, 8: 4 + 4). With an odd number of facts, phones leave out the salary: the
 * hero right above shows it already.
 */
function factSpan(count: number, i: number, label: string): string {
  const phone = count % 2 === 1 && label === SALARY ? 'max-sm:hidden' : '';
  return `${phone} ${tabletSpan(count, i)} ${desktopSpan(count, i)}`;
}

function desktopSpan(count: number, i: number): string {
  if (count <= LG_ONE_ROW) return 'lg:col-span-1';
  const firstRow = Math.ceil(count / 2);
  const perRow = i < firstRow ? firstRow : count - firstRow;
  return perRow === 4 ? 'lg:col-span-3' : 'lg:col-span-4';
}

function tabletSpan(count: number, i: number): string {
  if (count === 1) return 'sm:col-span-6';
  /** Facts at the end that go in rows of two. */
  const inPairs = [0, 4, 2][count % 3];
  return i >= count - inPairs ? 'sm:col-span-3' : 'sm:col-span-2';
}

const SALARY = 'Mức lương';
const LG_ONE_ROW = 5;

const LG_COLS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};
const LG_TWO_ROWS = 'lg:grid-cols-12';

const workModeLabel = (job: JobDetailDto) => (job.workMode ? WORK_MODE_LABEL[job.workMode] : null);

export function FactsCard({ job }: { job: JobDetailDto }) {
  const facts = (
    [
      ['money', SALARY, formatSalary(job)],
      ['bars', 'Kinh nghiệm', job.experience],
      ['award', 'Cấp bậc', job.level],
      ['briefcase', 'Loại hình', EMPLOYMENT_TYPE_LABEL[job.employmentType]],
      [job.workMode === 'onsite' ? 'building' : 'laptop', 'Hình thức làm việc', workModeLabel(job)],
      ['cap', 'Học vấn', job.education === NO_REQUIREMENT ? null : job.education],
      ['users', 'Số lượng tuyển', job.openings ? openingsLabel(job.openings) : null],
      ['calendar', 'Hạn nộp', formatDate(job.deadline)],
    ] as [IconName, string, string | null][]
  ).filter(([, , v]) => v);
  return (
    <div className="-mt-12 rounded-card border border-line bg-white shadow-[0_8px_30px_rgba(11,31,58,0.06)] sm:-mt-14">
      <dl
        className={`m-0 grid grid-cols-2 gap-x-4 gap-y-5 p-5 sm:grid-cols-6 sm:p-6 ${LG_COLS[facts.length] ?? LG_TWO_ROWS}`}
      >
        {facts.map(([icon, label, value], i) => (
          <div key={label} className={`flex min-w-0 items-start gap-3 ${factSpan(facts.length, i, label)}`}>
            <IconRing name={icon} size={16} className="max-sm:hidden" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="m-0 text-[15px] font-medium">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3 border-t border-line-soft px-5 py-4 text-sm sm:flex-row sm:justify-between sm:px-6">
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

/** Icon and colour of each benefit theme; "Khác" stays neutral. */
const BENEFIT_LOOK: Record<BenefitGroupKey, { icon: IconName; color: CategoryColor | null }> = {
  income: { icon: 'money', color: 'emerald' },
  insurance: { icon: 'shield', color: 'blue' },
  leave: { icon: 'calendar', color: 'amber' },
  growth: { icon: 'cap', color: 'violet' },
  activities: { icon: 'users', color: 'rose' },
  equipment: { icon: 'phone', color: 'teal' },
  other: { icon: 'gift', color: null },
};

function BenefitList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 grid list-none gap-x-8 gap-y-3 rounded-card border border-line bg-white p-5 sm:grid-cols-2 sm:p-6">
      {items.map((b, i) => (
        <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-body">
          <ItemBadge look={benefitLook(b)} small />
          <span className="min-w-0 pt-0.5">{b}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Quyền lợi". A long list is shown as themed cards (Thu nhập, Bảo hiểm & sức khoẻ, Nghỉ ngơi…), each with an
 * icon and colour, so candidates see at a glance what the company takes care of; a short list stays a list.
 */
export function Benefits({ job }: { job: JobDetailDto }) {
  if (job.benefits.length === 0) return null;
  const groups = groupBenefits(job.benefits);
  return (
    <Section icon="gift" title="Quyền lợi">
      {groups.length === 0 ? (
        <BenefitList items={job.benefits} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {groups.map((group) => {
            const look = BENEFIT_LOOK[group.key];
            const tone = look.color ? COLOR_CLASSES[look.color] : null;
            return (
              <section key={group.key} className="flex flex-col gap-3 rounded-card border border-line bg-white p-5">
                <h3 className="m-0 flex items-center gap-3 text-[15px] font-semibold text-navy">
                  <span
                    aria-hidden="true"
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tone ? `${tone.soft} ${tone.text}` : 'bg-tint text-slate'}`}
                  >
                    <Icon name={look.icon} size={18} stroke={1.8} />
                  </span>
                  {group.title}
                </h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {group.items.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-body">
                      <Icon
                        name={benefitLook(b).icon}
                        size={16}
                        stroke={1.9}
                        className={`mt-[3px] shrink-0 ${tone ? tone.text : 'text-slate'}`}
                      />
                      <span className="min-w-0">{b}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Section>
  );
}

/**
 * "Lộ trình 2 tháng thử việc": a timeline of cards. Numbered steps on a rail that turns from navy to green,
 * each step a card (when + what), and the last one (signing the contract) highlighted as the goal.
 */
export function Roadmap({ items }: { items: string[] }) {
  const steps = ROADMAP_MILESTONES.map((when, i) => [when, items[i] ?? ''] as const).filter(([, text]) => text);
  if (steps.length === 0) return null;
  return (
    <Section icon="trend" title="Lộ trình 2 tháng thử việc">
      <ol className="relative m-0 flex list-none flex-col gap-3 p-0">
        {steps.map(([when, text], i) => {
          const last = i === steps.length - 1;
          return (
            <li key={when} className="relative grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
              {/* The rail to the next step: starts under this number, ends at the next one (none after the last). */}
              {!last && (
                <span
                  aria-hidden="true"
                  className={`absolute left-[17px] top-12 -bottom-3 w-0.5 ${i === steps.length - 2 ? 'bg-gradient-to-b from-accent to-ok' : i === 0 ? 'bg-gradient-to-b from-navy to-accent' : 'bg-accent'}`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative z-[1] mt-3 flex size-9 items-center justify-center rounded-full text-sm font-semibold ring-4 ring-mist ${
                  last
                    ? 'bg-ok text-white'
                    : i === 0
                      ? 'bg-navy text-white'
                      : 'border-2 border-accent bg-white text-accent'
                }`}
              >
                {last ? <Icon name="check" size={18} stroke={2.4} /> : i + 1}
              </span>
              <div
                className={`flex flex-col gap-1.5 rounded-card border px-5 py-4 ${last ? 'border-ok/30 bg-ok-soft' : 'border-line bg-white'}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${last ? 'bg-ok text-white' : 'bg-tint text-navy'}`}
                  >
                    {when}
                  </span>
                  {last && <span className="text-[13px] font-semibold text-ok">Ký hợp đồng chính thức</span>}
                </span>
                <p className="m-0 text-[15px] leading-relaxed text-body">{text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/** Photos from topflow.vn (the company's own site). Same for every job until HR can upload per job. */
const WORKPLACE_PHOTOS: [string, string][] = [
  ['/images/company/team-expo.jpg', 'Đội ngũ TOP FLOW tại gian hàng triển lãm'],
  ['/images/company/team-charity.jpg', 'TOP FLOW trong chương trình từ thiện tại Vĩnh Hy'],
  ['/images/company/team-community.jpg', 'TOP FLOW trong chương trình "Phát triển để phụng sự"'],
];

export function Workplace({ address }: { address: string | null }) {
  return (
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
      {address ? <AddressCard address={address} /> : <OfficeMap />}
    </Section>
  );
}

const DIRECTIONS =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control border border-silver bg-white px-4 text-sm font-medium text-navy no-underline hover:bg-mist hover:text-navy';

/** Where the office is, with an embedded map and a "directions from where I am" link. */
function OfficeMap() {
  const at = SITE.officeLatLng;
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
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
          className={DIRECTIONS}
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
    <div className="flex flex-col gap-3 rounded-card border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <IconRing name="pin" size={14} className="p-[7px]" />
        <span className="text-sm font-medium leading-snug text-navy">{address}</span>
      </div>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={DIRECTIONS}
      >
        <Icon name="send" size={16} />
        Chỉ đường
      </a>
    </div>
  );
}
