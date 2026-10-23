import {
  addDays,
  DEPARTMENTS,
  EMPLOYMENT_TYPE_LABEL,
  findBiasTerm,
  formatSalary,
  hasSalary,
  locationLabel,
  MAX_OPEN_DAYS,
  todayInVietnam,
  type Department,
  type EmploymentType,
  type HrJobDto,
  type JobInput,
} from '@careers/shared';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../api';
import { useHrJob, useSaveJob } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { Button } from '../../ui/Button';
import { Checkbox, FieldError, SelectField, TextArea, TextField } from '../../ui/Field';
import { ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon, IconRing, type IconName } from '../../ui/icons';
import { apiMessage } from './parts';

// ── Form model ──────────────────────────────────────────────────────────

const EXPERIENCE = ['Không yêu cầu', 'Từ 1 năm', 'Từ 2 năm', 'Từ 3 năm'];
const LEVEL = ['Thực tập sinh', 'Nhân viên', 'Trưởng nhóm', 'Quản lý'];
const EDUCATION = ['Không yêu cầu', 'Trung cấp', 'Cao đẳng trở lên', 'Đại học trở lên'];
const LANGUAGE = ['Không bắt buộc', 'Tiếng Anh giao tiếp', 'Tiếng Anh thành thạo'];
const MAX_SKILLS = 6;

const DRAFT_SAVED = 'Đã lưu nháp. Tin chưa hiển thị với ứng viên.';
const PUBLISHED = 'Đã đăng tin. Tin đang hiển thị trên trang việc làm.';

/** Company-wide benefits HR starts from on a new job ("Điền sẵn quyền lợi chung"). */
const COMPANY_BENEFITS = {
  benefitIncome: 'Lương tháng 13, thưởng Tết theo kết quả',
  benefitInsurance: 'BHXH, BHYT, BHTN đóng trên lương thực nhận\nKhám sức khỏe định kỳ mỗi năm',
  benefitTimeOff: '12 ngày phép năm, tăng theo thâm niên\nNghỉ thứ 7 và chủ nhật',
  benefitGrowth: '',
  benefitEnvironment: 'Du lịch công ty hằng năm, team building mỗi quý\nCấp laptop và điện thoại công việc',
};
type BenefitKey = keyof typeof COMPANY_BENEFITS;

interface FormState {
  title: string;
  department: Department;
  employmentType: EmploymentType;
  remote: boolean;
  city: string;
  address: string;
  workingHours: string;
  level: string;
  experience: string;
  education: string;
  language: string;
  headcount: string;
  skills: string[];
  teamNote: string;
  salaryMin: string;
  salaryMax: string;
  salaryNote: string;
  negotiable: boolean;
  deadline: string;
  summary: string;
  responsibilities: string;
  requirements: string;
  niceToHave: string;
  benefitIncome: string;
  benefitInsurance: string;
  benefitTimeOff: string;
  benefitGrowth: string;
  benefitEnvironment: string;
  plan30: string;
  plan60: string;
  plan90: string;
}

type Mode = 'new' | 'edit' | 'repost';
type Errors = Partial<Record<keyof JobInput | 'form', string>>;

const EMPTY: FormState = {
  title: '',
  department: DEPARTMENTS[0],
  employmentType: 'full_time',
  remote: false,
  city: 'TP. HCM',
  address: '',
  workingHours: '',
  level: 'Nhân viên',
  experience: EXPERIENCE[0],
  education: EDUCATION[0],
  language: LANGUAGE[0],
  headcount: '1',
  skills: [],
  teamNote: '',
  salaryMin: '',
  salaryMax: '',
  salaryNote: '',
  negotiable: false,
  deadline: '',
  summary: '',
  responsibilities: '',
  requirements: '',
  niceToHave: '',
  ...COMPANY_BENEFITS,
  plan30: '',
  plan60: '',
  plan90: '',
};

const str = (v: string | number | null | undefined) => (v == null ? '' : String(v));
const isDepartment = (v: string): v is Department => (DEPARTMENTS as readonly string[]).includes(v);

