import { usePageMeta } from '../lib/hooks';
import { SITE } from '../lib/site';
import { PAGE_WIDTH, PageHero } from '../site/PageHero';
import { TextLink } from '../site/SectionHeading';

const SECTIONS: [string, string[]][] = [
  [
    'Thông tin chúng tôi lưu',
    [
      'Họ tên, số điện thoại (Zalo), email nếu bạn để lại, lời nhắn bạn viết.',
      'CV dạng PDF hoặc đường link CV bạn gửi.',
      'Vị trí bạn ứng tuyển và thời điểm nộp.',
    ],
  ],
  ['Dùng để làm gì', ['Xem hồ sơ và liên hệ bạn về vị trí đã nộp.']],
  [
    'Ai được xem',
    ['Chỉ bộ phận nhân sự và người phỏng vấn của vị trí đó.', 'Không bán, không chia sẻ cho công ty khác.'],
  ],
  [
    'Thống kê lượt xem trang',
    [
      'Trang dùng Google Analytics và Microsoft Clarity (có cookie) để đếm lượt xem, biết người xem đến từ đâu và xem trang được dùng thế nào (cuộn, bấm), nhằm cải thiện trang.',
      'Những gì bạn gõ hoặc đính kèm trong form ứng tuyển được che, không gửi họ tên, số điện thoại, email hay CV cho Google hay Microsoft. Trang HR và trang Hồ sơ của tôi không được thống kê.',
    ],
  ],
  [
    'Lưu trong bao lâu',
    [
      'Không được tuyển: xóa sau 30 ngày kể từ khi vị trí đóng.',
      'CV được lưu riêng tư, không có đường link công khai.',
    ],
  ],
  [
    'Quyền của bạn',
    [
      'Xem lại, sửa hoặc xóa hồ sơ bất cứ lúc nào, kể cả rút lại sự đồng ý.',
      'Tự xóa trong trang Hồ sơ của tôi thì xóa ngay; gửi yêu cầu qua HR thì xử lý xong trong 20 ngày.',
    ],
  ],
  [
    'Liên hệ',
    [
      `${SITE.legalName} · Trụ sở: ${SITE.headOffice}`,
      ...(SITE.hrEmail || SITE.hrZalo
        ? [
            [SITE.hrEmail && `Email: ${SITE.hrEmail}`, SITE.hrZalo && `Zalo: ${SITE.hrZalo}`]
              .filter(Boolean)
              .join(' · '),
          ]
        : []),
    ],
  ],
];

export default function PrivacyPage() {
  usePageMeta(
    'Chính sách dữ liệu ứng viên',
    'Chúng tôi chỉ dùng thông tin bạn gửi để tuyển dụng, không bán, không chia sẻ cho bên khác.',
  );
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Chính sách dữ liệu' }]}
        title="Chính sách dữ liệu ứng viên"
        intro="Ngắn gọn: chúng tôi chỉ dùng thông tin bạn gửi để tuyển dụng, không bán, không chia sẻ cho bên khác."
      >
        <span className="order-last text-[13px] text-silver-soft">
          Phiên bản 2026-10 · theo Luật Bảo vệ dữ liệu cá nhân 2025
        </span>
      </PageHero>
      <main className={`${PAGE_WIDTH} py-12 sm:py-14`}>
        <div className="flex max-w-[760px] flex-col gap-10">
          {SECTIONS.map(([title, items], i) => (
            <section key={title} className="grid grid-cols-[46px_minmax(0,1fr)] gap-5">
              <span className="flex size-[46px] items-center justify-center rounded-full border border-ring font-serif text-xl font-medium text-accent">
                {i + 1}
              </span>
              <div className="flex flex-col gap-2.5">
                <h2 className="m-0 mt-2 font-serif type-h2-sm font-medium">{title}</h2>
                <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 marker:text-silver-soft text-[15px] leading-relaxed text-body">
                  {items.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
          <div className="flex flex-col gap-2 rounded-card border border-line bg-white p-5 sm:p-6">
            <strong className="font-serif type-h2-sm font-medium">Muốn xem, sửa hoặc xóa hồ sơ?</strong>
            <span className="text-[15px] leading-relaxed text-body">
              Đăng nhập bằng Google (email bạn đã ghi khi nộp) để xem, sửa hoặc tự xóa ngay.{' '}
              {SITE.hrEmail && <>Hoặc nhắn HR qua email {SITE.hrEmail}.</>}
            </span>
            <TextLink to="/ho-so-cua-toi" className="self-start">
              Đăng nhập để quản lý hồ sơ
            </TextLink>
          </div>
        </div>
      </main>
    </>
  );
}
