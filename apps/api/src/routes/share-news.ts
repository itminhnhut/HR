import {
  absoluteUrl,
  blogPostingData,
  escapeHtml,
  formatTimestamp,
  newsBreadcrumbData,
  newsCategoryPath,
  newsPath,
  newsTagPath,
  vietnamIso,
  type NewsCardDto,
  type NewsListResponse,
  type NewsPostDto,
} from '@careers/shared';
import { Hono, type Context } from 'hono';
import type { Env } from '../app.js';
import { absoluteImageHtml } from '../lib/absolute-images.js';
import { link, meta, notFoundHtml, renderPage, type Head, type Site } from '../lib/bot-page.js';
import { HttpError } from '../lib/http-error.js';
import { getPublicNews, newsQuerySchema, queryPublicNews } from '../services/news-public.js';
import { NEWS_INDEX_PATH } from '../services/news-mappers.js';
import { TAG_INDEX_MIN_POSTS } from '../services/news-tags.js';
import { NEWS_CACHE_CONTROL } from './public-news.js';

/**
 * News pages for crawlers and link previews. vercel.json sends bot user-agents asking for /tin-tuc… here;
 * people get the SPA, which shows the same article HTML (both come from renderArticle in @careers/shared).
 */
export const shareNewsRoutes = new Hono<Env>();

function notFoundPage(c: Context<Env>) {
  const back = { href: `${c.get('deps').config.siteUrl}${NEWS_INDEX_PATH}`, text: 'Xem tin tức' };
  return c.html(notFoundHtml(back), 404);
}

const siteOf = (c: Context<Env>): Site => ({
  url: c.get('deps').config.siteUrl,
  companyName: c.get('deps').config.companyName,
});

/** The site pages its lists with ?trang=N (NewsListPage); page 1 has no parameter. */
const pagePath = (basePath: string, n: number) => (n > 1 ? `${basePath}?trang=${n}` : basePath);

function cardHtml(site: Site, post: NewsCardDto): string {
  const href = `${site.url}${newsPath(post.slug)}`;
  const cover = post.cover
    ? `<img src="${escapeHtml(absoluteUrl(site.url, post.cover.url))}" alt="${escapeHtml(post.cover.alt)}" width="${post.cover.width}" height="${post.cover.height}" loading="lazy">`
    : '';
  return `<li><article>${cover}<h2>${link(href, post.title)}</h2><p>${escapeHtml(post.summary)}</p><p>${link(
    `${site.url}${newsCategoryPath(post.category.slug)}`,
    post.category.name,
  )} · <time datetime="${vietnamIso(post.publishedAt)}">${formatTimestamp(post.publishedAt)}</time></p></article></li>`;
}

interface Crumb {
  name: string;
  item: string;
}

/** Breadcrumb for a list page: Trang chủ › Tin tức (› chuyên mục or #hashtag). */
function listBreadcrumb(site: Site, last: Crumb): Record<string, unknown> {
  const items = [
    { name: 'Trang chủ', item: `${site.url}/` },
    { name: 'Tin tức', item: `${site.url}${NEWS_INDEX_PATH}` },
    last,
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })),
  };
}

/** What a list page is about: every post, one category or one hashtag. */
interface ListScope {
  heading: string;
  description: string;
  basePath: string;
  crumb: Crumb | null;
}

function listScope(site: Site, list: NewsListResponse): ListScope {
  if (list.tag) {
    const heading = `#${list.tag.name}`;
    const basePath = newsTagPath(list.tag.slug);
    return {
      heading,
      description: `Bài viết gắn hashtag ${heading} của ${site.companyName}.`,
      basePath,
      crumb: { name: heading, item: `${site.url}${basePath}` },
    };
  }
  if (list.category) {
    const basePath = newsCategoryPath(list.category.slug);
    return {
      heading: list.category.name,
      description: `Bài viết chuyên mục ${list.category.name} của ${site.companyName}.`,
      basePath,
      crumb: { name: list.category.name, item: `${site.url}${basePath}` },
    };
  }
  return {
    heading: 'Tin tức',
    description: `Tin tức, đời sống và cẩm nang nghề nghiệp từ ${site.companyName}.`,
    basePath: NEWS_INDEX_PATH,
    crumb: null,
  };
}

function pagination(site: Site, basePath: string, list: NewsListResponse): { links: string[]; nav: string } {
  const pathFor = (n: number) => pagePath(basePath, n);
  const prev = list.page > 1 ? pathFor(list.page - 1) : null;
  const next = list.page < list.pageCount ? pathFor(list.page + 1) : null;
  const links = [
    ...(prev ? [`<link rel="prev" href="${escapeHtml(site.url + prev)}">`] : []),
    ...(next ? [`<link rel="next" href="${escapeHtml(site.url + next)}">`] : []),
  ];
  const nav = [prev ? link(site.url + prev, 'Trang trước') : '', next ? link(site.url + next, 'Trang sau') : '']
    .filter(Boolean)
    .join(' · ');
  return { links, nav: nav ? `<nav>${nav}</nav>` : '' };
}

