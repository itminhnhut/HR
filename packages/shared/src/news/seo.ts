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
    publisher: org,
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
