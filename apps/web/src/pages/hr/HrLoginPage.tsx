import { Link, Navigate, useNavigate } from 'react-router';
import { ApiError, isDemo } from '../../api';
import { useHrMe, useHrSignIn } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { SITE } from '../../lib/site';
import { Notice } from '../../ui/feedback';
import { Icon, LogoMark } from '../../ui/icons';
import { errorMessage } from './parts';

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

function NotAllowed({ error }: { error: ApiError }) {
  const email = error.fieldErrors.email;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-control border border-silver bg-tint px-4 py-3.5 text-sm leading-relaxed text-navy"
    >
      <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
      <span>
        Tài khoản {email ? <strong className="font-semibold">{email}</strong> : 'Google này'} chưa được cấp quyền HR.
        Đăng nhập bằng email khác, hoặc nhờ quản trị viên thêm email này.
      </span>
    </div>
  );
}

export function HrLoginPage() {
  usePageMeta('Đăng nhập HR');
  const me = useHrMe();
  const signIn = useHrSignIn();
  const navigate = useNavigate();

  if (me.data) return <Navigate to="/hr" replace />;

  const error = signIn.error;
  const forbidden = error instanceof ApiError && error.status === 403;

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-mist text-navy lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <Brand />
      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="flex w-full max-w-[420px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="m-0 font-serif text-[30px] font-medium sm:text-[34px]">Đăng nhập</h2>
            <p className="m-0 text-[15px] leading-relaxed text-slate">
              Dùng tài khoản Google (Gmail) đã được cấp quyền HR. Không cần mật khẩu riêng.
            </p>
          </div>

          {forbidden && <NotAllowed error={error} />}
          {error && !forbidden && (
            <Notice tone="error" icon="alert">
              {errorMessage(error, 'Chưa đăng nhập được, thử lại sau ít phút.')}
            </Notice>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={signIn.isPending}
              onClick={() => signIn.mutate(undefined, { onSuccess: () => navigate('/hr', { replace: true }) })}
              className="flex min-h-14 items-center justify-center gap-3 rounded-control border border-silver bg-white text-base font-medium text-navy transition-colors hover:bg-mist disabled:opacity-60"
            >
              <GoogleMark />
              {signIn.isPending ? 'Đang đăng nhập…' : 'Đăng nhập bằng Google'}
            </button>
            {isDemo && <span className="text-xs text-muted">Bản chạy thử: bấm để vào với tài khoản HR mẫu.</span>}
          </div>

          <ul className="m-0 flex list-none flex-col gap-2.5 border-t border-line p-0 pt-[18px] text-[13px] text-slate">
            <li className="flex items-center gap-2.5">
              <Icon name="lock" size={16} stroke={1.5} className="text-accent" />
              Chỉ email trong danh sách HR mới vào được
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
