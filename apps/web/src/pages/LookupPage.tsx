import { formatDate, normalizeVietnamPhone, type LookupResponse } from '@careers/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useLookup } from '../api/queries';
import { usePageMeta } from '../lib/hooks';
import { ApplicationStage } from '../site/ApplicationStage';
import { NavyHero } from '../site/PublicLayout';
import { Button } from '../ui/Button';
import { Icon } from '../ui/icons';
import { errorText } from './candidate/candidateUi';
import { PhoneField } from '../ui/PhoneField';

/** Lookups by phone number should never show up in search engines. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

export default function LookupPage() {
  usePageMeta('Tra cứu hồ sơ', 'Xem hồ sơ bạn đã nộp tới đâu bằng số điện thoại, không cần đăng nhập.');
  useNoIndex();
  const lookup = useLookup();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<LookupResponse | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!normalizeVietnamPhone(phone)) {
      setError('Số điện thoại chưa đúng, ví dụ 0912 345 678.');
      return;
    }
    try {
      setResult(await lookup.mutateAsync(phone));
    } catch (err) {
      setError(errorText(err, 'phone', 'Chưa tra cứu được. Kiểm tra mạng rồi thử lại.'));
    }
  };

  return (
    <>
      <NavyHero waves={false}>
        <div className="mx-auto flex max-w-[1160px] flex-col gap-3 px-5 pb-14 pt-11 sm:px-6">
          <h1 className="m-0 font-serif text-[32px] font-medium sm:text-[46px]">Tra cứu hồ sơ</h1>
          <p className="m-0 max-w-[620px] text-base font-light leading-relaxed text-silver">
            Nhập số điện thoại bạn đã dùng khi nộp hồ sơ để xem hồ sơ đang tới bước nào. Không cần đăng nhập.
          </p>
        </div>
      </NavyHero>

      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-10 sm:px-5 sm:py-14">
        <form
          noValidate
          onSubmit={submit}
          className="flex flex-col gap-4 rounded-card border border-line bg-white p-5 sm:flex-row sm:items-start sm:p-6"
        >
          <PhoneField label="Số điện thoại" value={phone} error={error} onChange={setPhone} className="flex-1" />
          <Button type="submit" size="lg" icon="search" disabled={lookup.isPending} className="min-h-[52px] sm:mt-7">
            {lookup.isPending ? 'Đang tra…' : 'Tra cứu'}
          </Button>
        </form>

        {result && <Results result={result} />}

        <p className="m-0 flex items-start gap-2.5 text-[13px] leading-relaxed text-muted">
          <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Vì chỉ cần số điện thoại, trang này chỉ hiện vị trí, ngày nộp và trạng thái của hồ sơ trong 90 ngày gần đây,
            không hiện họ tên, email hay CV. Muốn xem đầy đủ, sửa hoặc xóa hồ sơ, hãy{' '}
            <Link to="/ho-so-cua-toi">đăng nhập bằng Google</Link>.
          </span>
        </p>
      </main>
    </>
  );
}

function Results({ result }: { result: LookupResponse }) {
  if (result.applications.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-5 sm:p-6"
      >
        <strong className="font-serif text-[22px] font-medium text-navy">Chưa thấy hồ sơ nào</strong>
        <span className="text-[15px] leading-relaxed text-body">
          Không có hồ sơ nào nộp bằng số này trong 90 ngày gần đây. Kiểm tra lại số, hoặc xem các vị trí đang tuyển.
        </span>
        <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium no-underline">
          Xem việc làm đang tuyển
          <Icon name="arrowRight" size={15} />
        </Link>
      </div>
    );
  }
  return (
    <section aria-label="Kết quả tra cứu" className="flex flex-col gap-3">
      <span role="status" className="text-sm text-slate">
        Tìm thấy {result.applications.length} hồ sơ
      </span>
      {result.applications.map((app) => (
        <article
          key={`${app.jobSlug}-${app.appliedOn}`}
          className="grid gap-3 rounded-card border border-line bg-white p-[18px] sm:grid-cols-[minmax(0,1fr)_300px] sm:items-center sm:gap-6 sm:px-6 sm:py-5"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted sm:text-[13px]">Nộp ngày {formatDate(app.appliedOn)}</span>
            <Link
              to={`/viec-lam/${app.jobSlug}`}
              className="font-serif text-[21px] font-medium text-navy no-underline hover:text-link sm:text-[24px]"
            >
              {app.jobTitle}
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <ApplicationStage stage={app.stage} />
          </div>
        </article>
      ))}
    </section>
  );
}
