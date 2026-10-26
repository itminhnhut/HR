import type { JobCardDto, JobDetailDto } from '@careers/shared';
import { DepartmentChip } from '../../site/JobCard';
import { PAGE_WIDTH, PageHero } from '../../site/PageHero';
import { ButtonLink } from '../../ui/Button';
import { Icon } from '../../ui/icons';
import { SimilarJobs } from './JobAside';
import { Bullets } from './JobSections';

/** BR-05: a closed job is never an error page. */
export function ClosedJob({ job, similar }: { job: JobDetailDto; similar: JobCardDto[] }) {
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Việc làm', to: '/' }, { label: job.title }]}
        eyebrow={<DepartmentChip department={job.department} className="normal-case tracking-normal" />}
        title={job.title}
        titleClassName="text-silver"
        overlap
      />
      <main className={`relative ${PAGE_WIDTH} flex flex-col gap-12 pb-20`}>
        <div
          role="status"
          className="-mt-12 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-card border border-l-[3px] border-line border-l-navy bg-white p-5 shadow-[0_8px_30px_rgba(11,31,58,0.06)] sm:-mt-14 sm:p-6"
        >
          <span className="flex shrink-0 rounded-full border border-silver p-2.5">
            <Icon name="clock" size={20} stroke={1.4} />
          </span>
          <div className="flex min-w-[min(100%,420px)] flex-1 flex-col gap-1">
            <h2 className="m-0 font-serif type-h2-sm font-medium">Vị trí này đã ngừng nhận hồ sơ</h2>
            <p className="m-0 text-[15px] leading-relaxed text-body">
              Cảm ơn bạn đã quan tâm. Bạn có thể xem các vị trí khác đang tuyển bên dưới.
            </p>
          </div>
          <ButtonLink to="/" variant="brand" icon="briefcase">
            Xem vị trí đang mở
          </ButtonLink>
        </div>

        <SimilarJobs jobs={similar} title="Vị trí tương tự đang tuyển" />

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
