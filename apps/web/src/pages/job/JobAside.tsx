import { formatDate, zaloLink, type JobCardDto } from '@careers/shared';
import { SITE } from '../../lib/site';
import { MiniJobCard } from '../../site/JobCard';
import { SectionHeading, TextLink } from '../../site/SectionHeading';
import { Button, ButtonAnchor } from '../../ui/Button';
import { IconRing } from '../../ui/icons';

function LogoTile() {
  return (
    <span className="flex size-[52px] shrink-0 items-center justify-center rounded-card bg-navy">
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
  );
}

const COMPANY_FACTS = [
  ['users', 'Quy mô', SITE.size],
  ['calendar', 'Hoạt động', SITE.founded],
  ['pin', 'Văn phòng', SITE.office],
] as const;

function CompanyCard() {
  return (
    <div className="rounded-card border border-line bg-white p-5 sm:p-6">
      <div className="flex items-center gap-3.5">
        <LogoTile />
        <div className="flex flex-col">
          <strong className="font-serif text-[20px] font-medium">{SITE.company}</strong>
          <span className="text-[13px] text-slate">{SITE.industry}</span>
        </div>
      </div>
      <dl className="m-0 mt-5 flex flex-col gap-3.5 border-t border-line pt-5">
        {COMPANY_FACTS.map(([icon, k, v]) => (
          <div key={k} className="flex items-start gap-3">
            <IconRing name={icon} size={14} className="p-[7px]" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="m-0 text-sm font-medium leading-snug text-navy">{v}</dd>
            </div>
          </div>
        ))}
      </dl>
      <TextLink to="/gioi-thieu" className="mt-2">
        Tìm hiểu về công ty
      </TextLink>
    </div>
  );
}

function AskHrCard() {
  if (!SITE.hrZalo && !SITE.hrEmail) return null;
  return (
    <div className="rounded-card bg-tint p-5 sm:p-6">
      <h2 className="m-0 text-[15px] font-semibold">Có câu hỏi? Hỏi HR</h2>
      {SITE.hrContactName && (
        <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-slate">
          {SITE.hrContactName}, chuyên viên tuyển dụng
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {SITE.hrZalo && (
          <ButtonAnchor variant="outline" icon="chat" href={zaloLink(SITE.hrZalo)} target="_blank" rel="noreferrer">
            Nhắn Zalo
          </ButtonAnchor>
        )}
        {SITE.hrEmail && (
          <ButtonAnchor variant="outline" icon="mail" href={`mailto:${SITE.hrEmail}`}>
            Gửi email
          </ButtonAnchor>
        )}
      </div>
    </div>
  );
}

export function SimilarJobs({ jobs, title }: { jobs: JobCardDto[]; title: string }) {
  if (jobs.length === 0) return null;
  return (
    <section aria-labelledby="similar-jobs" className="flex flex-col gap-5">
      <SectionHeading id="similar-jobs" title={title}>
        <TextLink to="/">Xem tất cả vị trí</TextLink>
      </SectionHeading>
      <div className="stagger grid gap-4 md:grid-cols-3 md:gap-6">
        {jobs.map((j) => (
          <MiniJobCard key={j.id} job={j} />
        ))}
      </div>
    </section>
  );
}

/**
 * Right column on desktop (sticky): apply with the deadline, the company, and who to ask. The apply button has
 * the same primary look as the hero's: one action, one colour.
 */
export function JobSidebar({ deadline, onApply }: { deadline: string; onApply: () => void }) {
  return (
    <aside className="flex w-full flex-[1_1_300px] flex-col gap-4 lg:sticky lg:top-6">
      <div className="flex flex-col gap-3 rounded-card border border-line bg-white p-5 max-lg:hidden sm:p-6">
        <span className="text-sm text-slate">Hạn nộp {formatDate(deadline)}</span>
        <Button size="lg" icon="send" className="w-full" onClick={onApply}>
          Ứng tuyển ngay
        </Button>
      </div>
      <CompanyCard />
      <AskHrCard />
    </aside>
  );
}
