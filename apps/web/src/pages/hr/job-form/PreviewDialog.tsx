import { EMPLOYMENT_TYPE_LABEL, formatDate, NO_REQUIREMENT, ROADMAP_MILESTONES, toLines } from '@careers/shared';
import type { ReactNode } from 'react';
import { SITE } from '../../../lib/site';
import { CloseButton, Dialog } from '../../../ui/Dialog';
import { Icon } from '../../../ui/icons';
import { salaryPreview, workingHoursText, type FormState } from './model';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="m-0 font-serif text-[22px] font-medium">{title}</h3>
      {children}
    </section>
  );
}

function Bullets({ text }: { text: string }) {
  const items = toLines(text);
  if (items.length === 0) return <p className="m-0 text-sm italic text-muted">Chưa nhập.</p>;
  return (
    <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-body marker:text-silver-soft">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/** What candidates will read, built from the unsaved form: works the same on phones. */
export function PreviewDialog({ form, open, onClose }: { form: FormState; open: boolean; onClose: () => void }) {
  const facts: [string, string | null][] = [
    ['Mức lương', salaryPreview(form)],
    ['Hình thức', EMPLOYMENT_TYPE_LABEL[form.employmentType]],
    ['Kinh nghiệm', form.experience || null],
    ['Học vấn', form.education && form.education !== NO_REQUIREMENT ? form.education : null],
    ['Hạn nộp', form.deadline ? formatDate(form.deadline) : null],
    ['Giờ làm', workingHoursText(form)],
    ['Nơi làm việc', form.address?.trim() || SITE.officeAddress],
  ];
  const roadmap = ROADMAP_MILESTONES.map((when, i) => [when, form.roadmap[i] ?? ''] as const).filter(([, t]) =>
    t.trim(),
  );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      label="Xem trước tin"
      variant="panel"
      className="sm:!w-[min(760px,calc(100vw-48px))]"
    >
      <div className="flex max-h-[92dvh] flex-col overflow-y-auto">
        <div className="sticky top-0 flex items-start justify-between gap-4 bg-navy px-6 py-5 text-white">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-silver-soft">{form.department || 'Phòng ban'} · Xem trước</span>
            <h2 className="m-0 font-serif text-[28px] font-medium">{form.title.trim() || 'Tên vị trí'}</h2>
            <span className="inline-flex items-center gap-2 font-semibold">
              <Icon name="money" size={18} />
              {salaryPreview(form)}
            </span>
          </div>
          <CloseButton onClick={onClose} className="border-0 bg-white/10 text-white" />
        </div>
        <div className="flex flex-col gap-7 px-6 py-6">
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 rounded-card border border-line p-4 text-sm sm:grid-cols-3">
            {facts
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="m-0 font-medium">{value}</dd>
                </div>
              ))}
          </dl>
          <Block title="Mô tả công việc">
            <Bullets text={form.responsibilities} />
          </Block>
          <Block title="Yêu cầu">
            <Bullets text={form.requirements} />
          </Block>
          {form.preferred.trim() && (
            <Block title="Ưu tiên (không bắt buộc)">
              <Bullets text={form.preferred} />
            </Block>
          )}
          {form.benefits.length > 0 && (
            <Block title="Quyền lợi">
              <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                {form.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[15px] text-body">
                    <Icon name="check" size={16} stroke={2} className="mt-1 shrink-0 text-ok" />
                    {b}
                  </li>
                ))}
              </ul>
            </Block>
          )}
          {roadmap.length > 0 && (
            <Block title="Lộ trình 2 tháng thử việc">
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {roadmap.map(([when, text]) => (
                  <li key={when} className="text-[15px] leading-relaxed text-body">
                    <strong className="font-semibold text-navy">{when}:</strong> {text}
                  </li>
                ))}
              </ol>
            </Block>
          )}
        </div>
      </div>
    </Dialog>
  );
}