function fromJob(job: HrJobDto, mode: Mode): FormState {
  return {
    title: job.title,
    department: isDepartment(job.department) ? job.department : DEPARTMENTS[0],
    employmentType: job.employmentType,
    remote: job.remote,
    city: job.city,
    address: str(job.address),
    workingHours: str(job.workingHours),
    level: str(job.level),
    experience: str(job.experience),
    education: str(job.education),
    language: str(job.language),
    headcount: str(job.headcount),
    skills: job.skills,
    teamNote: str(job.teamNote),
    salaryMin: str(job.salaryMin),
    salaryMax: str(job.salaryMax),
    salaryNote: str(job.salaryNote),
    negotiable: !hasSalary(job),
    // BR-04: a repost is a new round, so HR picks a fresh deadline.
    deadline: mode === 'repost' ? '' : job.deadline,
    summary: str(job.summary),
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    niceToHave: job.niceToHave,
    benefitIncome: job.benefitIncome,
    benefitInsurance: job.benefitInsurance,
    benefitTimeOff: job.benefitTimeOff,
    benefitGrowth: job.benefitGrowth,
    benefitEnvironment: job.benefitEnvironment,
    plan30: str(job.plan30),
    plan60: str(job.plan60),
    plan90: str(job.plan90),
  };
}

const toNumber = (v: string) => (v.trim() === '' ? null : Number(v));

function toInput(f: FormState, intent: JobInput['intent']): JobInput {
  const { negotiable, headcount, salaryMin, salaryMax, salaryNote, ...rest } = f;
  return {
    ...rest,
    headcount: toNumber(headcount),
    salaryMin: negotiable ? null : toNumber(salaryMin),
    salaryMax: negotiable ? null : toNumber(salaryMax),
    salaryNote: negotiable ? null : salaryNote || null,
    intent,
  };
}

/** BR-15: every free-text field, so the warning sees what candidates will read. */
function biasText(f: FormState): string {
  return [
    f.title,
    f.teamNote,
    f.summary,
    f.responsibilities,
    f.requirements,
    f.niceToHave,
    f.benefitIncome,
    f.benefitInsurance,
    f.benefitTimeOff,
    f.benefitGrowth,
    f.benefitEnvironment,
    f.plan30,
    f.plan60,
    f.plan90,
    ...f.skills,
  ].join('\n');
}

function previewSalary(f: FormState): string {
  if (f.negotiable) return 'Thỏa thuận';
  const job = { salaryMin: toNumber(f.salaryMin), salaryMax: toNumber(f.salaryMax), salaryNote: f.salaryNote || null };
  return hasSalary(job) ? formatSalary(job) : 'Chưa nhập lương';
}

const withCurrent = (options: string[], value: string) =>
  value && !options.includes(value) ? [value, ...options] : options;

// ── Small pieces ────────────────────────────────────────────────────────

function Section({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-[18px] rounded-card border border-line bg-white px-4 pb-6 pt-3 sm:px-[26px] sm:pb-[26px]">
      <legend className="px-2 font-serif text-xl font-medium">{legend}</legend>
      {children}
    </fieldset>
  );
}

function RemindNote({ role, children }: { role: 'note' | 'alert'; children: ReactNode }) {
  return (
    <div
      role={role}
      className="flex items-start gap-3 rounded-control border border-silver bg-tint px-4 py-3.5 text-sm leading-relaxed text-navy"
    >
      <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function OptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <SelectField label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {withCurrent(options, value).map((o) => (
        <option key={o}>{o}</option>
      ))}
    </SelectField>
  );
}

