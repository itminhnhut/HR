import { ARTICLE_CTA_MAX } from '@careers/shared';
import { useState } from 'react';
import { useJobs } from '../../../../api/queries';
import { FieldError, SelectField, TextField } from '../../../../ui/Field';
import type { CtaPayload } from './CtaNode';
import { DialogButtons, DialogHead } from './EmbedDialogs';
import { ctaUrl, jobSlugFromUrl } from './embeds';

type Target = 'job' | 'link';

function TargetChoice({ value, onChange }: { value: Target; onChange: (t: Target) => void }) {
  const options: [Target, string][] = [
    ['job', 'Vị trí đang tuyển'],
    ['link', 'Link khác'],
  ];
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-sm font-medium text-navy">Nút dẫn tới</legend>
      <div className="flex flex-wrap gap-4">
        {options.map(([key, label]) => (
          <label key={key} className="inline-flex min-h-10 items-center gap-2 text-[15px] text-navy">
            <input
              type="radio"
              name="cta-target"
              checked={value === key}
              onChange={() => onChange(key)}
              className="size-[18px] accent-accent"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "" = all open jobs (the jobs board, "/"). */
function JobPicker({ value, onChange }: { value: string; onChange: (slug: string, title: string) => void }) {
  const jobs = useJobs();
  const list = jobs.data?.jobs ?? [];
  return (
    <SelectField
      label="Vị trí"
      value={value}
      onChange={(e) => onChange(e.target.value, list.find((job) => job.slug === e.target.value)?.title ?? '')}
    >
      <option value="">{jobs.isPending ? 'Đang tải…' : ALL_JOBS_OPTION}</option>
      {list.map((job) => (
        <option key={job.slug} value={job.slug}>
          {job.title}
        </option>
      ))}
    </SelectField>
  );
}

const ALL_JOBS_OPTION = 'Tất cả vị trí đang tuyển';
/** The default button: the jobs board, which never goes stale when one job closes. */
const ALL_JOBS_TEXT = 'Xem vị trí đang tuyển';
const ALL_JOBS_URL = '/';

/** "Ứng tuyển: Nhân viên Kinh doanh B2B", cut to the button's limit. */
const jobText = (title: string) => `Ứng tuyển: ${title}`.slice(0, ARTICLE_CTA_MAX).trim();

/** The form's state, from the button being edited (a job link preselects that job, "/" all jobs). */
function useCtaState(initial: CtaPayload | null) {
  const startSlug = initial ? (initial.url === ALL_JOBS_URL ? '' : jobSlugFromUrl(initial.url)) : '';
  const [text, setText] = useState(initial?.text ?? ALL_JOBS_TEXT);
  // Words HR typed stay; the suggested ones follow the job picked.
  const [textTyped, setTextTyped] = useState(!!initial);
  const [target, setTarget] = useState<Target>(startSlug === null ? 'link' : 'job');
  const [jobSlug, setJobSlug] = useState(startSlug ?? '');
  const [link, setLink] = useState(initial && startSlug === null ? initial.url : '');
  const [error, setError] = useState<string | undefined>();
  const pickJob = (slug: string, title: string) => {
    setJobSlug(slug);
    if (!textTyped) setText(slug ? jobText(title) : ALL_JOBS_TEXT);
  };
  const typeText = (value: string) => {
    setText(value);
    setTextTyped(true);
  };
  /** The button to save, or null after showing what is missing. */
  const result = (): CtaPayload | null => {
    const url = target === 'job' && !jobSlug ? ALL_JOBS_URL : ctaUrl(target === 'job' ? { jobSlug } : { link });
    if (!text.trim()) setError('Nhập chữ trên nút.');
    else if (!url) setError('Link chưa đúng, ví dụ https://topflow.vn');
    return text.trim() && url ? { text: text.trim(), url } : null;
  };
  return { text, typeText, target, setTarget, jobSlug, pickJob, link, setLink, error, result };
}

/**
 * "Nút kêu gọi": the words on the button (≤ 60) and where it goes: all open jobs (default), one open job,
 * or any safe link.
 */
export function CtaForm({
  initial,
  onSubmit,
  onClose,
}: {
  initial: CtaPayload | null;
  onSubmit: (cta: CtaPayload) => void;
  onClose: () => void;
}) {
  const cta = useCtaState(initial);
  return (
    <form
      className="flex flex-col gap-4 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const done = cta.result();
        if (done) onSubmit(done);
      }}
    >
      <DialogHead title={initial ? 'Sửa nút' : 'Chèn nút kêu gọi'} onClose={onClose} />
      <TextField
        label="Chữ trên nút"
        autoFocus
        value={cta.text}
        maxLength={ARTICLE_CTA_MAX}
        onChange={(e) => cta.typeText(e.target.value)}
        hint={`${cta.text.length}/${ARTICLE_CTA_MAX} ký tự`}
      />
      <TargetChoice value={cta.target} onChange={cta.setTarget} />
      {cta.target === 'job' ? (
        <JobPicker value={cta.jobSlug} onChange={cta.pickJob} />
      ) : (
        <TextField
          label="Link"
          inputMode="url"
          value={cta.link}
          onChange={(e) => cta.setLink(e.target.value)}
          placeholder="https://… hoặc /viec-lam/…"
        />
      )}
      <FieldError>{cta.error}</FieldError>
      <DialogButtons submit={initial ? 'Lưu nút' : 'Chèn nút'} onClose={onClose} />
    </form>
  );
}
