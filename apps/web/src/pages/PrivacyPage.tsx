import { Link } from 'react-router';
import { usePageMeta } from '../lib/hooks';
import { SITE } from '../lib/site';
import { NavyHero } from '../site/PublicLayout';

const SECTIONS: [string, string[]][] = [
  [
    'Thông tin chúng tôi lưu',
    [
      'Họ tên, số điện thoại (Zalo), email nếu bạn để lại, lời nhắn bạn viết.',
      'CV dạng PDF hoặc đường link CV bạn gửi.',
      'Vị trí bạn ứng tuyển và thời điểm nộp.',
    ],
  ],
  [
    'Dùng để làm gì',
    ['Xem hồ sơ và liên hệ bạn về vị trí đã nộp.', 'Báo bạn khi có vị trí mới, nếu bạn đăng ký nhận tin.'],
  ],
  [
    'Ai được xem',
    ['Chỉ bộ phận nhân sự và người phỏng vấn của vị trí đó.', 'Không bán, không chia sẻ cho công ty khác.'],
  ],
  [
    'Lưu trong bao lâu',
    [
      'Không được tuyển: xóa sau 30 ngày kể từ khi vị trí đóng.',
      'Nếu bạn tick "Giữ hồ sơ": giữ 12 tháng để báo vị trí khác, rồi tự xóa.',
      'CV được lưu riêng tư, không có đường link công khai.',
    ],
  ],
  [
    'Quyền của bạn',
    [
      'Xem lại, sửa hoặc xóa hồ sơ bất cứ lúc nào, kể cả rút lại sự đồng ý.',
      'Tự xóa trong trang Hồ sơ của tôi thì xóa ngay; gửi yêu cầu qua HR thì xử lý xong trong 20 ngày.',
      'Hủy nhận tin việc làm mới bằng một lần bấm.',
    ],
  ],
  ['Liên hệ', [`${SITE.company} · [địa chỉ]`, `Email: ${SITE.hrEmail}${SITE.hrZalo ? ` · Zalo: ${SITE.hrZalo}` : ''}`]],
];

export default function PrivacyPage() {
  usePageMeta(
    'Chính sách dữ liệu ứng viên',
    'Chúng tôi chỉ dùng thông tin bạn gửi để tuyển dụng, không bán, không chia sẻ cho bên khác.',
  );
  return (
    <>
      <NavyHero waves={false}>
        <div className="mx-auto flex max-w-[1160px] flex-col gap-3 px-5 pb-14 pt-11 sm:px-6">
          <h1 className="m-0 font-serif text-[32px] font-medium sm:text-[46px]">Chính sách dữ liệu ứng viên</h1>
          <p className="m-0 max-w-[620px] text-base font-light leading-relaxed text-silver">
            Ngắn gọn: chúng tôi chỉ dùng thông tin bạn gửi để tuyển dụng, không bán, không chia sẻ cho bên khác.
          </p>
          <span className="text-[13px] text-silver-soft">
            Phiên bản 2026-10 · theo Luật Bảo vệ dữ liệu cá nhân 2025
          </span>
        </div>
      </NavyHero>
      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-10 px-5 py-14">
        {SECTIONS.map(([title, items], i) => (
          <section key={title} className="grid grid-cols-[46px_minmax(0,1fr)] gap-5">
            <span className="flex size-[46px] items-center justify-center rounded-full border border-ring font-serif text-xl font-medium text-accent">
              {i + 1}
            </span>
            <div className="flex flex-col gap-2.5">
              <h2 className="m-0 mt-2 font-serif text-[24px] font-medium sm:text-[26px]">{title}</h2>
              <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 marker:text-silver-soft text-[15px] leading-relaxed text-body">
                {items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
        <div className="flex flex-col gap-2 rounded-card border border-line bg-white px-7 py-6">
          <strong className="font-serif text-[22px] font-medium">Muốn xem, sửa hoặc xóa hồ sơ?</strong>
          <span className="text-[15px] leading-relaxed text-body">
            Đăng nhập bằng số điện thoại đã nộp để tự xóa, hoặc nhắn HR qua email {SITE.hrEmail}.
          </span>
          <Link to="/dang-nhap" className="text-[15px] font-medium">
            Đăng nhập để quản lý hồ sơ
          </Link>
        </div>
      </main>
    </>
  );
}