function SkillsInput({
  skills,
  onChange,
  error,
}: {
  skills: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  const [draft, setDraft] = useState('');
  const full = skills.length >= MAX_SKILLS;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && draft === '' && skills.length > 0) {
      onChange(skills.slice(0, -1));
      return;
    }
    // Telex/VNI composition also fires Enter; wait until the word is finished.
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const value = draft.trim().slice(0, 40);
    if (!value || full) return;
    if (!skills.some((s) => s.toLowerCase() === value.toLowerCase())) onChange([...skills, value]);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="skill-input" className="text-sm font-medium text-navy">
        Kỹ năng chính{' '}
        <span className="font-normal text-muted">(hiện thành tag dưới tên vị trí, tối đa {MAX_SKILLS})</span>
      </label>
      <div
        className={`field-focus flex min-h-[52px] flex-wrap items-center gap-1.5 rounded-control border bg-white px-2.5 py-1.5 ${error ? 'border-error' : 'border-field'}`}
      >
        {skills.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-tint py-1 pl-3 pr-1 text-[13px]">
            {s}
            <button
              type="button"
              onClick={() => onChange(skills.filter((x) => x !== s))}
              aria-label={`Bỏ kỹ năng ${s}`}
              className="flex size-7 items-center justify-center rounded-full border-0 bg-transparent text-slate hover:bg-white"
            >
              <Icon name="x" size={13} stroke={1.8} />
            </button>
          </span>
        ))}
        <input
          id="skill-input"
          type="text"
          value={draft}
          disabled={full}
          maxLength={40}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={full ? `Đã đủ ${MAX_SKILLS} kỹ năng` : 'Gõ rồi nhấn Enter'}
          className="min-h-9 min-w-0 flex-[1_1_140px] border-0 bg-transparent text-sm text-navy outline-none placeholder:text-muted"
        />
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

const PLAN_STEPS: { key: 'plan30' | 'plan60' | 'plan90'; day: string; placeholder: string; dot: string }[] = [
  { key: 'plan30', day: '30', placeholder: 'Làm quen: học sản phẩm, quy trình…', dot: 'bg-navy text-white' },
  { key: 'plan60', day: '60', placeholder: 'Tự chủ: quản lý khách hàng riêng…', dot: 'bg-accent text-white' },
  {
    key: 'plan90',
    day: '90',
    placeholder: 'Về đích: đạt chỉ tiêu đầu tiên…',
    dot: 'border border-silver bg-tint text-navy',
  },
];

const BENEFITS: { key: BenefitKey; label: string; icon: IconName; wide?: boolean }[] = [
  { key: 'benefitIncome', label: 'Thu nhập', icon: 'money' },
  { key: 'benefitInsurance', label: 'Bảo hiểm và sức khỏe', icon: 'shield' },
  { key: 'benefitTimeOff', label: 'Thời gian nghỉ', icon: 'calendar' },
  { key: 'benefitGrowth', label: 'Phát triển', icon: 'trend' },
  { key: 'benefitEnvironment', label: 'Môi trường và hoạt động', icon: 'mountain', wide: true },
];

