import { escapeHtml } from '@careers/shared';
import { Hono, type Context } from 'hono';
import type { Env } from '../app.js';
import { breadcrumbNav, link, renderPage, type Site } from '../lib/bot-page.js';

/**
 * "Về chúng tôi" and the privacy policy for crawlers and link previews (vercel.json sends bot user-agents here),
 * so a shared link shows the page's own title instead of the home page's. A short version of the SPA pages
 * (AboutPage.tsx, PrivacyPage.tsx); people always get the SPA.
 */
export const sharePagesRoutes = new Hono<Env>();

interface StaticPage {
  path: string;
  /** Page title without the brand, as the SPA's usePageMeta. */
  title: string;
  heading: (site: Site) => string;
  description: (site: Site) => string;
  sections: (site: Site) => [string, string[]][];
}

const ABOUT: StaticPage = {
  path: '/gioi-thieu',
  title: 'Về chúng tôi',
  heading: (site) => `Làm việc tại ${site.companyName}`,
  description: (site) => `Làm việc tại ${site.companyName}: môi trường, quyền lợi và quy trình tuyển dụng.`,
  sections: () => [
    [
      'Chúng tôi là ai',
      [
        'Công ty Cổ phần Top Flow cung cấp giải pháp đường ống và điều khiển lưu chất cho công trình hạ tầng, nhà máy, cấp nước, PCCC, HVAC và trung tâm dữ liệu.',
        'Hơn 10 năm, hơn 50 nhân sự, hơn 100 dự án ở hơn 20 tỉnh thành. Văn phòng ở Gò Vấp, TP. Hồ Chí Minh.',
      ],
    ],
    [
      'Bạn nhận được gì',
      ['Lương tháng 13', 'Bảo hiểm đầy đủ', 'Nghỉ phép năm', 'Đào tạo', 'Du lịch hằng năm', 'Khám sức khỏe định kỳ'],
    ],
    ['Quy trình tuyển dụng', ['Nộp hồ sơ online', 'HR xem hồ sơ', 'Phỏng vấn', 'Nhận offer']],
  ],
};

const PRIVACY: StaticPage = {
  path: '/chinh-sach-du-lieu',
  title: 'Chính sách dữ liệu ứng viên',
  heading: () => 'Chính sách dữ liệu ứng viên',
  description: () => 'Chúng tôi chỉ dùng thông tin bạn gửi để tuyển dụng, không bán, không chia sẻ cho bên khác.',
  sections: () => [
    ['Thông tin chúng tôi lưu', ['Họ tên, số điện thoại, email nếu bạn để lại, lời nhắn và CV bạn gửi.']],
    ['Dùng để làm gì', ['Xem hồ sơ và liên hệ bạn về vị trí đã nộp.']],
    ['Ai được xem', ['Chỉ bộ phận nhân sự và người phỏng vấn của vị trí đó. Không bán, không chia sẻ.']],
    ['Lưu trong bao lâu', ['Không được tuyển: xóa sau 30 ngày kể từ khi vị trí đóng.']],
    ['Quyền của bạn', ['Xem lại, sửa hoặc xóa hồ sơ bất cứ lúc nào, kể cả rút lại sự đồng ý.']],
  ],
};

function staticBody(site: Site, page: StaticPage): string {
  const sections = page
    .sections(site)
    .map(
      ([heading, lines]) =>
        `<section><h2>${escapeHtml(heading)}</h2><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul></section>`,
    );
  return `${breadcrumbNav([{ name: 'Trang chủ', href: `${site.url}/` }, { name: page.title }])}
<main>
<h1>${escapeHtml(page.heading(site))}</h1>
<p>${escapeHtml(page.description(site))}</p>
${sections.join('\n')}
<p>${link(`${site.url}/`, 'Xem vị trí đang mở')} · ${link(`${site.url}/tin-tuc`, 'Tin tức')} · ${link(
    `${site.url}${page === ABOUT ? PRIVACY.path : ABOUT.path}`,
    page === ABOUT ? PRIVACY.title : ABOUT.title,
  )}</p>
</main>`;
}

function staticPage(c: Context<Env>, page: StaticPage) {
  const { config } = c.get('deps');
  const site = { url: config.siteUrl, companyName: config.companyName };
  c.header('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return c.html(
    renderPage(
      site,
      { title: page.title, description: page.description(site), path: page.path, type: 'website', jsonLd: [] },
      staticBody(site, page),
    ),
  );
}

/** These paths only arrive here for crawler user-agents (see vercel.json). */
sharePagesRoutes.get(ABOUT.path, (c) => staticPage(c, ABOUT));
sharePagesRoutes.get(PRIVACY.path, (c) => staticPage(c, PRIVACY));
