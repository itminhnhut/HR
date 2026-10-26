import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { isDemo } from '../../api';
import { DEMO_CANDIDATE_EMAIL } from '../../api/demo-accounts';
import { useCandidate, useGoogleSignIn } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { Breadcrumbs } from '../../site/Breadcrumbs';
import { NavyHero } from '../../site/NavyHero';
import { PAGE_WIDTH } from '../../site/PageHero';
import { FieldError } from '../../ui/Field';
import { Icon } from '../../ui/icons';
import { errorText, safeNextPath } from './candidateUi';

const PERKS = ['Xem trạng thái mọi hồ sơ đã nộp', 'Lưu CV, lần sau nộp không cần nhập lại', 'Tự xoá dữ liệu của mình'];

export function CandidateLoginPage() {
  usePageMeta(
    'Hồ sơ của tôi',
    'Đăng nhập bằng Google để theo dõi hồ sơ đã nộp bằng email đó. Không bắt buộc khi ứng tuyển.',
  );
  const candidate = useCandidate();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('tiep'));
  const googleSignIn = useGoogleSignIn();
  const [error, setError] = useState('');

  // Already signed in (or just finished signing in): go straight on.
  if (candidate.data) return <Navigate to={next} replace />;

  const startGoogle = async () => {
    setError('');
    try {
      await googleSignIn.mutateAsync();
      await candidate.refetch();
      navigate(next, { replace: true });
    } catch (e) {
      setError(errorText(e, null, 'Chưa đăng nhập được bằng Google. Thử lại sau ít phút.'));
    }
  };

  return (
    <NavyHero waves={false} className="flex flex-1 flex-col [&>header]:w-full">
      <div className={`relative ${PAGE_WIDTH} pt-3 sm:pt-5`}>
        <Breadcrumbs items={[{ label: 'Hồ sơ của tôi' }]} />
      </div>
      <main className="relative grid flex-1 md:min-h-[700px] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-cols-[minmax(560px,calc((100vw-1160px)/2+560px))_minmax(0,1fr)]">
        <section className="relative flex flex-col gap-7 overflow-hidden px-5 pb-10 pt-4 sm:px-6 md:px-10 md:py-14 lg:p-14 lg:pl-[max(1.5rem,calc((100vw-1160px)/2+1.5rem))]">
          <PanelWaves />
          <div className="stagger relative flex flex-col gap-5 md:my-auto md:gap-[22px]">
            <h1 className="m-0 font-serif type-h1 font-medium">Theo dõi hồ sơ của bạn</h1>
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0 text-[15px] text-silver">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-center gap-3">
                  <Icon name="check" size={16} stroke={1.8} className="shrink-0 text-white" />
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
            <div className="flex flex-col gap-2">
              <h2 className="m-0 font-serif type-h2 font-medium">Đăng nhập</h2>
              <p className="m-0 text-[15px] leading-relaxed text-slate">
                Dùng tài khoản Google có email bạn đã ghi khi nộp hồ sơ, các hồ sơ đó sẽ tự hiện ra.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void startGoogle()}
              disabled={googleSignIn.isPending}
              className="flex min-h-[52px] items-center justify-center gap-3 rounded-control border border-silver bg-white text-[15px] font-medium text-navy transition-colors hover:bg-hover disabled:opacity-60"
            >
              <GoogleMark />
              {googleSignIn.isPending ? 'Đang mở Google…' : 'Tiếp tục với Google'}
            </button>
            <FieldError>{error}</FieldError>
            {isDemo && (
              <span className="text-xs text-muted">Bản chạy thử: vào tài khoản mẫu {DEMO_CANDIDATE_EMAIL}.</span>
            )}
            <Link to="/" className="inline-flex min-h-11 items-center self-start text-sm">
              Về trang việc làm
            </Link>
          </div>
        </section>
      </main>
    </NavyHero>
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
