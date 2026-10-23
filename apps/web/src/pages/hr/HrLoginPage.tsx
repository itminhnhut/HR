import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { isDemo } from '../../api';
import { DEMO_HR } from '../../api/mock-seed';
import { useHrMe, useHrSignIn } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { SITE } from '../../lib/site';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/Field';
import { Notice } from '../../ui/feedback';
import { Icon, LogoMark } from '../../ui/icons';
import { errorMessage } from './parts';

function Brand() {
  return (
    <section className="relative flex flex-col justify-between gap-10 overflow-hidden bg-navy p-7 text-white sm:p-10 lg:p-14">
      <svg
        viewBox="0 0 560 800"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
      >
        <path
          d="M0 640 C 120 590, 240 700, 360 640 S 500 590, 560 610"
          fill="none"
          stroke="#C5CFDC"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
        <path
          d="M0 662 C 130 612, 250 722, 370 662 S 510 612, 560 632"
          fill="none"
          stroke="#C5CFDC"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
      </svg>
      <Link to="/" className="relative flex items-center gap-3 text-white no-underline hover:text-white">
        <LogoMark />
        <span className="font-serif text-[22px] font-medium">{SITE.company}</span>
      </Link>
      <div className="relative flex flex-col gap-4">
        <h1 className="m-0 animate-rise font-serif text-[34px] font-medium sm:text-[46px]">Quản trị tuyển dụng</h1>
        <p className="m-0 max-w-[400px] text-base font-light leading-relaxed text-silver">
          Đăng tin, xem hồ sơ và liên hệ ứng viên ở một chỗ.
        </p>
      </div>
      <span className="relative text-[13px] text-silver-soft">Trang dành riêng cho bộ phận nhân sự.</span>
    </section>
  );
}

export function HrLoginPage() {
  usePageMeta('Đăng nhập HR');
  const me = useHrMe();
  const signIn = useHrSignIn();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (me.data) return <Navigate to="/hr" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn.mutate({ email, password }, { onSuccess: () => navigate('/hr', { replace: true }) });
  };

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-mist text-navy lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <Brand />
      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="flex w-full max-w-[420px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="m-0 font-serif text-[30px] font-medium sm:text-[34px]">Đăng nhập</h2>
            <p className="m-0 text-[15px] leading-relaxed text-slate">Dùng tài khoản HR được cấp riêng cho bạn.</p>
          </div>

          {signIn.error && (
            <Notice tone="error" icon="alert">
              {errorMessage(signIn.error, 'Chưa đăng nhập được, thử lại sau ít phút.')}
            </Notice>
          )}

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <TextField
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Mật khẩu"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" size="lg" disabled={signIn.isPending || !email.trim() || !password}>
              {signIn.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
            {isDemo && (
              <span className="text-xs text-muted">
                Bản chạy thử: {DEMO_HR.email} / {DEMO_HR.password}
              </span>
            )}
          </form>

          <ul className="m-0 flex list-none flex-col gap-2.5 border-t border-line p-0 pt-[18px] text-[13px] text-slate">
            <li className="flex items-center gap-2.5">
              <Icon name="lock" size={16} stroke={1.5} className="text-accent" />
              Nhập sai 5 lần, tài khoản tạm khoá 15 phút
            </li>
            <li className="flex items-center gap-2.5">
              <Icon name="clock" size={16} stroke={1.5} className="text-accent" />
              Giữ đăng nhập 7 ngày trên thiết bị này
            </li>
          </ul>
          <Link to="/" className="inline-flex min-h-11 w-fit items-center text-sm">
            Về trang việc làm
          </Link>
        </div>
      </section>
    </div>
  );
}

export default HrLoginPage;
