import {
  type CandidateApplicationDto,
  type CandidateMe,
  type CandidateOverview,
  type CandidateStage,
  CV_MAX_BYTES,
  formatPhone,
  formatTimestamp,
  normalizeVietnamPhone,
} from '@careers/shared';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCandidate, useCandidateSignOut, useUpdateCandidate } from '../../api/queries';
import { useNoIndex, usePageMeta } from '../../lib/hooks';
import { ApplicationStage } from '../../site/ApplicationStage';
import { NavyHero } from '../../site/PublicLayout';
import { Button, ButtonLink, buttonClass } from '../../ui/Button';
import { CandidateLoginPage } from './CandidateLoginPage';
import { FieldError, TextField } from '../../ui/Field';
import { EmptyState, ErrorState, LoadingStatus, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon } from '../../ui/icons';
import { errorText } from './candidateUi';
import { PhoneField } from '../../ui/PhoneField';

/** Gender-marking middle names that are left out of a greeting ("Trần Thị Lan" → "Lan"). */
const MARKER_MIDDLE_NAMES = new Set(['thị', 'văn']);

/** "Trần Minh Anh" → "Minh Anh": Vietnamese greetings drop the family name. */
function greetingName(fullName: string | null): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'bạn';
  const given = words.slice(1);
  if (given.length > 1 && MARKER_MIDDLE_NAMES.has(given[0].toLocaleLowerCase('vi'))) given.shift();
  return given.length ? given.join(' ') : words[0];
}

export function CandidateAccountPage() {
  usePageMeta('Hồ sơ của tôi');
  useNoIndex();
  const candidate = useCandidate();
  const showSkeleton = useDelayedFlag(candidate.isPending);

  /**
   * Signing out clears the cached candidate. Keep the last overview on screen
   * until we navigate away, instead of showing the sign-in view.
   */
  const [leaving, setLeaving] = useState<CandidateOverview | null>(null);

  const data = candidate.data ?? leaving;

  if (candidate.isError && !data) {
    return (
      <>
        <NavyHero />
        <main className="mx-auto w-full max-w-[1160px] px-4 py-10 sm:px-6">
          <ErrorState onRetry={() => candidate.refetch()} />
        </main>
      </>
    );
  }
  if (candidate.isPending) return <AccountSkeleton visible={showSkeleton} />;
  // Signed out: the Google button is right here, there is no separate sign-in page.
  if (!data) return <CandidateLoginPage />;

  const { me, applications } = data;

  return (
    <>
      <NavyHero waves={false}>
        <div className="relative mx-auto flex max-w-[1160px] flex-col gap-[18px] px-4 pb-10 pt-[18px] sm:gap-[26px] sm:px-6 sm:pb-14 sm:pt-10">
          <div className="flex flex-col gap-1 sm:gap-2">
            <h1 className="m-0 animate-rise font-serif text-[30px] font-medium sm:text-[42px]">
              Chào {greetingName(me.name)}
            </h1>
            <span className="text-[13px] font-light text-silver sm:text-[15px]">
              <span className="hidden sm:inline">Đăng nhập Google: </span>
              <span className="break-all">{me.email}</span>
            </span>
          </div>
        </div>
      </NavyHero>

      <main className="mx-auto w-full max-w-[1160px] px-4 pb-14 pt-4 sm:px-6 sm:pb-[72px] sm:pt-9">
        <div className="flex flex-col gap-10 sm:gap-14">
          <section aria-labelledby="apps-title" className="flex flex-col gap-4">
            <h2 id="apps-title" className="m-0 font-serif text-[26px] font-medium sm:text-[30px]">
              Hồ sơ đã nộp <span className="text-lg font-normal text-slate">{applications.length}</span>
            </h2>
            <ApplicationsTab applications={applications} />
          </section>
          <section aria-label="Thông tin, CV và dữ liệu">
            <InfoTab me={me} onLeave={() => setLeaving(data)} onStay={() => setLeaving(null)} />
          </section>
        </div>
      </main>
    </>
  );
}

// ── Hồ sơ đã nộp ─────────────────────────────────────────────────────────

function stageNote(stage: CandidateStage): string {
  switch (stage) {
    case 'sent':
      return 'HR đã nhận hồ sơ và sẽ xem trong vài ngày tới.';
    case 'seen':
      return 'Hồ sơ đang được xem xét.';
    case 'interview':
      return 'HR sẽ gọi hoặc nhắn Zalo để hẹn lịch.';
    case 'closed':
      return 'Vị trí này đã đóng. Cảm ơn bạn đã quan tâm.';
  }
}

