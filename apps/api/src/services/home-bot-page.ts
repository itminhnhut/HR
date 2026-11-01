import {
  escapeHtml,
  formatDate,
  formatSalary,
  formatTimestamp,
  homeDescription,
  homeTitle,
  jobPath,
  newsPath,
  OFFICE_PLACE,
  shortPlace,
  siteJsonLd,
  vietnamIso,
  type JobCardDto,
  type NewsCardDto,
} from '@careers/shared';
import { link, renderPage, type Site } from '../lib/bot-page.js';
import { NEWS_INDEX_PATH } from './news-mappers.js';

/**
 * The home page for crawlers and link previews: the open jobs and the newest articles as plain links, so
 * search engines find every job from the home page without running the SPA (apps/web/src/pages/JobsPage.tsx).
 */

const ABOUT_PATH = '/gioi-thieu';

function jobItem(site: Site, job: JobCardDto): string {
  const facts = [formatSalary(job), shortPlace(job.place), `Hạn nộp ${formatDate(job.deadline)}`];
  return `<li><h3>${link(`${site.url}${jobPath(job.slug)}`, job.title)}</h3><p>${facts
    .map(escapeHtml)
    .join(' · ')}</p></li>`;
}

function jobsSection(site: Site, jobs: JobCardDto[]): string {
  const inner =
    jobs.length > 0
      ? `<ul>${jobs.map((job) => jobItem(site, job)).join('')}</ul>`
      : '<p>Hiện chưa có vị trí đang tuyển. Bạn có thể xem tin tức hoặc quay lại sau.</p>';
  return `<section><h2>Vị trí đang tuyển</h2>${inner}</section>`;
}

function newsItem(site: Site, post: NewsCardDto): string {
  return `<li>${link(`${site.url}${newsPath(post.slug)}`, post.title)} · <time datetime="${vietnamIso(
    post.publishedAt,
  )}">${formatTimestamp(post.publishedAt)}</time></li>`;
}

function newsSection(site: Site, posts: NewsCardDto[]): string {
  if (posts.length === 0) return '';
  return `<section><h2>Tin tức mới</h2><ul>${posts.map((post) => newsItem(site, post)).join('')}</ul></section>`;
}

export function homeBotPage(site: Site, jobs: JobCardDto[], posts: NewsCardDto[]): string {
  const description = homeDescription(site.companyName);
  const body = `<main>
<h1>${escapeHtml(`Việc làm tại ${site.companyName}, ${OFFICE_PLACE}`)}</h1>
<p>${escapeHtml(description)}</p>
${jobsSection(site, jobs)}
${newsSection(site, posts)}
<p>${link(`${site.url}${NEWS_INDEX_PATH}`, 'Tất cả tin tức')} · ${link(`${site.url}${ABOUT_PATH}`, 'Về chúng tôi')}</p>
</main>`;
  return renderPage(
    site,
    { title: homeTitle(site.companyName), description, path: '/', type: 'website', jsonLd: [siteJsonLd(site)] },
    body,
  );
}
