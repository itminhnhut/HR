import { COLOR_CLASSES, type CategoryColor } from '../lib/colors';
import { usePageMeta } from '../lib/hooks';
import { SITE } from '../lib/site';
import { Band } from '../site/Band';
import { Waves } from '../site/NavyHero';
import { NewsTeaser } from '../site/news/NewsTeaser';
import { PageHero } from '../site/PageHero';
import { SectionHeading } from '../site/SectionHeading';
import { ButtonLink } from '../ui/Button';
import { IconRing, type IconName } from '../ui/icons';

/** Each benefit has its own colour from the category set, so the list reads at a glance. */
const BENEFITS: [IconName, CategoryColor, string, string][] = [
  ['money', 'emerald', 'Lương tháng 13', 'Cộng thưởng theo kết quả công việc.'],
  ['shield', 'blue', 'Bảo hiểm đầy đủ', 'BHXH, BHYT, BHTN theo luật.'],
  ['calendar', 'violet', 'Nghỉ phép năm', 'Theo Luật Lao động, tăng thêm theo thâm niên.'],
  ['cap', 'amber', 'Đào tạo', 'Khóa học nội bộ và bên ngoài.'],
  ['mountain', 'teal', 'Du lịch hằng năm', 'Cùng cả công ty.'],
  ['checkSquare', 'rose', 'Khám sức khỏe định kỳ', 'Mỗi năm một lần.'],
];

const ringTone = (color: CategoryColor) => {
  const c = COLOR_CLASSES[color];
  return `${c.line} ${c.soft} ${c.text}`;
};

const STEPS: [string, string][] = [
  ['Nộp hồ sơ online', 'Tên, số điện thoại và CV. Khoảng một phút.'],
  ['HR xem hồ sơ', 'Liên hệ qua Zalo hoặc điện thoại nếu bạn phù hợp.'],
  ['Phỏng vấn', 'Trực tiếp hoặc online với HR và quản lý.'],
  ['Nhận offer', 'Thống nhất lương và ngày bắt đầu.'],
];

/** What the company does, next to a team photo. */
function WhoWeAre() {
  return (
    <section className="grid items-center gap-10 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <SectionHeading title="Chúng tôi là ai" />
        <p className="m-0 text-base leading-[1.75] text-body">
          {SITE.legalName} cung cấp giải pháp đường ống và điều khiển lưu chất cho các công trình hạ tầng, nhà máy, cấp
          nước, PCCC, HVAC và trung tâm dữ liệu. Chúng tôi là đại diện chính hãng của nhiều thương hiệu van, đồng hồ
          nước, khớp nối và thiết bị lọc quốc tế.
        </p>
        <p className="m-0 text-base leading-[1.75] text-body">
          Sau hơn 10 năm, đội ngũ 50+ nhân sự đã cùng khách hàng làm hơn 100 dự án ở hơn 20 tỉnh thành. Văn phòng làm
          việc ở {SITE.office}, {SITE.officeHours}.
        </p>
      </div>
      {/* The largest picture of the page (its LCP on desktop): loaded first, with its size reserved. */}
      <img
        src="/images/company/team-expo.jpg"
        alt="Đội ngũ TOP FLOW tại gian hàng triển lãm"
        width={1200}
        height={988}
        fetchPriority="high"
        decoding="async"
        className="h-[280px] w-full rounded-card border border-ring bg-line object-cover"
      />
    </section>
  );
}

/** Benefits, two columns from md. */
function BenefitsSection() {
  return (
    <section className="flex flex-col gap-7">
      <SectionHeading title="Bạn nhận được gì" />
      <ul className="m-0 grid list-none gap-x-8 gap-y-2 p-0 md:grid-cols-2">
        {BENEFITS.map(([icon, color, title, text]) => (
          <li key={title} className="flex items-start gap-4 border-b border-ring py-5">
            <IconRing name={icon} size={16} tone={ringTone(color)} />
            <div className="flex flex-col gap-1">
              <strong className="text-[15px] font-semibold">{title}</strong>
              <span className="text-sm text-slate">{text}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The four hiring steps, numbered. */
function StepsSection() {
  return (
    <section className="flex flex-col gap-7">
      <SectionHeading title="Quy trình tuyển dụng" />
      <ol className="stagger m-0 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="flex flex-col gap-3 rounded-card border border-line bg-white p-5 sm:p-6">
            <span className="flex size-10 items-center justify-center rounded-full border border-brand-line bg-brand-soft font-serif text-lg font-medium text-brand">
              {i + 1}
            </span>
            <strong className="text-[15px] font-semibold">{title}</strong>
            <span className="text-sm leading-relaxed text-slate">{text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Both calls to action on this page go to the jobs board, so they are the same button. */
function OpenJobsButton() {
  return (
    <ButtonLink to="/" variant="brand" size="lg" icon="briefcase" className="relative">
      Xem vị trí đang mở
    </ButtonLink>
  );
}

export default function AboutPage() {
  usePageMeta('Về chúng tôi', `Làm việc tại ${SITE.company}: môi trường, quyền lợi và quy trình tuyển dụng.`);
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Về chúng tôi' }]}
        eyebrow="Về chúng tôi"
        title={`Làm việc tại ${SITE.company}`}
        intro="“Phát triển để phụng sự”: hợp sức kiến tạo nền móng hạ tầng bền vững cho các công trình, nhà máy và thành phố Việt Nam."
        actions={<OpenJobsButton />}
      />

      {/* Full-width stripes: white, tint, white, then company life on the brand tint. */}
      <main className="flex flex-col">
        <Band tone="white">
          <WhoWeAre />
        </Band>
        <Band tone="tint">
          <BenefitsSection />
        </Band>
        <Band tone="white">
          <StepsSection />
        </Band>
        <NewsTeaser />
        <Band tone="plain">
          <JoinBand />
        </Band>
      </main>
    </>
  );
}

/** "Sẵn sàng gia nhập?": a small navy band like the hero, with the page's red button. */
function JoinBand() {
  return (
    <section className="relative flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-card bg-navy px-6 py-10 text-white sm:px-12">
      <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0" />
      <Waves className="opacity-70" />
      <div className="relative flex flex-col gap-1.5">
        <h2 className="m-0 font-serif type-h2 font-medium">Sẵn sàng gia nhập?</h2>
        <p className="m-0 text-[15px] text-silver">Xem vị trí đang mở và gửi hồ sơ ngay hôm nay.</p>
      </div>
      <OpenJobsButton />
    </section>
  );
}
