import type { ArticleState, NewsImage, NewsStatus } from '@careers/shared';

/** News rows of the demo database. Shapes mirror the BE tables (spec-news.md §3). */
export interface MockNewsCategory {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface MockNewsPost {
  id: string;
  categoryId: string | null;
  title: string;
  slug: string;
  /** Set at the first publish and kept: shared links never change. */
  slugLocked: boolean;
  status: NewsStatus;
  summary: string;
  cover: NewsImage | null;
  /** Hashtag names, as HR typed them. */
  tags: string[];
  content: ArticleState | null;
  publishedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  createdAt: string;
}

/** Sample photos the demo "uploads" (no real file storage in the browser). */
export const SAMPLE_IMAGES = [
  { path: '/images/company/team-expo.jpg', width: 1200, height: 988 },
  { path: '/images/company/team-community.jpg', width: 960, height: 575 },
  { path: '/images/company/team-charity.jpg', width: 960, height: 719 },
] as const;

/** Absolute, like Blob addresses: the post schema only takes full URLs. */
export const siteOrigin = () => (typeof location !== 'undefined' ? location.origin : 'http://localhost');
const sample = (i: number, alt: string): NewsImage => ({
  url: `${siteOrigin()}${SAMPLE_IMAGES[i].path}`,
  alt,
  width: SAMPLE_IMAGES[i].width,
  height: SAMPLE_IMAGES[i].height,
});

// ── Lexical JSON, in the full form editorState.toJSON() writes ───────────

type Inline = Record<string, unknown>;
const BOLD = 1;
const ITALIC = 2;

const text = (value: string, format = 0): Inline => ({
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text: value,
  type: 'text',
  version: 1,
});
const element = (type: string, children: Inline[], extra: Inline = {}): Inline => ({
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  type,
  version: 1,
  ...extra,
});
const para = (...children: (string | Inline)[]) =>
  element(
    'paragraph',
    children.map((c) => (typeof c === 'string' ? text(c) : c)),
    { textFormat: 0, textStyle: '' },
  );
const heading = (tag: 'h2' | 'h3', value: string) => element('heading', [text(value)], { tag });
const quote = (value: string) => element('quote', [text(value)]);
const link = (url: string, value: string) =>
  element('link', [text(value)], { rel: 'noopener', target: null, title: null, url });
const list = (listType: 'bullet' | 'number', items: (string | Inline[])[]) =>
  element(
    'list',
    items.map((item, i) =>
      element('listitem', typeof item === 'string' ? [text(item)] : item, { value: i + 1, checked: undefined }),
    ),
    { listType, start: 1, tag: listType === 'bullet' ? 'ul' : 'ol' },
  );
const image = (img: NewsImage): Inline => ({
  type: 'article-image',
  version: 1,
  src: img.url,
  altText: img.alt,
  width: img.width,
  height: img.height,
});
const toc = (): Inline => ({ type: 'toc', version: 1 });
/** "Hỏi đáp": a question that opens to its answer. */
const faq = (question: string, ...answer: Inline[]) =>
  element(
    'collapsible-container',
    [element('collapsible-title', [text(question)]), element('collapsible-content', answer)],
    {
      open: false,
    },
  );
const columns = (templateColumns: string, ...items: Inline[][]) =>
  element(
    'layout-container',
    items.map((blocks) => element('layout-item', blocks)),
    { templateColumns },
  );
const doc = (...blocks: Inline[]) => ({ root: element('root', blocks) }) as unknown as ArticleState;

// ── Seed ────────────────────────────────────────────────────────────────

const CAT_LIFE = '0d6f8a52-3c1e-4b7a-9f21-5a8e7c3b1d01';
const CAT_TIPS = '7a2b9c14-6e3d-4f58-8a09-1c4d2e6f3b02';

type SeedPost = Omit<MockNewsPost, 'createdAt' | 'updatedBy' | 'slugLocked'>;

/** Two published posts (two categories) and a draft. */
function seedPosts(daysAgoIso: (days: number) => string): SeedPost[] {
  return [
    {
      id: '3c9e2f71-8b4a-4d16-a5e7-2f0b9d8c6a11',
      categoryId: CAT_TIPS,
      title: '5 điều nên chuẩn bị trước buổi phỏng vấn tại TOP FLOW',
      slug: '5-dieu-nen-chuan-bi-truoc-buoi-phong-van-tai-top-flow',
      status: 'published',
      summary: 'Tìm hiểu sản phẩm, mang theo ví dụ thực tế và chuẩn bị câu hỏi: những việc nhỏ giúp bạn tự tin hơn.',
      cover: sample(1, 'Đội ngũ TOP FLOW trong chương trình "Phát triển để phụng sự"'),
      tags: ['Phỏng vấn', 'Cẩm nang', 'Kinh doanh'],
      content: tipsContent(),
      publishedAt: daysAgoIso(2),
      updatedAt: daysAgoIso(2),
    },
    {
      id: '9a41d6e2-5f3b-4c87-b2d9-6e1a7c0f4b22',
      categoryId: CAT_LIFE,
      title: 'Một ngày làm việc của kỹ sư kinh doanh tại TOP FLOW',
      slug: 'mot-ngay-lam-viec-cua-ky-su-kinh-doanh-tai-top-flow',
      status: 'published',
      summary: '',
      cover: sample(0, 'Đội ngũ TOP FLOW tại gian hàng triển lãm'),
      tags: ['Kỹ sư', 'Kinh doanh', 'Đời sống'],
      content: dayContent(),
      publishedAt: daysAgoIso(6),
      updatedAt: daysAgoIso(5),
    },
    {
      id: 'e5b7c3a9-2d64-4f1e-9c38-7b5a1e2d0c33',
      categoryId: CAT_LIFE,
      title: 'Chuyến đi thiện nguyện Vĩnh Hy 2026',
      slug: 'chuyen-di-thien-nguyen-vinh-hy-2026',
      status: 'draft',
      summary: '',
      cover: sample(2, 'TOP FLOW trong chương trình từ thiện tại Vĩnh Hy'),
      tags: ['Thiện nguyện', 'Đời sống'],
      content: doc(
        para('Cuối tháng 9, 24 anh chị em TOP FLOW cùng gia đình đã có hai ngày ở Vĩnh Hy (Ninh Thuận).'),
        heading('h2', 'Chuẩn bị quà cho các em'),
        para('Mỗi phòng ban nhận một phần việc: gom sách vở, đóng gói, lên lịch xe…'),
      ),
      publishedAt: null,
      updatedAt: daysAgoIso(1),
    },
  ];
}

export function buildNewsSeed(daysAgoIso: (days: number) => string, hrName: string) {
  const newsCategories: MockNewsCategory[] = [
    { id: CAT_LIFE, name: 'Đời sống TOP FLOW', slug: 'doi-song-top-flow', createdAt: daysAgoIso(30) },
    { id: CAT_TIPS, name: 'Cẩm nang ứng viên', slug: 'cam-nang-ung-vien', createdAt: daysAgoIso(30) },
  ];
  const newsPosts: MockNewsPost[] = seedPosts(daysAgoIso).map((p) => ({
    ...p,
    slugLocked: p.status !== 'draft',
    updatedBy: hrName,
    createdAt: p.publishedAt ?? p.updatedAt,
  }));
  return { newsCategories, newsPosts };
}

function dayContent(): ArticleState {
  return doc(
    para(
      'Kỹ sư kinh doanh ở TOP FLOW không chỉ bán van và đường ống. Mỗi ngày là một bài toán của khách hàng: nhà máy cần thay ',
      'hệ thống cấp nước, công trình cần chọn đúng loại van điều khiển, hay xưởng cần giảm rò rỉ khí nén.',
    ),
    heading('h2', 'Buổi sáng: họp nhanh và lên lịch gặp khách'),
    para(
      '8 giờ, cả nhóm họp 15 phút tại văn phòng Gò Vấp. Mỗi người nói ',
      text('một việc quan trọng nhất', BOLD),
      ' trong ngày và việc cần đồng đội hỗ trợ. Sau đó là giờ gọi điện, gửi báo giá và xếp lịch đi công trình.',
    ),
    list('bullet', [
      'Kiểm tra đơn hàng và tiến độ giao hàng trên hệ thống.',
      'Chuẩn bị bản vẽ, thông số kỹ thuật cho buổi gặp khách.',
      [text('Hỏi ý kiến '), text('kỹ sư ứng dụng', ITALIC), text(' khi gặp yêu cầu lạ.')],
    ]),
    heading('h2', 'Buổi chiều: ra công trình'),
    para(
      'Phần lớn buổi chiều là đi khảo sát. Bạn được đi cùng người hướng dẫn trong hai tháng đầu, ',
      'nên không ai phải "tự bơi" khi mới vào.',
    ),
    image(sample(2, 'Anh chị em TOP FLOW trong một buổi sinh hoạt chung')),
    heading('h3', 'Điều mọi người thích nhất'),
    quote('Mỗi công trình xong là thấy rõ mình đã giúp khách hàng tiết kiệm được gì. Cảm giác đó rất đáng.'),
    para(
      'Nếu bạn thích công việc vừa kỹ thuật vừa gặp gỡ con người, xem ',
      link('/', 'các vị trí đang tuyển'),
      ' và gửi CV trong khoảng một phút.',
    ),
  );
}

function tipsContent(): ArticleState {
  return doc(
    para(
      'Buổi phỏng vấn ở TOP FLOW thường kéo dài 45–60 phút, gồm phần trò chuyện với HR và trưởng nhóm. ',
      'Dưới đây là năm việc nhỏ giúp bạn tự tin hơn.',
    ),
    toc(),
    heading('h2', 'Năm điều nên chuẩn bị'),
    list('number', [
      [text('Tìm hiểu sản phẩm: ', BOLD), text('van, đường ống, thiết bị điều khiển lưu chất.')],
      [text('Mang theo ví dụ thực tế ', BOLD), text('về một việc bạn đã làm tốt và một lần bạn mắc lỗi.')],
      'Đọc kỹ mô tả công việc, đánh dấu chỗ bạn chưa rõ.',
      'Chuẩn bị 2–3 câu hỏi về nhóm và lộ trình thử việc.',
      'Đến sớm 10 phút, văn phòng ở Gò Vấp có chỗ gửi xe máy.',
    ]),
    heading('h2', 'Mang theo gì?'),
    columns(
      '1fr 1fr',
      [heading('h3', 'Giấy tờ'), list('bullet', ['CCCD bản gốc', 'CV in sẵn (nếu có)'])],
      [
        heading('h3', 'Tinh thần'),
        para('Một câu hỏi bạn thật sự muốn biết về công việc. Phần còn lại cứ là chính mình.'),
      ],
    ),
    heading('h2', 'Sau buổi phỏng vấn'),
    para('HR sẽ báo kết quả trong vòng 5 ngày làm việc. Bạn có thể tra cứu tình trạng hồ sơ bằng số điện thoại.'),
    heading('h2', 'Câu hỏi thường gặp'),
    faq(
      'Chưa có kinh nghiệm có ứng tuyển được không?',
      para('Được. Nhiều vị trí có đào tạo từ đầu trong hai tháng đầu.'),
    ),
    faq('Phỏng vấn trực tuyến được không?', para('Được, HR sẽ gửi link Google Meet nếu bạn ở xa.')),
  );
}
