import {
  CV_MAX_BYTES,
  EMPLOYMENT_TYPE_LABEL,
  formatDate,
  formatPhone,
  formatSalary,
  MESSAGE_MAX,
  normalizeVietnamPhone,
  type JobDetailDto,
} from '@careers/shared';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api';
import { useApply, useCandidate } from '../api/queries';
import { SITE } from '../lib/site';
import { Button, ButtonLink } from '../ui/Button';
import { CloseButton, Dialog } from '../ui/Dialog';
import { Checkbox, FieldError, TextArea, TextField } from '../ui/Field';
import { Notice } from '../ui/feedback';
import { Icon } from '../ui/icons';

type Errors = Partial<Record<'fullName' | 'phone' | 'email' | 'cv' | 'cvLink' | 'consent' | 'message', string>>;

function validate(f: {
  fullName: string;
  phone: string;
  email: string;
  cvFile: File | null;
  cvLink: string;
  mode: 'file' | 'link';
  consent: boolean;
}): Errors {
  const e: Errors = {};
  if (f.fullName.trim().length < 2) e.fullName = 'Nhập họ và tên.';
  if (!normalizeVietnamPhone(f.phone)) e.phone = 'Số điện thoại chưa đúng, ví dụ 0912 345 678.';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Email chưa đúng.';
  if (f.mode === 'file' && !f.cvFile) e.cv = 'Đính kèm file CV hoặc dán link CV.';
  if (f.mode === 'link' && !/^https?:\/\/\S+/i.test(f.cvLink.trim()))
    e.cv = 'Dán link CV bắt đầu bằng http:// hoặc https://';
  if (!f.consent) e.consent = 'Cần tích ô đồng ý đầu tiên để gửi hồ sơ.';
  return e;
}

function checkFile(file: File): string | null {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return 'CV cần là file PDF.';
  if (file.size > CV_MAX_BYTES) return 'File lớn hơn 4 MB. Nén lại hoặc dán link CV.';
  return null;
}

export function ApplyDialog({ job, open, onClose }: { job: JobDetailDto; open: boolean; onClose: () => void }) {
  // The form stays mounted while closed so typed details survive (BR edge case:
  // "thông tin bạn nhập vẫn còn"). A new form starts only after a successful send.
  const [round, setRound] = useState(0);
  const [sent, setSent] = useState(false);
  const close = () => {
    if (sent) {
      setRound((n) => n + 1);
      setSent(false);
    }
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} label={`Ứng tuyển ${job.title}`} variant="panel" keepMounted>
      <ApplyForm key={round} job={job} onClose={close} onSent={() => setSent(true)} />
    </Dialog>
  );
}

