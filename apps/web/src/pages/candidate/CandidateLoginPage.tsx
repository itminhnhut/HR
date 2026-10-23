import { formatPhone, normalizeVietnamPhone } from '@careers/shared';
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { isDemo } from '../../api';
import { useCandidate, useGoogleSignIn, useRequestOtp, useVerifyOtp } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { NavyHero } from '../../site/PublicLayout';
import { Button } from '../../ui/Button';
import { FieldError, TextField } from '../../ui/Field';
import { Icon } from '../../ui/icons';
import { ACCOUNT_PATH, errorText, safeNextPath } from './candidateUi';

const PERKS = ['Xem trạng thái mọi hồ sơ đã nộp', 'Lưu việc để nộp sau', 'Nộp lần sau không cần nhập lại'];
const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;
const DEMO_CODE = '123456';

type Step = 'phone' | 'verify' | 'otp';
type Channel = 'zalo' | 'sms';

const emptyCode = () => Array.from({ length: CODE_LENGTH }, () => '');

export function CandidateLoginPage() {
  usePageMeta(
    'Đăng nhập',
    'Đăng nhập bằng số điện thoại đã nộp hồ sơ để theo dõi trạng thái. Không bắt buộc khi ứng tuyển.',
  );
  const candidate = useCandidate();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('tiep'));

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const googleSignIn = useGoogleSignIn();

  const [step, setStep] = useState<Step>('phone');
  /** Where "Đổi số" returns to: the plain phone step or the Google verify step. */
  const [phoneStep, setPhoneStep] = useState<'phone' | 'verify'>('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [channel, setChannel] = useState<Channel>('zalo');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  // Already signed in (or just finished signing in): go straight on.
  if (candidate.data) return <Navigate to={next} replace />;

  /** Sends a code and moves to the OTP step. Returns the error text, or null on success. */
  const sendCode = async (via: Channel): Promise<string | null> => {
    const normalized = normalizeVietnamPhone(phone);
    if (!normalized) {
      const message = 'Số điện thoại chưa đúng, ví dụ 0912 345 678.';
      setPhoneError(message);
      return message;
    }
    setPhoneError('');
    try {
      const res = await requestOtp.mutateAsync({ phone: normalized, channel: via });
      setPhone(normalized);
      setChannel(via);
      setDevCode(res.devCode ?? null);
      setStep('otp');
      return null;
    } catch (e) {
      const message = errorText(e, 'phone', 'Chưa gửi được mã. Kiểm tra mạng rồi thử lại.');
      setPhoneError(message);
      return message;
    }
  };

  const startGoogle = async () => {
    setGoogleError('');
    setPhoneError('');
    try {
      const res = await googleSignIn.mutateAsync();
      setGoogleEmail(res.email);
      if (res.needsPhone) {
        setPhoneStep('verify');
        setStep('verify');
        return;
      }
      await candidate.refetch();
      navigate(next, { replace: true });
    } catch (e) {
      setGoogleError(errorText(e, null, 'Chưa đăng nhập được bằng Google. Thử lại sau ít phút.'));
    }
  };

  const onPhoneSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendCode('zalo');
  };

  return (
    <NavyHero waves={false} className="flex flex-1 flex-col [&>header]:w-full">
      <div className="relative grid flex-1 md:min-h-[700px] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-cols-[560px_minmax(0,1fr)]">
        <section className="relative flex flex-col gap-7 overflow-hidden px-5 pb-10 pt-8 sm:px-6 md:px-10 md:py-14 lg:p-14">
          <PanelWaves />
          <div className="relative flex flex-col gap-5 md:my-auto md:gap-[22px]">
            <h1 className="m-0 animate-rise font-serif text-[32px] font-medium md:text-[38px] lg:text-[44px]">
              Theo dõi hồ sơ của bạn
            </h1>
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0 text-[15px] text-silver">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-center gap-3">
                  <Icon name="check" size={18} stroke={1.5} className="shrink-0 text-white" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative m-0 text-[13px] leading-relaxed text-silver-soft">
            Không bắt buộc. Bạn vẫn nộp đơn được mà không cần đăng nhập.
          </p>
        </section>

        <section className="relative flex items-center justify-center bg-mist px-4 py-10 text-navy sm:px-6 md:py-12">
          <div className="flex w-full max-w-[420px] flex-col gap-[22px]">
            {step === 'phone' && (
              <>
                <StepHeading title="Đăng nhập">
                  Dùng số điện thoại bạn đã nộp hồ sơ, hồ sơ cũ sẽ tự hiện ra.
                </StepHeading>
                <PhoneForm
                  label="Số điện thoại"
                  phone={phone}
                  error={phoneError}
                  busy={requestOtp.isPending}
                  onChange={setPhone}
                  onSubmit={onPhoneSubmit}
                  onSms={() => void sendCode('sms')}
                />
                <div className="flex items-center gap-3 text-[13px] text-muted">
                  <span className="h-px flex-1 bg-line" />
                  hoặc
                  <span className="h-px flex-1 bg-line" />
                </div>
                <button
                  type="button"
                  onClick={() => void startGoogle()}
                  disabled={googleSignIn.isPending}
                  className="flex min-h-[54px] items-center justify-center gap-3 rounded-control border border-silver bg-white text-[15px] font-medium text-navy transition-colors hover:bg-hover disabled:opacity-60"
                >
                  <GoogleMark />
                  {googleSignIn.isPending ? 'Đang mở Google…' : 'Tiếp tục với Google'}
                </button>
                <FieldError>{googleError}</FieldError>
              </>
            )}

            {step === 'verify' && (
              <>
                <div className="flex flex-col gap-2">
                  {googleEmail && (
                    <span className="inline-flex items-center gap-2 text-[13px] text-ok">
                      <Icon name="check" size={16} stroke={1.8} className="shrink-0" />
                      <span className="min-w-0 break-all">Đã đăng nhập Google: {googleEmail}</span>
                    </span>
                  )}
                  <StepHeading title="Xác minh số điện thoại">
                    Chỉ cần một lần, để nối với các hồ sơ bạn đã nộp bằng số này.
                  </StepHeading>
                </div>
                <PhoneForm
                  label="Số điện thoại đã dùng khi nộp hồ sơ"
                  phone={phone}
                  error={phoneError}
                  busy={requestOtp.isPending}
                  onChange={setPhone}
                  onSubmit={onPhoneSubmit}
                  onSms={() => void sendCode('sms')}
                />
                <Link
                  to={candidate.data ? ACCOUNT_PATH : '/'}
                  className="inline-flex min-h-11 items-center justify-center text-sm"
                >
                  Để sau, tôi chưa nộp hồ sơ nào
                </Link>
              </>
            )}

            {step === 'otp' && (
              <OtpStep
                phone={phone}
                channel={channel}
                devCode={isDemo ? (devCode ?? DEMO_CODE) : null}
                verifying={verifyOtp.isPending}
                resending={requestOtp.isPending}
                onBack={() => setStep(phoneStep)}
                onResend={() => sendCode(channel)}
                onVerify={async (code) => {
                  await verifyOtp.mutateAsync({ phone, code });
                  navigate(next, { replace: true });
                }}
              />
            )}

            <Link to="/" className="inline-flex min-h-11 items-center self-start text-sm">
              Về trang việc làm
            </Link>
          </div>
        </section>
      </div>
    </NavyHero>
  );
}

function StepHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="m-0 font-serif text-[30px] font-medium sm:text-[34px]">{title}</h2>
      <p className="m-0 text-[15px] leading-relaxed text-slate">{children}</p>
    </div>
  );
}

function PhoneForm({
  label,
  phone,
  error,
  busy,
  onChange,
  onSubmit,
  onSms,
}: {
  label: string;
  phone: string;
  error: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onSms: () => void;
}) {
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-[22px]">
      <TextField
        label={label}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="0912 345 678"
        value={phone}
        error={error}
        onChange={(e) => onChange(e.target.value)}
        className="[&_input]:text-base"
      />
      <Button type="submit" size="lg" disabled={busy} className="min-h-14 w-full">
        {busy ? 'Đang gửi mã…' : 'Nhận mã qua Zalo'}
      </Button>
      <span className="-mt-2 text-center text-[13px] text-muted">
        Không có Zalo?{' '}
        <button
          type="button"
          onClick={onSms}
          disabled={busy}
          className="min-h-11 border-0 bg-transparent p-0 text-[13px] text-link underline hover:text-navy disabled:opacity-60"
        >
          Gửi mã bằng SMS
        </button>
      </span>
    </form>
  );
}

function OtpStep({
  phone,
  channel,
  devCode,
  verifying,
  resending,
  onBack,
  onResend,
  onVerify,
}: {
  phone: string;
  channel: Channel;
  devCode: string | null;
  verifying: boolean;
  resending: boolean;
  onBack: () => void;
  onResend: () => Promise<string | null>;
  onVerify: (code: string) => Promise<void>;
}) {
  const [digits, setDigits] = useState<string[]>(emptyCode);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const focusBox = (i: number) => {
    const box = boxes.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))];
    box?.focus();
    box?.select();
  };

  /** Writes `chars` starting at box `start` (typing, paste or SMS autofill). */
  const fillFrom = (start: number, chars: string) => {
    const next = [...digits];
    const usable = chars.slice(0, CODE_LENGTH - start);
    [...usable].forEach((d, k) => (next[start + k] = d));
    setDigits(next);
    setError('');
    focusBox(start + usable.length);
  };

  const onBoxChange = (i: number, raw: string) => {
    let typed = raw.replace(/\D/g, '');
    if (!typed) {
      const next = [...digits];
      next[i] = '';
      setDigits(next);
      return;
    }
    // Typing into a filled box without selecting it: keep only the new digit.
    if (typed.length === 2 && digits[i]) typed = typed.startsWith(digits[i]) ? typed.slice(1) : typed.slice(0, 1);
    fillFrom(i, typed);
  };

  const onBoxKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      focusBox(i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  const onBoxPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    e.preventDefault();
    fillFrom(pasted.length >= CODE_LENGTH ? 0 : i, pasted);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < CODE_LENGTH) {
      setError('Nhập đủ 6 số trong tin nhắn.');
      focusBox(digits.findIndex((d) => !d));
      return;
    }
    try {
      await onVerify(code);
    } catch (err) {
      setError(errorText(err, 'code', 'Chưa xác nhận được. Kiểm tra mạng rồi thử lại.'));
      setDigits(emptyCode());
      focusBox(0);
    }
  };

  const resend = async () => {
    setError('');
    setStatus('');
    const failure = await onResend();
    if (failure) {
      setError(failure);
      return;
    }
    setDigits(emptyCode());
    setSecondsLeft(RESEND_SECONDS);
    setStatus(`Đã gửi lại mã qua ${channel === 'sms' ? 'SMS' : 'Zalo'}.`);
    focusBox(0);
  };

  const errId = 'otp-error';
  const clock = `0:${String(secondsLeft).padStart(2, '0')}`;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-[22px]">
      <StepHeading title="Nhập mã 6 số">
        Đã gửi qua {channel === 'sms' ? 'SMS' : 'Zalo'} đến{' '}
        <strong className="font-semibold text-navy">{formatPhone(phone)}</strong>.{' '}
        <button
          type="button"
          onClick={onBack}
          className="border-0 bg-transparent p-0 text-[15px] text-link underline hover:text-navy"
        >
          Đổi số
        </button>
      </StepHeading>

      <div role="group" aria-label="Mã xác nhận 6 số" className="flex flex-col gap-2">
        <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
                // Phones force inputs to 16px (anti-zoom); digits here are larger anyway.
                el?.style.setProperty('font-size', '28px', 'important');
              }}
              value={d}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`Chữ số ${i + 1} trên 6`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errId : undefined}
              onFocus={(e) => e.target.select()}
              onChange={(e) => onBoxChange(i, e.target.value)}
              onKeyDown={(e) => onBoxKeyDown(i, e)}
              onPaste={(e) => onBoxPaste(i, e)}
              className={`field-focus h-[60px] w-full min-w-0 rounded-control border bg-white text-center font-sans font-semibold tabular-nums text-navy outline-none ${
                error ? 'border-error' : 'border-field'
              }`}
            />
          ))}
        </div>
        <FieldError id={errId}>{error}</FieldError>
      </div>

      <Button type="submit" size="lg" disabled={verifying} className="min-h-14 w-full">
        {verifying ? 'Đang xác nhận…' : 'Xác nhận'}
      </Button>

      <div className="-mt-2 flex flex-col items-center gap-1 text-center text-[13px] text-muted">
        {secondsLeft > 0 ? (
          <span className="flex min-h-11 items-center">Chưa nhận được? Gửi lại sau {clock}</span>
        ) : (
          <span>
            Chưa nhận được?{' '}
            <button
              type="button"
              onClick={() => void resend()}
              disabled={resending}
              className="min-h-11 border-0 bg-transparent p-0 text-[13px] text-link underline hover:text-navy disabled:opacity-60"
            >
              {resending ? 'Đang gửi…' : 'Gửi lại mã'}
            </button>
          </span>
        )}
        <span role="status" className="text-ok empty:hidden">
          {status}
        </span>
        {devCode && <span className="text-xs text-muted">Bản chạy thử: mã là {devCode}</span>}
      </div>
    </form>
  );
}

/** Two thin waves near the bottom of the navy panel (same drawing as the mockup). */
function PanelWaves() {
  return (
    <svg
      viewBox="0 0 560 820"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full max-md:hidden"
    >
      <path
        d="M0 660 C 120 610, 240 720, 360 660 S 500 610, 560 630"
        fill="none"
        stroke="#C5CFDC"
        strokeOpacity="0.35"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0 682 C 130 632, 250 742, 370 682 S 510 632, 560 652"
        fill="none"
        stroke="#C5CFDC"
        strokeOpacity="0.18"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9c-.3 1.4-1.1 2.5-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.7 3.2-8z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8C3.9 20.6 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.8 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7H2.1C1.4 8.5 1 10.2 1 12s.4 3.5 1.1 5l3.7-2.8z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 3.9 3.4 2.1 7l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}

export default CandidateLoginPage;
