import { usePageMeta } from '../lib/hooks';
import { SITE } from '../lib/site';
import { NavyHero } from '../site/PublicLayout';
import { ButtonLink } from '../ui/Button';
import { IconRing, type IconName } from '../ui/icons';

const BENEFITS: [IconName, string, string][] = [
  ['money', 'Lương tháng 13', 'Cộng thưởng theo kết quả công việc.'],
  ['shield', 'Bảo hiểm đầy đủ', 'BHXH, BHYT, BHTN theo luật.'],
  ['calendar', '[Số] ngày phép năm', 'Tăng thêm theo thâm niên.'],
  ['cap', 'Đào tạo', 'Khóa học nội bộ và bên ngoài.'],
  ['mountain', 'Du lịch hằng năm', 'Cùng cả công ty.'],
  ['checkSquare', 'Khám sức khỏe định kỳ', 'Mỗi năm một lần.'],
];

const STEPS: [string, string][] = [
  ['Nộp hồ sơ online', 'Tên, số điện thoại và CV. Khoảng một phút.'],
  ['HR xem hồ sơ', 'Liên hệ qua Zalo hoặc điện thoại nếu bạn phù hợp.'],
  ['Phỏng vấn', 'Trực tiếp hoặc online với HR và quản lý.'],
  ['Nhận offer', 'Thống nhất lương và ngày bắt đầu.'],
];

export default function AboutPage() {
  usePageMeta('Về chúng tôi', `Làm việc tại ${SITE.company}: môi trường, quyền lợi và quy trình tuyển dụng.`);
  return (
    <>
      <NavyHero>
        <div className="relative mx-auto flex max-w-[1160px] flex-col gap-4 px-5 pb-16 pt-11 sm:px-6">
          <h1 className="m-0 max-w-[760px] animate-rise font-serif text-[32px] font-medium sm:text-[46px]">
            Làm việc tại {SITE.company}
          </h1>
          <p className="m-0 max-w-[560px] text-base font-light leading-relaxed text-silver sm:text-[17px]">
            [Một câu sứ mệnh ngắn: công ty làm gì và vì sao điều đó quan trọng.]
          </p>
          <ButtonLink to="/" variant="light" size="lg" icon="briefcase" className="mt-3 w-fit">
            Xem vị trí đang mở
          </ButtonLink>
        </div>
      </NavyHero>

      <main className="mx-auto flex w-full max-w-[1160px] flex-col gap-20 px-5 py-16 sm:px-6">
        <section className="grid items-center gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="m-0 font-serif text-[30px] font-medium sm:text-[36px]">Chúng tôi là ai</h2>
            <p className="m-0 text-base leading-[1.75] text-body">
              [2–3 câu giới thiệu: lĩnh vực, năm thành lập, quy mô đội ngũ, khách hàng chính.]
            </p>
            <p className="m-0 text-base leading-[1.75] text-body">[Một ngày làm việc ở đây trông như thế nào.]</p>
          </div>
          <div
            role="img"
            aria-label="Ảnh văn phòng và đội ngũ"
            className="flex h-[280px] items-center justify-center rounded-card border border-ring bg-line text-[13px] text-slate"
          >
            [Ảnh văn phòng / đội ngũ]
          </div>
        </section>

        <section className="flex flex-col gap-7">
          <h2 className="m-0 font-serif text-[30px] font-medium sm:text-[36px]">Bạn nhận được gì</h2>
          <ul className="m-0 grid list-none gap-x-8 gap-y-2 p-0 md:grid-cols-2">
            {BENEFITS.map(([icon, title, text]) => (
              <li key={title} className="flex items-start gap-4 border-b border-line py-5">
                <IconRing name={icon} size={17} />
                <div className="flex flex-col gap-1">
                  <strong className="text-[15px] font-semibold">{title}</strong>
                  <span className="text-sm text-slate">{text}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-7">
          <h2 className="m-0 font-serif text-[30px] font-medium sm:text-[36px]">Quy trình tuyển dụng</h2>
          <ol className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex flex-col gap-3 rounded-card border border-line bg-white p-6">
                <span className="flex size-10 items-center justify-center rounded-full border border-ring font-serif text-lg font-medium text-accent">
                  {i + 1}
                </span>
                <strong className="text-[15px] font-semibold">{title}</strong>
                <span className="text-sm leading-relaxed text-slate">{text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-6 rounded-card bg-navy px-8 py-10 text-white sm:px-12">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 font-serif text-[28px] font-medium sm:text-[32px]">Sẵn sàng gia nhập?</h2>
            <p className="m-0 text-[15px] text-silver">Xem vị trí đang mở và gửi hồ sơ ngay hôm nay.</p>
          </div>
          <ButtonLink to="/" variant="light" size="lg" iconRight="arrowRight">
            Xem việc làm
          </ButtonLink>
        </section>
      </main>
    </>
  );
}
