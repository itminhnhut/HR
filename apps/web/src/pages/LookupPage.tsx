import { formatDate, normalizeVietnamPhone, type LookupResponse } from '@careers/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useLookup } from '../api/queries';
import { useNoIndex, usePageMeta } from '../lib/hooks';
import { ApplicationStage } from '../site/ApplicationStage';
import { PAGE_WIDTH, PageHero } from '../site/PageHero';
import { TextLink } from '../site/SectionHeading';
import { Button } from '../ui/Button';
import { Icon } from '../ui/icons';
import { errorText } from './candidate/candidateUi';
import { PhoneField } from '../ui/PhoneField';
import { Captcha, CaptchaError, useCaptcha } from '../ui/Captcha';

/** Lookups by phone number should never show up in search engines. */

export default function LookupPage() {
  usePageMeta('Tra cứu hồ sơ', 'Xem hồ sơ bạn đã nộp tới đâu bằng số điện thoại, không cần đăng nhập.');
  useNoIndex();
  const lookup = useLookup();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<LookupResponse | null>(null);
  const captcha = useCaptcha();
  const [waiting, setWaiting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!normalizeVietnamPhone(phone)) {
      setError(phone.trim() ? 'Số điện thoại chưa đúng, cần 10 số, ví dụ 0912 345 678.' : 'Nhập số điện thoại.');
      return;
    }
    setWaiting(true);
    try {
      // Waits for the background "not a robot" check if it has not finished yet.
      const captchaToken = await captcha.getToken();
      // Each token works once: the next lookup needs a fresh one. Without a token the box stays as it is,
      // so a visitor asked to click it still sees it.
      captcha.renew();
      setResult(await lookup.mutateAsync({ phone, captchaToken }));
    } catch (err) {
      setError(
        err instanceof CaptchaError
          ? err.message
          : errorText(err, 'phone', '') || errorText(err, 'captcha', 'Chưa tra cứu được. Kiểm tra mạng rồi thử lại.'),
      );
    } finally {
      setWaiting(false);
    }
  };

  return (
    <>
      <PageHero
        crumbs={[{ label: 'Tra cứu hồ sơ' }]}
        title="Tra cứu hồ sơ"
        intro="Nhập số điện thoại bạn đã dùng khi nộp hồ sơ để xem hồ sơ đang tới bước nào. Không cần đăng nhập."
      />

      <main className={`${PAGE_WIDTH} py-10 sm:py-14`}>
        <div className="flex max-w-[760px] flex-col gap-6">
          <form
            noValidate
            onSubmit={submit}
            // The anti-spam check loads on the first focus of the form, not with the page.
            onFocus={captcha.arm}
            className="flex flex-col gap-4 rounded-card border border-line bg-white p-5 sm:flex-row sm:flex-wrap sm:items-start sm:p-6"
          >
            <PhoneField
              label="Số điện thoại"
              value={phone}
              error={error || undefined}
              onChange={setPhone}
              hint="Ví dụ 0912 345 678."
              className="flex-1"
            />
            <Button type="submit" size="lg" icon="search" disabled={waiting} className="sm:mt-7">
              {waiting ? 'Đang tra…' : 'Tra cứu'}
            </Button>
            <div className="sm:basis-full">
              <Captcha control={captcha} />
            </div>
          </form>

          {result && <Results result={result} />}

          <p className="m-0 flex items-start gap-2.5 text-[13px] leading-relaxed text-muted">
            <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              Vì chỉ cần số điện thoại, trang này chỉ hiện vị trí, ngày nộp và trạng thái của hồ sơ trong 90 ngày gần
              đây, không hiện họ tên, email hay CV. Muốn xem đầy đủ, sửa hoặc xóa hồ sơ, hãy{' '}
              <Link to="/ho-so-cua-toi" className="font-medium">
                đăng nhập bằng Google
              </Link>
              .
            </span>
          </p>
        </div>
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
        <strong className="font-serif type-h2-sm font-medium text-navy">Chưa thấy hồ sơ nào</strong>
        <span className="text-[15px] leading-relaxed text-body">
          Không có hồ sơ nào nộp bằng số này trong 90 ngày gần đây. Kiểm tra lại số, hoặc xem các vị trí đang tuyển.
        </span>
        <TextLink to="/">Xem việc làm đang tuyển</TextLink>
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
            <span className="text-[13px] text-muted">Nộp ngày {formatDate(app.appliedOn)}</span>
            <Link
              to={`/viec-lam/${app.jobSlug}`}
              className="font-serif type-card font-medium text-navy no-underline hover:text-link"
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