function ApplyForm({ job, onClose, onSent }: { job: JobDetailDto; onClose: () => void; onSent: () => void }) {
  const { data: candidate } = useCandidate();
  const apply = useApply();
  const openedAt = useRef(Date.now());
  const fileInput = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(candidate?.me.name ?? '');
  const [phone, setPhone] = useState(candidate ? formatPhone(candidate.me.phone) : '');
  const [email, setEmail] = useState(candidate?.me.email ?? '');
  const [showEmail, setShowEmail] = useState(false);
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvLink, setCvLink] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false); // BR-11: never pre-ticked
  const [keep, setKeep] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [errors, setErrors] = useState<Errors>({});
  const [dragging, setDragging] = useState(false);
  const [closedMessage, setClosedMessage] = useState<string | null>(null);

  // Prefill once from the signed-in profile, even if it loads after the form.
  const prefilled = useRef(!!candidate);
  useEffect(() => {
    if (!candidate || prefilled.current) return;
    prefilled.current = true;
    setFullName((v) => v || candidate.me.name || '');
    setPhone((v) => v || formatPhone(candidate.me.phone));
    setEmail((v) => v || candidate.me.email || '');
  }, [candidate]);

  // Move focus to the first problem after the errors render.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!attempt) return;
    document
      .querySelector<HTMLElement>('dialog[open] [aria-invalid="true"], dialog[open] [data-error="true"]')
      ?.focus();
  }, [attempt]);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = checkFile(file);
    setErrors((e) => ({ ...e, cv: problem ?? undefined }));
    setCvFile(problem ? null : file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate({ fullName, phone, email, cvFile, cvLink, mode, consent });
    setErrors(found);
    if (Object.keys(found).length) {
      setAttempt((n) => n + 1);
      return;
    }
    apply.mutate(
      {
        jobId: job.id,
        fullName,
        phone,
        email,
        message,
        cvLink: mode === 'link' ? cvLink.trim() : '',
        cvFile: mode === 'file' ? cvFile : null,
        consent: true,
        keepForOtherJobs: keep,
        formOpenedAt: openedAt.current,
        website,
      },
      {
        onSuccess: onSent,
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'job_closed') setClosedMessage(err.message);
          else if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
            setErrors(err.fieldErrors as Errors);
            setAttempt((n) => n + 1);
          }
        },
      },
    );
  };

  if (apply.isSuccess) {
    const r = apply.data;
    return (
      <div
        className="relative flex min-h-full flex-col items-start justify-center gap-5 px-6 py-12 lg:min-h-[560px] lg:px-16"
        role="status"
      >
        <CloseButton onClick={onClose} className="absolute right-5 top-5" />
        <span className="flex size-[76px] items-center justify-center rounded-full border border-silver">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1C3F78"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h2 className="m-0 font-serif text-[34px] font-medium lg:text-[40px]">
          {r.updatedExisting ? 'Đã cập nhật hồ sơ' : 'Đã gửi hồ sơ'}
        </h2>
        {r.updatedExisting && r.previousDate && (
          <p className="m-0 max-w-[460px] border-l-2 border-silver bg-hover px-4 py-3 text-sm leading-relaxed text-body">
            Bạn đã nộp vị trí này ngày {formatDate(r.previousDate)}. Hồ sơ cũ đã được thay bằng hồ sơ vừa gửi, HR sẽ xem
            bản mới nhất.
          </p>
        )}
        <p className="m-0 max-w-[460px] text-base leading-relaxed text-body">
          Cảm ơn {r.firstName}. HR sẽ xem hồ sơ và liên hệ qua số{' '}
          <strong className="text-navy">{formatPhone(r.phone)}</strong> nếu bạn phù hợp với vị trí này.
        </p>
        <div className="flex flex-wrap gap-2.5 pt-2">
          <ButtonLink to="/" onClick={onClose}>
            Xem việc làm khác
          </ButtonLink>
          {!candidate && (
            <ButtonLink to="/dang-nhap" variant="outline" onClick={onClose}>
              Theo dõi hồ sơ
            </ButtonLink>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="relative hidden flex-col gap-6 overflow-hidden bg-navy p-9 text-white lg:flex">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-silver-soft">Bạn đang ứng tuyển</span>
          <h2 className="m-0 font-serif text-[30px] font-medium">{job.title}</h2>
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold">
            <Icon name="money" size={18} />
            {formatSalary(job)}
          </span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0 text-[15px] text-silver">
          {[
            ['pin', job.address ?? job.city],
            [
              'clock',
              `${EMPLOYMENT_TYPE_LABEL[job.employmentType]}${job.workingHours ? `, ${job.workingHours.split(',')[0]}` : ''}`,
            ],
            ['calendar', `Hạn nộp ${formatDate(job.deadline)}`],
          ].map(([icon, text]) => (
            <li key={icon} className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-silver/40">
                <Icon name={icon as 'pin'} size={15} />
              </span>
              {text}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 border-t border-silver/20 pt-5">
          <span className="text-[13px] text-silver-soft">Sau khi gửi hồ sơ</span>
          {['HR xem hồ sơ của bạn', 'Liên hệ qua Zalo hoặc điện thoại nếu phù hợp', 'Hẹn phỏng vấn'].map((t, i) => (
            <span key={t} className="flex items-center gap-3 text-sm text-silver">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-silver/40 text-xs">
                {i + 1}
              </span>
              {t}
            </span>
          ))}
        </div>
        <span className="mt-auto inline-flex items-center gap-2 text-xs text-silver-soft">
          <Icon name="lock" size={14} />
          Thông tin chỉ dùng cho mục đích tuyển dụng.
        </span>
      </aside>

      <form
        onSubmit={onSubmit}
        noValidate
        className="flex max-h-dvh flex-col overflow-y-auto sm:max-h-[calc(100dvh-48px)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 lg:border-0 lg:px-12 lg:pb-2 lg:pt-10">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted lg:hidden">Ứng tuyển vị trí</span>
            <h2 className="m-0 font-serif text-[22px] font-medium lg:text-[34px]">
              <span className="lg:hidden">{job.title}</span>
              <span className="hidden lg:inline">Gửi hồ sơ</span>
            </h2>
            <span className="inline-flex items-center gap-2 text-[13px] text-slate">
              <Icon name="clock" size={14} />
              Khoảng 1 phút. Không cần tạo tài khoản.
            </span>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex flex-col gap-5 px-5 py-5 lg:px-12">
          {closedMessage && (
            <Notice
              tone="error"
              icon="alert"
              action={
                <Link to={`/viec-lam/${job.slug}`} onClick={onClose}>
                  Xem vị trí tương tự
                </Link>
              }
            >
              {closedMessage}
            </Notice>
          )}
          {apply.isError &&
            !closedMessage &&
            !(apply.error instanceof ApiError && Object.keys(apply.error.fieldErrors).length) && (
              <Notice tone="error" icon="alert">
                {apply.error instanceof ApiError ? apply.error.message : 'Chưa gửi được, kiểm tra mạng rồi thử lại.'}
              </Notice>
            )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Họ và tên"
              icon="user"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
            />
            <TextField
              label="Số điện thoại (Zalo)"
              icon="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09xx xxx xxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors.phone}
              hint="HR dùng số này để liên hệ nếu bạn phù hợp."
            />
          </div>

          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-medium">CV của bạn</legend>
              <button
                type="button"
                onClick={() => setMode(mode === 'file' ? 'link' : 'file')}
                className="inline-flex min-h-11 items-center gap-1.5 border-0 bg-transparent text-[13px] font-medium text-link"
              >
                <Icon name={mode === 'file' ? 'link' : 'upload'} size={14} />
                {mode === 'file' ? 'Dán link thay vì tải file' : 'Tải file PDF thay vì link'}
              </button>
            </div>
            {mode === 'file' ? (
              cvFile ? (
                <div className="flex items-center gap-3 rounded-card border border-silver bg-white px-4 py-3.5">
                  <Icon name="file" size={20} className="text-accent" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <strong className="truncate text-sm font-medium">{cvFile.name}</strong>
                    <span className="text-xs text-muted">
                      {(cvFile.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB · sẵn sàng gửi
                    </span>
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setCvFile(null)}>
                    Đổi file
                  </Button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  data-error={errors.cv ? 'true' : undefined}
                  className={`flex flex-col items-center gap-2 rounded-card border border-dashed px-5 py-6 text-center transition-colors ${
                    dragging
                      ? 'border-accent bg-tint'
                      : errors.cv
                        ? 'border-error bg-white'
                        : 'border-silver bg-hover hover:border-accent'
                  }`}
                >
                  <span className="flex size-12 items-center justify-center rounded-full border border-ring bg-white text-accent">
                    <Icon name="upload" size={20} />
                  </span>
                  <span className="text-[15px] font-medium">
                    <span className="hidden sm:inline">Kéo thả CV vào đây hoặc </span>
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="border-0 bg-transparent p-0 font-medium text-link underline"
                    >
                      chọn file
                    </button>
                  </span>
                  <span className="text-xs text-muted">PDF, tối đa 4 MB. Từ máy, Drive hoặc Zalo.</span>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => pick(e.target.files?.[0])}
                  />
                </div>
              )
            ) : (
              <TextField
                label="Link CV"
                icon="link"
                type="url"
                inputMode="url"
                placeholder="https://drive.google.com/... hoặc LinkedIn"
                value={cvLink}
                onChange={(e) => setCvLink(e.target.value)}
                error={errors.cvLink}
              />
            )}
            <FieldError>{errors.cv}</FieldError>
          </fieldset>

          <TextArea
            label="Lời nhắn đến HR"
            optional
            rows={3}
            maxLength={MESSAGE_MAX}
            placeholder="Giới thiệu ngắn, thời gian có thể bắt đầu…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            counter={{ value: message.length, max: MESSAGE_MAX }}
            error={errors.message}
          />
          {showEmail ? (
            <TextField
              label="Email"
              optional
              icon="mail"
              type="email"
              autoComplete="email"
              placeholder="ban@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="-mt-2 inline-flex min-h-11 w-fit items-center gap-2 border-0 bg-transparent p-0 text-sm font-medium text-link"
            >
              <Icon name="plus" size={15} />
              Thêm email (không bắt buộc)
            </button>
          )}

          {/* Honeypot: hidden from people, bots fill it. */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px]"
          />

          <div className="flex flex-col gap-2.5">
            <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} error={errors.consent}>
              Tôi đồng ý để {SITE.company} dùng thông tin này để xét tuyển vị trí này.{' '}
              <Link to="/chinh-sach-du-lieu" target="_blank">
                Xem chính sách
              </Link>
            </Checkbox>
            <Checkbox checked={keep} onChange={(e) => setKeep(e.target.checked)}>
              Giữ hồ sơ 12 tháng để HR báo khi có vị trí khác phù hợp{' '}
              <span className="text-muted">(không bắt buộc)</span>
            </Checkbox>
          </div>
        </div>

        <div className="sticky bottom-0 mt-auto border-t border-line bg-white px-5 py-3 lg:border-0 lg:px-12 lg:pb-10 lg:pt-2">
          <Button type="submit" size="lg" icon="send" disabled={apply.isPending} className="w-full lg:w-auto">
            {apply.isPending ? 'Đang gửi…' : 'Gửi hồ sơ'}
          </Button>
        </div>
      </form>
    </div>
  );
}