function ApplicationsTab({ applications }: { applications: CandidateApplicationDto[] }) {
  if (applications.length === 0) {
    return (
      <EmptyState icon="inbox" title="Chưa có hồ sơ nào" actions={<ButtonLink to="/">Xem việc đang tuyển</ButtonLink>}>
        Hồ sơ bạn nộp bằng email Google này sẽ tự hiện ở đây.
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:gap-3.5">
      {applications.map((app) => (
        <ApplicationCard key={app.id} app={app} note={stageNote(app.stage)} />
      ))}
      <p className="m-0 mt-2 text-[13px] leading-relaxed text-muted">
        HR liên hệ qua số điện thoại hoặc Zalo bạn đã để lại. Trạng thái ở đây chỉ để bạn tiện theo dõi.
      </p>
    </div>
  );
}

function ApplicationCard({ app, note }: { app: CandidateApplicationDto; note: string }) {
  return (
    <article className="card-hover grid gap-2.5 rounded-card border border-line bg-white p-[18px] sm:gap-5 sm:px-7 sm:py-[26px] md:grid-cols-[minmax(0,1fr)_300px] md:items-center md:gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs text-muted sm:text-[13px]">Nộp ngày {formatTimestamp(app.createdAt)}</span>
        <Link
          to={`/viec-lam/${app.jobSlug}`}
          className="font-serif text-[21px] font-medium text-navy no-underline hover:text-link sm:text-[26px]"
        >
          {app.jobTitle}
        </Link>
        <span className="hidden text-sm text-slate sm:block">
          {app.salary} · {app.place}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        <ApplicationStage stage={app.stage} />
        <span className="text-[13px] leading-relaxed text-body sm:text-sm">{note}</span>
      </div>
    </article>
  );
}

// ── Thông tin & CV ───────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
  return bytes >= 1024 * 1024
    ? `${nf.format(bytes / 1024 / 1024)} MB`
    : `${nf.format(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

function cvProblem(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return 'CV cần là file PDF.';
  if (file.size > CV_MAX_BYTES) return 'File lớn hơn 4 MB. Nén lại rồi thử lại.';
  return null;
}

function InfoTab({ me, onLeave, onStay }: { me: CandidateMe; onLeave: () => void; onStay: () => void }) {
  return (
    <div className="grid items-start gap-3 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <ProfileForm me={me} />
      <aside className="flex flex-col gap-3 sm:gap-4">
        <DataCard onLeave={onLeave} onStay={onStay} />
      </aside>
    </div>
  );
}

function ProfileForm({ me }: { me: CandidateMe }) {
  const update = useUpdateCandidate();
  const [name, setName] = useState(me.name ?? '');
  const savedPhone = me.phone ? formatPhone(me.phone) : '';
  const [phone, setPhone] = useState(savedPhone);
  const [phoneError, setPhoneError] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty = name.trim() !== (me.name ?? '') || phone.trim() !== savedPhone || cvFile !== null;

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    const problem = cvProblem(file);
    setResult(null);
    setCvError(problem ?? '');
    setCvFile(problem ? null : file);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);
    setPhoneError('');
    if (phone.trim() && !normalizeVietnamPhone(phone)) {
      setPhoneError('Số điện thoại chưa đúng, ví dụ 0912 345 678.');
      return;
    }
    try {
      const changedPhone = phone.trim() !== savedPhone ? { phone: phone.trim() } : {};
      await update.mutateAsync({ name: name.trim(), ...changedPhone, ...(cvFile ? { cvFile } : {}) });
      setCvFile(null);
      setResult({ ok: true, text: 'Đã lưu thay đổi.' });
    } catch (err) {
      const cvMessage = errorText(err, 'cv', '');
      if (cvMessage && cvFile) setCvError(cvMessage);
      setPhoneError(errorText(err, 'phone', ''));
      setResult({ ok: false, text: errorText(err, null, 'Chưa lưu được. Kiểm tra mạng rồi thử lại.') });
    }
  };

  const fileName = cvFile?.name ?? me.cvFileName;
  const fileMeta = cvFile
    ? `${formatBytes(cvFile.size)} · bấm Lưu để cập nhật`
    : me.cvFileName
      ? 'CV dùng cho lần nộp sau'
      : 'PDF, tối đa 4 MB';

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-labelledby="profile-title"
      className="flex flex-col gap-3.5 rounded-card border border-line bg-white p-[18px] sm:gap-[18px] sm:px-8 sm:py-[30px]"
    >
      <h2 id="profile-title" className="m-0 hidden font-serif text-[26px] font-medium sm:block">
        Thông tin để nộp nhanh
      </h2>
      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
        <TextField label="Họ tên" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        <PhoneField
          label="Số điện thoại (Zalo)"
          optional
          value={phone}
          error={phoneError}
          hint="Để điền sẵn khi nộp hồ sơ."
          onChange={setPhone}
        />
        <TextField
          label="Email (Google)"
          value={me.email}
          disabled
          hint="Hồ sơ nộp bằng email này hiện trong trang này."
          className="sm:col-span-2 [&>div]:border-line [&>div]:bg-mist [&_input]:text-slate"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div
          className={`flex items-center gap-3 rounded-control border p-3.5 sm:gap-3.5 sm:px-[18px] sm:py-4 ${cvError ? 'border-error' : 'border-line'}`}
        >
          <Icon name="file" size={22} stroke={1.5} className="shrink-0 text-accent" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <strong className="truncate text-sm font-medium sm:text-[15px]">{fileName ?? 'Chưa có CV'}</strong>
            <span className="text-xs text-muted sm:text-[13px]">{fileMeta}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
            className="min-h-11 shrink-0 px-4 sm:min-h-[42px]"
          >
            {fileName ? 'Đổi CV' : 'Tải CV lên'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onPickFile}
            className="hidden"
            aria-label="Chọn file CV (PDF)"
          />
        </div>
        <FieldError>{cvError}</FieldError>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" disabled={!dirty || update.isPending} className="w-full px-7 sm:w-auto">
          {update.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
        </Button>
        <span role="status" className={`text-sm ${result?.ok ? 'text-ok' : 'text-error'}`}>
          {result?.text}
        </span>
      </div>
    </form>
  );
}

const LEAVE_DELAY_MS = 1500;

function DataCard({ onLeave, onStay }: { onLeave: () => void; onStay: () => void }) {
  const signOut = useCandidateSignOut();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');
  const keepButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (asking) keepButton.current?.focus();
  }, [asking]);

  useEffect(() => {
    if (!deleted) return;
    const t = setTimeout(() => navigate('/', { replace: true }), LEAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [deleted, navigate]);

  const run = async (deleteData: boolean) => {
    setError('');
    onLeave();
    try {
      await signOut.mutateAsync({ deleteData });
      if (deleteData) {
        setAsking(false);
        setDeleted(true);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      onStay();
      setError(
        errorText(err, null, deleteData ? 'Chưa xóa được. Thử lại sau ít phút.' : 'Chưa đăng xuất được. Thử lại sau.'),
      );
    }
  };

  return (
    <>
      <section
        aria-labelledby="data-title"
        className="flex flex-col gap-2.5 rounded-card border border-line bg-white p-[18px] sm:px-[26px] sm:py-6"
      >
        <h2 id="data-title" className="m-0 font-serif text-xl font-medium">
          Dữ liệu của bạn
        </h2>
        <p className="m-0 text-sm leading-relaxed text-slate">Xóa toàn bộ hồ sơ và CV đã gửi. Không thể khôi phục.</p>
        {asking && (
          <div className="flex gap-2">
            <button
              ref={keepButton}
              type="button"
              onClick={() => setAsking(false)}
              disabled={signOut.isPending}
              className={buttonClass('outline', 'sm', 'min-h-11 flex-1 border-field text-slate')}
            >
              Giữ lại
            </button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void run(true)}
              disabled={signOut.isPending}
              className="min-h-11 flex-1"
            >
              {signOut.isPending ? 'Đang xóa…' : 'Xóa hẳn'}
            </Button>
          </div>
        )}
        <span role="status" className="text-sm leading-relaxed text-ok empty:hidden">
          {deleted ? 'Đã xóa hồ sơ, CV và các lựa chọn nhận tin. Bạn sẽ được đăng xuất.' : ''}
        </span>
        {!asking && !deleted && (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="min-h-11 self-start border-0 bg-transparent p-0 text-sm text-error hover:underline"
          >
            Xóa dữ liệu của tôi
          </button>
        )}
        <FieldError>{error}</FieldError>
        <Link to="/chinh-sach-du-lieu" className="inline-flex min-h-11 items-center self-start text-[13px] sm:min-h-0">
          Chính sách dữ liệu
        </Link>
      </section>
      {!deleted && (
        <button
          type="button"
          onClick={() => void run(false)}
          disabled={signOut.isPending}
          className="inline-flex min-h-11 items-center gap-2 self-start border-0 bg-transparent p-0 text-sm text-slate hover:text-navy disabled:opacity-60"
        >
          <Icon name="logout" size={16} />
          Đăng xuất
        </button>
      )}
    </>
  );
}

// ── Loading ──────────────────────────────────────────────────────────────

function AccountSkeleton({ visible }: { visible: boolean }) {
  return (
    <>
      <NavyHero waves={false}>
        <div className="relative mx-auto flex max-w-[1160px] flex-col gap-[18px] px-4 pb-4 pt-[18px] sm:gap-[26px] sm:px-6 sm:pt-10">
          {visible && (
            <>
              <div className="flex flex-col gap-2">
                <Sk dark h={36} w={240} />
                <Sk dark h={16} w={160} />
              </div>
              <div className="flex gap-6">
                <Sk dark h={14} w={90} />
                <Sk dark h={14} w={80} />
                <Sk dark h={14} w={80} />
              </div>
            </>
          )}
        </div>
      </NavyHero>
      <main className="mx-auto w-full max-w-[1160px] px-4 pb-14 pt-4 sm:px-6 sm:pt-9">
        <LoadingStatus />
        {visible && (
          <div className="flex flex-col gap-3.5" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-card border border-line bg-white p-[18px] sm:px-7 sm:py-[26px]"
              >
                <Sk h={12} w={110} />
                <Sk h={26} className="w-2/3" />
                <Sk h={14} className="w-1/2" />
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default CandidateAccountPage;
