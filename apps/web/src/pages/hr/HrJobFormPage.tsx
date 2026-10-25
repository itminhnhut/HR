import {
  EMPLOYMENT_TYPE_LABEL,
  type EmploymentType,
  type HrJobDto,
  type JobInput,
  type JobTemplateResponse,
} from '@careers/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../api';
import { useAddTemplateChoice, useHrJob, useJobTemplate, useSaveJob } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { Button } from '../../ui/Button';
import { Checkbox, SelectField, TextArea, TextField } from '../../ui/Field';
import { ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon, IconRing } from '../../ui/icons';
import { DeadlineField } from './job-form/DeadlineField';
import { PickOrAdd, RequirementPicks, SalaryInput, WorkingHoursField } from './job-form/fields';
import {
  emptyForm,
  fromJob,
  salaryPreview,
  salaryRangeProblem,
  toInput,
  type Errors,
  type FormState,
  type Mode,
} from './job-form/model';
import { PreviewDialog } from './job-form/PreviewDialog';
import { AddressField, BenefitsField, RoadmapField } from './job-form/TemplateFields';
import { useUnsavedGuard } from './job-form/useUnsavedGuard';
import { apiMessage } from './parts';

const DRAFT_SAVED = 'Đã lưu nháp. Tin chưa hiển thị với ứng viên.';
const PUBLISHED = 'Đã đăng tin. Tin đang hiển thị trên trang việc làm.';

// ── Small pieces ────────────────────────────────────────────────────────

function Section({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-[18px] rounded-card border border-line bg-white px-4 pb-6 pt-3 sm:px-[26px] sm:pb-[26px]">
      <legend className="px-2 font-serif text-xl font-medium">{legend}</legend>
      {children}
    </fieldset>
  );
}

function RemindNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-control border border-silver bg-tint px-4 py-3.5 text-sm leading-relaxed text-navy"
    >
      <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Preview({ form }: { form: FormState }) {
  return (
    <aside
      aria-label="Xem trước"
      className="sticky top-6 hidden w-[300px] shrink-0 flex-col gap-3 self-start lg:flex xl:w-[320px]"
    >
      <span className="inline-flex items-center gap-2 text-[13px] font-medium text-slate">
        <Icon name="eye" size={16} />
        Ứng viên sẽ thấy như sau
      </span>
      <div className="flex flex-col gap-4 rounded-card border border-line bg-white px-[26px] pb-[22px] pt-[26px]">
        <span className="inline-flex items-center gap-2 text-[13px] text-slate">
          <IconRing name="briefcase" size={14} className="p-[7px]" />
          {form.department.trim() || 'Phòng ban'}
        </span>
        <div className="flex flex-col gap-2">
          <span className="font-serif text-2xl font-medium [overflow-wrap:anywhere]">
            {form.title.trim() || 'Tên vị trí'}
          </span>
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold text-accent">
            <Icon name="money" size={18} stroke={1.7} />
            {salaryPreview(form)}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-[18px] gap-y-2 border-t border-line-soft pt-3.5 text-[13px] text-body">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="pin" size={15} />
            {form.address?.trim() || 'Văn phòng Gò Vấp'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" size={15} />
            {EMPLOYMENT_TYPE_LABEL[form.employmentType]}
          </span>
        </div>
        {form.benefits.length > 0 && (
          <span className="text-[13px] text-slate">{form.benefits.slice(0, 2).join(', ')}</span>
        )}
      </div>
    </aside>
  );
}

// ── The form ────────────────────────────────────────────────────────────

function JobForm({
  mode,
  initial,
  job,
  options,
  initialNotice,
}: {
  mode: Mode;
  initial: FormState;
  job?: HrJobDto;
  options: JobTemplateResponse;
  initialNotice?: string;
}) {
  const navigate = useNavigate();
  const editId = mode === 'edit' ? job?.id : undefined;
  const save = useSaveJob(editId);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(initialNotice ?? null);
  const formRef = useRef<HTMLFormElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedForm, setSavedForm] = useState(initial);
  const allowLeave = useUnsavedGuard(form !== savedForm && JSON.stringify(form) !== JSON.stringify(savedForm));
  /** A live or paused job: one button, state stays as it is. */
  const editsLiveJob = mode === 'edit' && !!job && job.status !== 'draft';
  const addToList = useAddTemplateChoice();
  /** "+ Thêm mới" in a dropdown also keeps the value in "Mẫu tin" for next time (appended on the server). */
  const addChoice = (list: 'departments' | 'experiences' | 'educations', value: string) =>
    addToList.mutate(
      { list, value },
      // The job still uses the value; only keeping it in the list failed.
      {
        onError: (e) =>
          setGeneral(
            `Đã chọn "${value}" cho tin này, nhưng chưa lưu được vào danh sách: ${apiMessage(e) ?? 'thử lại sau.'}`,
          ),
      },
    );
  const rangeProblem = form.negotiable ? null : salaryRangeProblem(form);

  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  const patch = (next: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...next }));
    setSaved(null);
    const keys = Object.keys(next);
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))));
  };
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => patch({ [key]: value } as Partial<FormState>);
  const text = (key: 'title' | 'responsibilities' | 'requirements') => ({
    value: form[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) => set(key, e.target.value),
  });

  const submit = (intent: JobInput['intent']) => {
    setErrors({});
    setGeneral(null);
    setSaved(null);
    save.mutate(toInput(form, intent), {
      onSuccess: (savedJob) => {
        setSavedForm(form);
        allowLeave();
        if (editsLiveJob) return setSaved('Đã lưu thay đổi.');
        if (intent === 'publish') return navigate('/hr/tin', { state: { notice: PUBLISHED } });
        if (mode !== 'edit')
          return navigate(`/hr/tin/${savedJob.id}`, { replace: true, state: { notice: DRAFT_SAVED } });
        setSaved(DRAFT_SAVED);
      },
      onError: (e) => {
        setErrors(e instanceof ApiError ? e.fieldErrors : {});
        setGeneral(apiMessage(e) ?? 'Chưa lưu được, thử lại sau ít phút.');
      },
    });
  };
  // Open/expiring jobs re-check the deadline (publish); paused/ended keep their state (draft).
  const liveIntent: JobInput['intent'] =
    job && (job.status === 'open' || job.status === 'expiring') ? 'publish' : 'draft';

  return (
    <div className="flex items-start gap-7">
      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => e.preventDefault()}
        className="flex min-w-0 flex-1 flex-col gap-5"
      >
        {/* At the top, where people are when they press save; the first wrong field also gets focus. */}
        {general && (
          <Notice tone="error" icon="alert">
            <span role="alert">{errors.form ?? general}</span>
          </Notice>
        )}
        {saved && (
          <Notice tone="ok" icon="check">
            <span role="status">{saved}</span>
          </Notice>
        )}
        <Section legend="Thông tin chính">
          <TextField
            label="Tên vị trí"
            placeholder="Dùng tên phổ biến, vd: Nhân viên Kinh doanh"
            maxLength={120}
            required
            {...text('title')}
            onBlur={() =>
              form.title.trim() &&
              form.title.trim().length < 3 &&
              setErrors((e) => ({ ...e, title: 'Tên vị trí cần ít nhất 3 ký tự.' }))
            }
          />
          <div className="grid items-start gap-3.5 sm:grid-cols-2">
            <PickOrAdd
              label="Phòng ban"
              options={options.departments}
              value={form.department}
              error={errors.department}
              onChange={(v) => set('department', v)}
              onAdd={(v) => addChoice('departments', v)}
            />
            <SelectField
              label="Hình thức"
              value={form.employmentType}
              onChange={(e) => set('employmentType', e.target.value as EmploymentType)}
            >
              {(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_TYPE_LABEL[t]}
                </option>
              ))}
            </SelectField>
            <PickOrAdd
              label="Kinh nghiệm"
              options={options.experiences}
              value={form.experience}
              error={errors.experience}
              onChange={(v) => set('experience', v)}
              onAdd={(v) => addChoice('experiences', v)}
            />
            <PickOrAdd
              label="Học vấn"
              options={options.educations}
              value={form.education}
              error={errors.education}
              onChange={(v) => set('education', v)}
              onAdd={(v) => addChoice('educations', v)}
            />
          </div>
          <WorkingHoursField form={form} error={errors.workingHours} onChange={patch} />
          <AddressField value={form.address} error={errors.address} onChange={(v) => set('address', v)} />
        </Section>

        <Section legend="Lương và hạn nộp">
          <div className="grid items-start gap-3.5 sm:grid-cols-2">
            <SalaryInput
              label="Lương từ"
              value={form.salaryMin}
              disabled={form.negotiable}
              error={errors.salaryMin}
              onChange={(v) => set('salaryMin', v)}
            />
            <SalaryInput
              label="Đến"
              value={form.salaryMax}
              disabled={form.negotiable}
              error={errors.salaryMax}
              rangeError={rangeProblem}
              onChange={(v) => set('salaryMax', v)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <Checkbox
              checked={form.negotiable}
              onChange={(e) =>
                patch(e.target.checked ? { negotiable: true, salaryMin: '', salaryMax: '' } : { negotiable: false })
              }
              className="min-h-10 items-center text-sm"
            >
              Không ghi lương, để "Thỏa thuận"
            </Checkbox>
            <span role="status" className="text-sm text-slate">
              Ứng viên sẽ thấy: <strong className="font-semibold text-accent">{salaryPreview(form)}</strong>
            </span>
          </div>
          {form.negotiable && (
            <RemindNote>
              Khảo sát 2026 cho thấy khoảng 44% ứng viên bỏ qua tin không ghi lương. Nên ghi một khoảng lương, kể cả
              khoảng rộng.
            </RemindNote>
          )}
          <DeadlineField value={form.deadline} error={errors.deadline} onChange={(v) => set('deadline', v)} />
        </Section>

        <Section legend="Nội dung tin">
          <p className="m-0 -mt-1 text-[13px] text-slate">
            Mỗi dòng một ý, trang ứng viên tự hiển thị thành gạch đầu dòng. Viết ngắn, 3–5 ý mỗi phần là đủ.
          </p>
          <TextArea
            label="Mô tả công việc"
            rows={5}
            maxLength={4000}
            placeholder="Tìm và tiếp cận khách hàng doanh nghiệp mới…"
            {...text('responsibilities')}
          />
          <TextArea
            label="Yêu cầu"
            rows={5}
            maxLength={4000}
            placeholder={'Từ 1 năm kinh nghiệm bán hàng…\nĐiểm cộng: đã dùng CRM'}
            {...text('requirements')}
          />
          <RequirementPicks
            options={options.template.requirementOptions}
            text={form.requirements}
            onChange={(v) => set('requirements', v)}
          />
          <p className="m-0 text-xs text-muted">
            Không ghi giới tính, độ tuổi, ngoại hình, tình trạng hôn nhân trừ khi công việc bắt buộc (Bộ luật Lao động
            2019).
          </p>
        </Section>

        <Section legend="Quyền lợi và lộ trình">
          <BenefitsField
            value={form.benefits}
            template={options.template}
            extraBenefits={options.extraBenefits}
            error={errors.benefits}
            onChange={(v) => set('benefits', v)}
          />
          <RoadmapField
            value={form.roadmap}
            template={options.template}
            error={errors.roadmap}
            onChange={(v) => set('roadmap', v)}
          />
        </Section>

        <div className="flex flex-wrap justify-end gap-2.5 max-sm:flex-col-reverse">
          <Button variant="ghost" icon="eye" onClick={() => setPreviewOpen(true)} className="sm:mr-auto">
            Xem trước
          </Button>
          {editsLiveJob ? (
            <Button icon="check" disabled={save.isPending} onClick={() => submit(liveIntent)} className="px-7">
              {save.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          ) : (
            <>
              <Button variant="outline" icon="file" disabled={save.isPending} onClick={() => submit('draft')}>
                Lưu nháp
              </Button>
              <Button
                icon="send"
                disabled={save.isPending}
                onClick={() => submit('publish')}
                className="px-7 font-medium"
              >
                {save.isPending && save.variables?.intent === 'publish' ? 'Đang đăng…' : 'Đăng tin'}
              </Button>
            </>
          )}
        </div>
      </form>
      <Preview form={form} />
      <PreviewDialog form={form} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}

function FormSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5 rounded-card border border-line bg-white p-[26px]">
      <Sk w={160} h={20} />
      <Sk w="100%" h={46} />
      <div className="grid gap-3.5 sm:grid-cols-3">
        <Sk w="100%" h={46} />
        <Sk w="100%" h={46} />
        <Sk w="100%" h={46} />
      </div>
      <Sk w="100%" h={46} />
      <Sk w="70%" h={46} />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

const HEADINGS: Record<Mode, string> = {
  new: 'Đăng tin tuyển dụng',
  edit: 'Sửa tin tuyển dụng',
};

export function HrJobFormPage() {
  const { id } = useParams();
  const location = useLocation();
  // "Nhân bản": a new job filled from an earlier one (?tu=<id>).
  const copyFrom = id ? undefined : (new URLSearchParams(location.search).get('tu') ?? undefined);
  const sourceId = id ?? copyFrom;
  const mode: Mode = id ? 'edit' : 'new';
  const source = useHrJob(sourceId);
  const options = useJobTemplate();
  const loading = (!!sourceId && source.isPending) || options.isPending;
  const showSkeleton = useDelayedFlag(loading);
  const notice = (location.state as { notice?: string } | null)?.notice;
  usePageMeta(HEADINGS[mode]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          to="/hr/tin"
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-slate no-underline hover:text-navy lg:min-h-9"
        >
          <Icon name="arrowLeft" size={16} />
          Danh sách tin
        </Link>
        <h1 className="m-0 font-serif text-[30px] font-medium sm:text-[36px]">{HEADINGS[mode]}</h1>
      </div>
      {copyFrom && source.data && (
        <Notice tone="mist" icon="copy">
          Tin mới, điền sẵn từ <strong className="font-semibold text-navy">{source.data.title}</strong>. Sửa những gì
          khác rồi đăng; tin cũ giữ nguyên.
        </Notice>
      )}
      {loading && (
        <>
          <LoadingStatus />
          {showSkeleton && <FormSkeleton />}
        </>
      )}
      {source.isError && <ErrorState onRetry={() => source.refetch()} message={apiMessage(source.error)} />}
      {options.isError && <ErrorState onRetry={() => options.refetch()} message={apiMessage(options.error)} />}
      {options.data && (!sourceId || source.data) && (
        <JobForm
          key={`${mode}:${sourceId ?? 'new'}`}
          mode={mode}
          job={mode === 'edit' ? source.data : undefined}
          options={options.data}
          initial={
            source.data
              ? copyFrom
                ? // A copy gets a fresh deadline; everything else is the earlier job's.
                  {
                    ...fromJob(source.data, options.data.template),
                    deadline: emptyForm(options.data.template).deadline,
                  }
                : fromJob(source.data, options.data.template)
              : emptyForm(options.data.template)
          }
          initialNotice={notice}
        />
      )}
    </>
  );
}

export default HrJobFormPage;
