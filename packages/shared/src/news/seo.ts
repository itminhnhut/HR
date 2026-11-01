import { foldVietnamese } from '../format.js';
import { OFFICE_PLACE } from '../home-seo.js';
import { SITE_LOGO_PATH } from '../seo.js';
import { absoluteUrl } from './images.js';
import type { NewsCardDto } from './types.js';

interface Site {
  url: string;
  companyName: string;
}

/** "2026-10-26T09:30:00+07:00": Google asks for a timezone; the site's readers are in Vietnam. */
export function vietnamIso(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return `${shifted.toISOString().slice(0, 19)}+07:00`;
}

export const newsPath = (slug: string) => `/tin-tuc/${slug}`;
export const newsCategoryPath = (slug: string) => `/tin-tuc/chuyen-muc/${slug}`;
export const newsTagPath = (slug: string) => `/tin-tuc/the/${slug}`;

/** schema.org BlogPosting for a published post (Google Article guide: all fields recommended, none required). */
export function blogPostingData(post: NewsCardDto, site: Site): Record<string, unknown> {
  const url = `${site.url}${newsPath(post.slug)}`;
  const org = { '@type': 'Organization', name: site.companyName, url: site.url };
  // Google's Article guide asks for the publisher's logo: the same raster logo as the job postings.
  const logo = { '@type': 'ImageObject', url: `${site.url}${SITE_LOGO_PATH}` };
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: post.title,
    description: post.summary,
    image: post.cover ? [absoluteUrl(site.url, post.cover.url)] : undefined,
    datePublished: vietnamIso(post.publishedAt),
    dateModified: vietnamIso(post.updatedAt),
    articleSection: post.category.name,
    keywords: post.tags.length ? post.tags.map((t) => t.name).join(', ') : undefined,
    inLanguage: 'vi',
    author: org,
    publisher: { ...org, logo },
  };
}

/** Trang chủ › Tin tức › chuyên mục › bài. */
export function newsBreadcrumbData(post: NewsCardDto, site: Site): Record<string, unknown> {
  const items = [
    { name: 'Trang chủ', url: `${site.url}/` },
    { name: 'Tin tức', url: `${site.url}/tin-tuc` },
    { name: post.category.name, url: `${site.url}${newsCategoryPath(post.category.slug)}` },
    { name: post.title, url: `${site.url}${newsPath(post.slug)}` },
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Which news list a page shows: every post, one category or one hashtag (its name without "#"). */
export type NewsListScope = { kind: 'all' } | { kind: 'category' | 'tag'; name: string };

/** Texts for the categories HR set up, by folded name; any other category gets the shared text. */
const CATEGORY_TEXT: Record<string, (company: string) => string> = {
  'tuyen dung': (company) =>
    `Tin tuyển dụng và bài viết về tuyển dụng tại ${company}: vị trí đang tuyển ở ${OFFICE_PLACE}, ` +
    'mô tả công việc, thu nhập và cách ứng tuyển.',
  'huong nghiep': (company) =>
    `Cẩm nang hướng nghiệp từ ${company}: kinh nghiệm viết CV, chuẩn bị phỏng vấn và phát triển ` +
    `nghề nghiệp cho người tìm việc ở ${OFFICE_PLACE}.`,
};

function categoryText(name: string, company: string): string {
  const key = foldVietnamese(name.trim());
  const known = CATEGORY_TEXT[key];
  if (known) return known(company);
  if (key === foldVietnamese(`Về ${company}`)) {
    return (
      `Câu chuyện về ${company}: đội ngũ, dự án đường ống và lưu chất, văn hóa làm việc và hoạt động ` +
      `nội bộ tại văn phòng ${OFFICE_PLACE}.`
    );
  }
  return (
    `Bài viết chuyên mục ${name} của ${company}: tin mới, kinh nghiệm thực tế và câu chuyện từ đội ngũ, ` +
    `giúp bạn hiểu công việc tại ${OFFICE_PLACE}.`
  );
}

/**
 * Meta description of a news list page (120–160 characters for the names in use), shared by the crawler
 * page (routes/share-news.ts in the API) and the SPA (NewsListPage).
 */
export function newsListDescription(scope: NewsListScope, company: string): string {
  if (scope.kind === 'category') return categoryText(scope.name, company);
  if (scope.kind === 'tag') {
    return (
      `Các bài viết về #${scope.name} của ${company}: tin tuyển dụng, kinh nghiệm nghề nghiệp và câu chuyện ` +
      `từ đội ngũ tại văn phòng ${OFFICE_PLACE}.`
    );
  }
  return (
    `Tin tức ${company}: tin tuyển dụng mới, cẩm nang hướng nghiệp, kinh nghiệm phỏng vấn và câu chuyện ` +
    `đời sống công ty tại văn phòng ${OFFICE_PLACE}.`
  );
}