async function listPage(c: Context<Env>, filter: { category?: string; tag?: string }) {
  const query = newsQuerySchema.parse({ page: c.req.query('trang'), ...filter });
  const { list, total } = await queryPublicNews(c.get('deps').db, query);
  if (query.page > list.pageCount) return notFoundPage(c);
  const site = siteOf(c);
  const scope = listScope(site, list);
  const { links, nav } = pagination(site, scope.basePath, list);
  const categories = list.categories.map(
    (cat) => `<li>${link(`${site.url}${newsCategoryPath(cat.slug)}`, cat.name)}</li>`,
  );
  const head: Head = {
    title: query.page > 1 ? `${scope.heading} – trang ${query.page}` : scope.heading,
    description: scope.description,
    path: pagePath(scope.basePath, query.page),
    type: 'website',
    image: list.posts[0]?.cover,
    extra: links,
    jsonLd: scope.crumb ? [listBreadcrumb(site, scope.crumb)] : [],
    robots: list.tag && total < TAG_INDEX_MIN_POSTS ? 'noindex, follow' : undefined,
  };
  const body = `<nav>${link(`${site.url}/`, 'Trang chủ')} › ${link(`${site.url}${NEWS_INDEX_PATH}`, 'Tin tức')}</nav>
<h1>${escapeHtml(scope.heading)}</h1>
<ul>${categories.join('')}</ul>
<ul>${list.posts.map((post) => cardHtml(site, post)).join('')}</ul>
${nav}`;
  c.header('cache-control', NEWS_CACHE_CONTROL);
  return c.html(renderPage(site, head, body));
}

function articleBody(site: Site, post: NewsPostDto): string {
  const toc = post.headings.map(
    (h) => `<li class="h${h.level}"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`,
  );
  const cover = post.cover
    ? `<img src="${escapeHtml(absoluteUrl(site.url, post.cover.url))}" alt="${escapeHtml(post.cover.alt)}" width="${post.cover.width}" height="${post.cover.height}">`
    : '';
  const related = post.related.map((r) => `<li>${link(`${site.url}${newsPath(r.slug)}`, r.title)}</li>`);
  const tags = post.tags.map((tag) => link(`${site.url}${newsTagPath(tag.slug)}`, `#${tag.name}`));
  return `<nav>${link(`${site.url}/`, 'Trang chủ')} › ${link(`${site.url}${NEWS_INDEX_PATH}`, 'Tin tức')} › ${link(
    `${site.url}${newsCategoryPath(post.category.slug)}`,
    post.category.name,
  )}</nav>
<article>
<h1>${escapeHtml(post.title)}</h1>
<p><time datetime="${vietnamIso(post.publishedAt)}">${formatTimestamp(post.publishedAt)}</time> · ${post.readingMinutes} phút đọc</p>
${cover}
${toc.length > 0 ? `<nav><h2>Nội dung bài viết</h2><ul>${toc.join('')}</ul></nav>` : ''}
${absoluteImageHtml(site.url, post.html)}
${tags.length > 0 ? `<p>${tags.join(' ')}</p>` : ''}
</article>
${related.length > 0 ? `<section><h2>Bài liên quan</h2><ul>${related.join('')}</ul></section>` : ''}
<p>${link(`${site.url}${NEWS_INDEX_PATH}`, 'Xem tất cả tin tức')}</p>`;
}

async function articlePage(c: Context<Env>, slug: string) {
  const post = await getPublicNews(c.get('deps').db, slug);
  const site = siteOf(c);
  const head: Head = {
    title: post.title,
    description: post.summary,
    path: newsPath(post.slug),
    type: 'article',
    image: post.cover,
    extra: [
      meta('property', 'article:published_time', vietnamIso(post.publishedAt)),
      meta('property', 'article:modified_time', vietnamIso(post.updatedAt)),
      meta('property', 'article:section', post.category.name),
    ],
    jsonLd: [blogPostingData(post, site), newsBreadcrumbData(post, site)],
  };
  c.header('cache-control', NEWS_CACHE_CONTROL);
  return c.html(renderPage(site, head, articleBody(site, post)));
}

/** Unknown and unpublished pages answer an HTML 404 (crawlers drop them), not the API's JSON one. */
async function orNotFoundPage(c: Context<Env>, render: () => Promise<Response>): Promise<Response> {
  try {
    return await render();
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return notFoundPage(c);
    throw error;
  }
}

/**
 * Old list addresses used ?page=N: one address per page, so they move to ?trang=N for good. Other query
 * parameters (tracking) are dropped, as the canonical drops them.
 */
function oldPageAddress(c: Context<Env>): Response | null {
  const old = c.req.query('page');
  if (old === undefined || c.req.query('trang') !== undefined) return null;
  const n = Math.max(1, Math.trunc(Number(old)) || 1);
  return c.redirect(`${c.get('deps').config.siteUrl}${pagePath(c.req.path, n)}`, 301);
}

const listRoute = (c: Context<Env>, filter: { category?: string; tag?: string }) =>
  oldPageAddress(c) ?? orNotFoundPage(c, () => listPage(c, filter));

/** These paths only arrive here for crawler user-agents (see vercel.json). */
shareNewsRoutes.get(NEWS_INDEX_PATH, (c) => listRoute(c, {}));
shareNewsRoutes.get('/tin-tuc/chuyen-muc/:slug', (c) => listRoute(c, { category: c.req.param('slug') }));
shareNewsRoutes.get('/tin-tuc/the/:slug', (c) => listRoute(c, { tag: c.req.param('slug') }));
shareNewsRoutes.get('/tin-tuc/:slug', (c) => orNotFoundPage(c, () => articlePage(c, c.req.param('slug'))));