function Preview({ form }: { form: FormState }) {
  const place = form.city.trim() ? locationLabel({ city: form.city.trim(), remote: form.remote }) : 'Địa điểm';
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
          {form.department}
        </span>
        <div className="flex flex-col gap-2">
          <span className="font-serif text-2xl font-medium [overflow-wrap:anywhere]">
            {form.title.trim() || 'Tên vị trí'}
          </span>
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold text-accent">
            <Icon name="money" size={18} stroke={1.7} />
            {previewSalary(form)}
          </span>
        </div>
        {form.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.skills.map((s) => (
              <span key={s} className="rounded-full bg-tint px-2.5 py-0.5 text-xs text-body">
                {s}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-x-[18px] gap-y-2 border-t border-line-soft pt-3.5 text-[13px] text-body">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="pin" size={15} />
            {place}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" size={15} />
            {EMPLOYMENT_TYPE_LABEL[form.employmentType]}
          </span>
        </div>
      </div>
    </aside>
  );
}

// ── The form ────────────────────────────────────────────────────────────

function JobForm({
  mode,
  initial,
  job,
  initialNotice,
}: {
  mode: Mode;
  initial: FormState;
  job?: HrJobDto;
  initialNotice?: string;
}) {
  const navigate = useNavigate();
  const editId = mode === 'edit' ? job?.id : undefined;
  const save = useSaveJob(editId);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(initialNotice ?? null);
  const [prefill, setPrefill] = useState(mode === 'new');
  const formRef = useRef<HTMLFormElement>(null);

  const today = todayInVietnam();
  const minDeadline = addDays(today, 1);
  const maxDeadline = addDays(today, MAX_OPEN_DAYS);
  const bias = findBiasTerm(biasText(form));
  /** A live or paused job: one button, state stays as it is. */
  const editsLiveJob = mode === 'edit' && !!job && job.status !== 'draft';

  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(null);
    if (key in errors) setErrors(({ [key as keyof Errors]: _gone, ...rest }) => rest);
  };
  const text = (key: { [K in keyof FormState]: FormState[K] extends string ? K : never }[keyof FormState]) => ({
    value: form[key],
    error: errors[key as keyof Errors],
    onChange: (e: { target: { value: string } }) => set(key, e.target.value),
  });

  const togglePrefill = (on: boolean) => {
    setPrefill(on);
    setForm((f) => {
      const next = { ...f };
      for (const key of Object.keys(COMPANY_BENEFITS) as BenefitKey[]) {
        if (on && !next[key].trim()) next[key] = COMPANY_BENEFITS[key];
        if (!on && next[key] === COMPANY_BENEFITS[key]) next[key] = '';
      }
      return next;
    });
  };

  const submit = (intent: JobInput['intent']) => {
    setErrors({});
    setGeneral(null);
    setSaved(null);
    save.mutate(toInput(form, intent), {
      onSuccess: (savedJob) => {
        if (editsLiveJob) return setSaved('Đã lưu thay đổi.');
        if (intent === 'publish') return navigate('/hr', { state: { notice: PUBLISHED } });
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
        <Section legend="Thông tin chính">
          <TextField
            label="Tên vị trí"
            placeholder="Dùng tên phổ biến, vd: Nhân viên Kinh doanh"
            maxLength={120}
            required
            {...text('title')}
          />
          <div className="grid gap-3.5 sm:grid-cols-3">
            <SelectField
              label="Phòng ban"
              value={form.department}
              onChange={(e) => isDepartment(e.target.value) && set('department', e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </SelectField>
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
            <OptionSelect
              label="Kinh nghiệm"
              value={form.experience}
              options={EXPERIENCE}
              onChange={(v) => set('experience', v)}
            />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 2xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
            <TextField label="Thành phố" maxLength={60} {...text('city')} />
            <TextField
              label="Địa chỉ làm việc cụ thể"
              placeholder="Số nhà, đường, quận"
              maxLength={200}
              {...text('address')}
            />
            <TextField
              label="Giờ làm"
              placeholder="T2 – T6, 8:30 – 17:30"
              maxLength={100}
              className="sm:col-span-2 2xl:col-span-1"
              {...text('workingHours')}
            />
          </div>
          <Checkbox
            checked={form.remote}
            onChange={(e) => set('remote', e.target.checked)}
            className="min-h-10 items-center text-sm"
          >
            Cho phép làm từ xa
          </Checkbox>
          <div className="grid grid-cols-2 gap-3.5 2xl:grid-cols-4">
            <OptionSelect label="Cấp bậc" value={form.level} options={LEVEL} onChange={(v) => set('level', v)} />
            <OptionSelect
              label="Học vấn"
              value={form.education}
              options={EDUCATION}
              onChange={(v) => set('education', v)}
            />
            <OptionSelect
              label="Ngoại ngữ"
              value={form.language}
              options={LANGUAGE}
              onChange={(v) => set('language', v)}
            />
            <TextField
              label="Số lượng"
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              step={1}
              {...text('headcount')}
            />
          </div>
          <SkillsInput skills={form.skills} onChange={(next) => set('skills', next)} error={errors.skills} />
          <TextField
            label="Làm việc cùng"
            optional
            placeholder="Đội Kinh doanh 6 người, báo cáo cho Trưởng phòng Kinh doanh"
            maxLength={200}
            {...text('teamNote')}
          />
        </Section>

        <Section legend="Lương và hạn nộp">
          <div className="grid items-start gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <TextField
              label="Lương từ (triệu)"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              disabled={form.negotiable}
              {...text('salaryMin')}
            />
            <TextField
              label="Đến (triệu)"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              disabled={form.negotiable}
              {...text('salaryMax')}
            />
            <TextField
              label="Cộng thêm"
              optional
              placeholder="vd: hoa hồng"
              maxLength={60}
              disabled={form.negotiable}
              {...text('salaryNote')}
            />
            <TextField
              label="Hạn nộp"
              optional={`tối đa ${MAX_OPEN_DAYS} ngày`}
              type="date"
              required
              min={minDeadline}
              max={maxDeadline}
              {...text('deadline')}
            />
          </div>
          <Checkbox
            checked={form.negotiable}
            onChange={(e) => {
              const on = e.target.checked;
              set('negotiable', on);
              if (on) setForm((f) => ({ ...f, salaryMin: '', salaryMax: '', salaryNote: '' }));
            }}
            className="min-h-10 items-center text-sm"
          >
            Không ghi lương, để "Thỏa thuận"
          </Checkbox>
          {form.negotiable && (
            <RemindNote role="note">
              Khảo sát 2026 cho thấy khoảng 44% ứng viên bỏ qua tin không ghi lương. Nên ghi một khoảng lương, kể cả
              khoảng rộng. Tin không ghi lương sẽ không gửi mức lương lên Google.
            </RemindNote>
          )}
        </Section>

        <Section legend="Nội dung tin">
          <p className="m-0 -mt-1 text-[13px] text-slate">
            Mỗi dòng một ý, trang ứng viên tự hiển thị thành gạch đầu dòng. Viết ngắn, 3–5 ý mỗi phần là đủ.
          </p>
          <TextArea
            label="Về vị trí này"
            optional="2–3 câu, viết như đang nói với ứng viên"
            rows={3}
            maxLength={600}
            placeholder="Bạn phụ trách mảng khách hàng doanh nghiệp vừa và nhỏ…"
            {...text('summary')}
          />
          <TextArea
            label="Bạn sẽ làm gì"
            rows={4}
            maxLength={4000}
            placeholder="Tìm và tiếp cận khách hàng doanh nghiệp mới…"
            {...text('responsibilities')}
          />
          <div className="grid gap-3.5 md:grid-cols-2">
            <TextArea
              label="Yêu cầu bắt buộc"
              rows={4}
              maxLength={4000}
              placeholder="Từ 1 năm kinh nghiệm bán hàng…"
              {...text('requirements')}
            />
            <TextArea
              label="Điểm cộng"
              optional="không có vẫn nộp được"
              rows={4}
              maxLength={4000}
              placeholder="Đã dùng CRM, có sẵn mạng lưới khách…"
              {...text('niceToHave')}
            />
          </div>
          {bias && (
            <RemindNote role="alert">
              Tin có chữ "<strong className="font-semibold">{bias}</strong>". Yêu cầu về giới tính, tuổi, ngoại hình,
              hôn nhân có thể bị xem là phân biệt đối xử (Bộ luật Lao động 2019). Nên ghi theo năng lực, vd "chịu được
              việc đi lại nhiều".
            </RemindNote>
          )}
          <p className="m-0 text-xs text-muted">
            Không ghi giới tính, độ tuổi, ngoại hình, tình trạng hôn nhân trừ khi công việc bắt buộc.
          </p>
        </Section>

        <Section legend="Quyền lợi">
          {mode === 'new' && (
            <Checkbox
              checked={prefill}
              onChange={(e) => togglePrefill(e.target.checked)}
              className="min-h-10 items-center text-sm"
            >
              Điền sẵn quyền lợi chung của công ty, rồi sửa riêng cho vị trí này
            </Checkbox>
          )}
          <div className="grid gap-3.5 md:grid-cols-2">
            {BENEFITS.map((b) => (
              <TextArea
                key={b.key}
                label={
                  <span className="inline-flex items-center gap-2">
                    <Icon name={b.icon} size={16} stroke={1.5} className="text-accent" />
                    {b.label}
                  </span>
                }
                rows={b.wide ? 2 : 3}
                maxLength={2000}
                className={b.wide ? 'md:col-span-2' : ''}
                {...text(b.key)}
              />
            ))}
          </div>
        </Section>

        <Section legend="Lộ trình">
          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-medium">
              90 ngày đầu <span className="font-normal text-muted">(không bắt buộc, nhưng ứng viên rất thích)</span>
            </span>
            <div className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2.5 sm:grid-cols-[52px_minmax(0,1fr)]">
              {PLAN_STEPS.map((p) => (
                <PlanRow
                  key={p.key}
                  day={p.day}
                  dot={p.dot}
                  placeholder={p.placeholder}
                  error={errors[p.key]}
                  value={form[p.key]}
                  onChange={(v) => set(p.key, v)}
                />
              ))}
            </div>
          </div>
        </Section>

        <div className="flex flex-wrap justify-end gap-2.5 max-sm:flex-col-reverse">
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
      </form>
      <Preview form={form} />
    </div>
  );
}

function PlanRow({
  day,
  dot,
  placeholder,
  value,
  error,
  onChange,
}: {
  day: string;
  dot: string;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={`mt-1 flex size-10 items-center justify-center rounded-full text-xs font-semibold ${dot}`}
      >
        {day}
      </span>
      <div className="flex flex-col gap-1">
        <input
          type="text"
          aria-label={`Mục tiêu ${day} ngày`}
          aria-invalid={error ? true : undefined}
          value={value}
          maxLength={300}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`field-focus min-h-12 rounded-control border bg-white px-4 text-[15px] text-navy outline-none placeholder:text-muted ${error ? 'border-error' : 'border-field'}`}
        />
        <FieldError>{error}</FieldError>
      </div>
    </>
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
  repost: 'Đăng lại tin tuyển dụng',
};

export function HrJobFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const repostFrom = id ? undefined : (params.get('tu') ?? undefined);
  const sourceId = id ?? repostFrom;
  const mode: Mode = id ? 'edit' : repostFrom ? 'repost' : 'new';
  const source = useHrJob(sourceId);
  const showSkeleton = useDelayedFlag(!!sourceId && source.isPending);
  const notice = (location.state as { notice?: string } | null)?.notice;
  usePageMeta(HEADINGS[mode]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          to="/hr"
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-slate no-underline hover:text-navy lg:min-h-9"
        >
          <Icon name="arrowLeft" size={16} />
          Danh sách tin
        </Link>
        <h1 className="m-0 font-serif text-[30px] font-medium sm:text-[36px]">{HEADINGS[mode]}</h1>
      </div>
      {mode === 'repost' && source.data && (
        <Notice tone="mist" icon="info">
          Tạo tin mới từ <strong className="font-semibold text-navy">{source.data.title}</strong>, có link mới. Hồ sơ cũ
          vẫn ở tin cũ. Chọn hạn nộp mới trước khi đăng.
        </Notice>
      )}
      {sourceId && source.isPending && (
        <>
          <LoadingStatus />
          {showSkeleton && <FormSkeleton />}
        </>
      )}
      {source.isError && <ErrorState onRetry={() => source.refetch()} message={apiMessage(source.error)} />}
      {(!sourceId || source.data) && (
        <JobForm
          key={`${mode}:${sourceId ?? 'new'}`}
          mode={mode}
          job={mode === 'edit' ? source.data : undefined}
          initial={source.data ? fromJob(source.data, mode) : EMPTY}
          initialNotice={notice}
        />
      )}
    </>
  );
}

export default HrJobFormPage;
