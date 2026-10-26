import {
  EMPLOYMENT_TYPE_LABEL,
  escapeHtml,
  formatDate,
  formatSalary,
  isListed,
  JOB_SECTION,
  jobBreadcrumbData,
  jobPath,
  jobPostingData,
  NO_REQUIREMENT,
  OFFICE,
  placeLabel,
  ROADMAP_MILESTONES,
  type JobCardDto,
  type JobDetailDto,
} from '@careers/shared';
import { breadcrumbNav, link, renderPage, type Site } from '../lib/bot-page.js';

/**
 * The job page for crawlers and link previews: the same sections and headings as the site's JobPage
 * (apps/web/src/pages/JobPage.tsx), so what Google indexes is what people see.
 */

const list = (lines: string[]) => `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
const section = (heading: string, inner: string) => `<section><h2>${escapeHtml(heading)}</h2>${inner}</section>`;

function factsHtml(job: JobDetailDto): string {
  const facts: [string, string | null][] = [
    ['Mức lương', formatSalary(job)],
    ['Kinh nghiệm', job.experience],
    ['Hình thức', EMPLOYMENT_TYPE_LABEL[job.employmentType]],
    ['Học vấn', job.education === NO_REQUIREMENT ? null : job.education],
    ['Hạn nộp', formatDate(job.deadline)],
    ['Nơi làm việc', job.address ?? `Văn phòng công ty, ${OFFICE.district}, ${OFFICE.city}`],
    ['Giờ làm', job.workingHours],
  ];
  return `<dl>${facts
    .filter((fact): fact is [string, string] => !!fact[1])
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join('')}</dl>`;
}

function roadmapHtml(items: string[]): string {
  const steps = ROADMAP_MILESTONES.map((when, i) => [when, items[i] ?? ''] as const).filter(([, text]) => text);
  if (steps.length === 0) return '';
  const inner = steps.map(([when, text]) => `<li><h3>${escapeHtml(when)}</h3><p>${escapeHtml(text)}</p></li>`);
  return section('Lộ trình 2 tháng thử việc', `<ol>${inner.join('')}</ol>`);
}

function similarHtml(site: Site, jobs: JobCardDto[], heading: string): string {
  if (jobs.length === 0) return '';
  const items = jobs.map(
    (job) =>
      `<li>${link(`${site.url}${jobPath(job.slug)}`, job.title)} · ${escapeHtml(formatSalary(job))} · ${escapeHtml(job.place)}</li>`,
  );
  return section(heading, `<ul>${items.join('')}</ul>`);
}

function openJobSections(job: JobDetailDto): string {
  return [
    job.responsibilities.length > 0 ? section(JOB_SECTION.responsibilities, list(job.responsibilities)) : '',
    job.requirements.length > 0 ? section(JOB_SECTION.requirements, list(job.requirements)) : '',
    job.preferred.length > 0 ? section(JOB_SECTION.preferred, list(job.preferred)) : '',
    job.benefits.length > 0 ? section(JOB_SECTION.benefits, list(job.benefits)) : '',
    roadmapHtml(job.roadmap),
    section('Nơi bạn sẽ làm việc', `<p>${escapeHtml(job.address ?? placeLabel(null))}</p>`),
  ].join('\n');
}

function bodyHtml(site: Site, job: JobDetailDto, similar: JobCardDto[], summary: string): string {
  const url = `${site.url}${jobPath(job.slug)}`;
  const listed = isListed(job.status);
  return `${breadcrumbNav([{ name: 'Việc làm', href: `${site.url}/` }, { name: job.title }])}
<main>
<h1>${escapeHtml(job.title)}</h1>
<p>${escapeHtml(summary)}</p>
${factsHtml(job)}
${listed ? openJobSections(job) : section('Vị trí này đã ngừng nhận hồ sơ', '<p>Các vị trí đang tuyển ở bên dưới.</p>')}
${listed ? `<p>${link(url, 'Ứng tuyển ngay')}</p>` : ''}
${similarHtml(site, similar, listed ? 'Việc làm tương tự' : 'Vị trí tương tự đang tuyển')}
<p>${link(`${site.url}/`, 'Xem tất cả việc làm')}</p>
</main>`;
}

export function jobBotPage(site: Site, job: JobDetailDto, similar: JobCardDto[]): string {
  const listed = isListed(job.status);
  const summary = `${formatSalary(job)} · ${placeLabel(job.address)} · ${EMPLOYMENT_TYPE_LABEL[job.employmentType]} · Hạn nộp ${formatDate(job.deadline)}`;
  const org = { name: site.companyName, url: site.url };
  return renderPage(
    site,
    {
      title: job.title,
      // BR-05: a closed job keeps its page; BR-16: but drops out of Google for Jobs.
      description: listed ? summary : `Vị trí này đã ngừng nhận hồ sơ. ${summary}`,
      path: jobPath(job.slug),
      type: 'website',
      robots: listed ? undefined : 'noindex, follow',
      jsonLd: listed ? [jobPostingData(job, org), jobBreadcrumbData(job, org)] : [jobBreadcrumbData(job, org)],
    },
    bodyHtml(site, job, similar, summary),
  );
}
