import { BENEFIT_MAX, ROADMAP_ITEM_MAX, ROADMAP_MILESTONES, type JobTemplate } from '@careers/shared';
import { useState } from 'react';
import { ApiError } from '../../api';
import { useJobTemplate, useSaveJobTemplate } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { Button } from '../../ui/Button';
import { Checkbox, TextField } from '../../ui/Field';
import { ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon } from '../../ui/icons';
import { WorkingHoursField } from './job-form/fields';
import { emptyForm, type FormState } from './job-form/model';
import { apiMessage, errorMessage, PageHeading } from './parts';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-white px-4 py-5 sm:px-[26px] sm:py-6">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-serif text-xl font-medium">{title}</h2>
        {hint && <p className="m-0 text-[13px] text-slate">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function TemplateForm({ initial }: { initial: JobTemplate }) {
  const save = useSaveJobTemplate();
  const [template, setTemplate] = useState(initial);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  // The hours picker works on the job form's shape; only the three hour fields matter here.
  const hours: FormState = {
    ...emptyForm(template),
    workDays: template.workDays,
    startTime: template.startTime,
    endTime: template.endTime,
  };
  const patch = (next: Partial<JobTemplate>) => {
    setTemplate((t) => ({ ...t, ...next }));
    setNotice(null);
  };

  const addBenefit = () => {
    const label = draft.trim().slice(0, BENEFIT_MAX);
    if (!label || template.benefits.some((b) => b.label.toLowerCase() === label.toLowerCase())) return;
    patch({ benefits: [...template.benefits, { label, standard: true }] });
    setDraft('');
  };

  const submit = () =>
    save.mutate(template, {
      onSuccess: () => setNotice({ ok: true, text: 'Đã lưu mẫu tin. Các tin tạo từ giờ sẽ dùng mẫu này.' }),
      onError: (e) =>
        setNotice({
          ok: false,
          text: e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : errorMessage(e),
        }),
    });

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="flex max-w-[860px] flex-col gap-5">
      {notice && (
        <Notice tone={notice.ok ? 'ok' : 'error'} icon={notice.ok ? 'check' : 'alert'}>
          <span role={notice.ok ? 'status' : 'alert'}>{notice.text}</span>
        </Notice>
      )}
      <Section title="Giờ làm mặc định">
        <WorkingHoursField
          form={hours}
          allowOther={false}
          onChange={(next) =>
            patch({
              ...(next.workDays !== undefined ? { workDays: next.workDays } : {}),
              ...(next.startTime !== undefined ? { startTime: next.startTime } : {}),
              ...(next.endTime !== undefined ? { endTime: next.endTime } : {}),
            })
          }
        />
      </Section>

      <Section
        title="Quyền lợi"
        hint="Mục có dấu tích được chọn sẵn ở tin mới. Mục không tích vẫn hiện để HR chọn khi cần."
      >
        <ul className="m-0 flex list-none flex-col p-0">
          {template.benefits.map((b, i) => (
            <li
              key={b.label}
              className="flex items-center justify-between gap-3 border-b border-line-soft last:border-b-0"
            >
              <Checkbox
                checked={b.standard}
                onChange={(e) =>
                  patch({
                    benefits: template.benefits.map((x, j) => (j === i ? { ...x, standard: e.target.checked } : x)),
                  })
                }
                className="min-h-11 flex-1 items-center text-[15px] text-navy"
              >
                {b.label}
              </Checkbox>
              <button
                type="button"
                aria-label={`Bỏ ${b.label} khỏi danh sách`}
                onClick={() => patch({ benefits: template.benefits.filter((_, j) => j !== i) })}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-slate hover:bg-tint hover:text-error"
              >
                <Icon name="x" size={16} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2.5">
          <TextField
            label="Thêm quyền lợi"
            placeholder="vd: Cấp laptop làm việc"
            maxLength={BENEFIT_MAX}
            value={draft}
            className="min-w-[min(100%,280px)] flex-1"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addBenefit();
              }
            }}
          />
          <Button variant="outline" icon="plus" disabled={!draft.trim()} onClick={addBenefit} className="min-h-[52px]">
            Thêm
          </Button>
        </div>
      </Section>

      <Section title="Lộ trình 2 tháng thử việc" hint="Nội dung điền sẵn cho từng mốc ở tin mới.">
        {ROADMAP_MILESTONES.map((when, i) => (
          <TextField
            key={when}
            label={when}
            maxLength={ROADMAP_ITEM_MAX}
            value={template.roadmap[i] ?? ''}
            onChange={(e) => patch({ roadmap: template.roadmap.map((t, j) => (j === i ? e.target.value : t)) })}
          />
        ))}
      </Section>

      <div className="flex justify-end">
        <Button icon="check" disabled={save.isPending} onClick={submit} className="px-7">
          {save.isPending ? 'Đang lưu…' : 'Lưu mẫu tin'}
        </Button>
      </div>
    </form>
  );
}

export function HrTemplatePage() {
  usePageMeta('Mẫu tin');
  const query = useJobTemplate();
  const showSkeleton = useDelayedFlag(query.isPending);
  return (
    <>
      <PageHeading
        title="Mẫu tin"
        titleHiddenOnPhone
        subtitle="Giá trị điền sẵn khi đăng tin mới. Sửa ở đây áp dụng cho các tin tạo sau, tin cũ giữ nguyên."
      />
      {query.isPending && (
        <>
          <LoadingStatus />
          {showSkeleton && <Sk w="100%" h={320} />}
        </>
      )}
      {query.isError && <ErrorState onRetry={() => query.refetch()} message={apiMessage(query.error)} />}
      {query.data && <TemplateForm initial={query.data.template} />}
    </>
  );
}

export default HrTemplatePage;
