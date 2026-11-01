import { foldVietnamese, hasSalary } from './format.js';
import { jobLocation } from './job-location.js';
import { NO_REQUIREMENT } from './job-template.js';
import { escapeHtml } from './news/render.js';
import type { JobDetailDto, JobSection } from './types.js';

/** The company's main website (sameAs of the hiring organisation; the careers site is its own url). */
export const COMPANY_WEBSITE = 'https://topflow.vn';
/** 512 px square PNG in apps/web/public, made from favicon.svg: Google wants a raster logo. */
export const SITE_LOGO_PATH = '/images/logo-512.png';
/** Default share image (1200×630) in apps/web/public. */
export const SHARE_IMAGE = { path: '/images/og-share.jpg', width: 1200, height: 630 } as const;

interface Org {
  name: string;
  url: string;
}

const GOOGLE_EMPLOYMENT_TYPE = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  internship: 'INTERN',
} as const;

/** "Tin tức · TOP FLOW"; a title that already names the brand is left as it is. */
export function pageTitle(title: string, brand: string): string {
  return foldVietnamese(title).includes(foldVietnamese(brand)) ? title : `${title} · ${brand}`;
}

export const jobPath = (slug: string) => `/viec-lam/${slug}`;

/** Section headings of a job page, shared by the site, the crawler page and the JSON-LD description. */
export const JOB_SECTION = {
  responsibilities: 'Mô tả công việc',
  requirements: 'Yêu cầu',
  preferred: 'Ưu tiên (không bắt buộc)',
  benefits: 'Quyền lợi',
} as const;

const GROUPED_KEYS = ['responsibilities', 'requirements', 'preferred'] as const;

const listHtml = (items: string[]) =>
  items.length > 0 ? `<ul>${items.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : '';

/** A grouped field as HTML: each heading HR typed, then its items. */
export function sectionsHtml(sections: JobSection[]): string {
  return sections
    .map((s) => `${s.title == null ? '' : `<p><em>${escapeHtml(s.title)}</em></p>`}${listHtml(s.items)}`)
    .join('');
}

/** The job's text sections as HTML (Google asks for the full description, formatted). */
export function jobDescriptionHtml(job: JobDetailDto): string {
  const blocks: [string, string][] = [
    ...GROUPED_KEYS.map((key): [string, string] => [JOB_SECTION[key], sectionsHtml(job.sections[key])]),
    [JOB_SECTION.benefits, listHtml(job.benefits)],
  ];
  return blocks
    .filter(([, inner]) => inner)
    .map(([heading, inner]) => `<p><strong>${heading}</strong></p>${inner}`)
    .join('');
}

/** Google's credential categories for the education choices in the job form. */
const EDUCATION_CATEGORY: Record<string, string> = {
  THPT: 'high school',
  'Trung cấp trở lên': 'professional certificate',
  'Cao đẳng trở lên': 'associate degree',
  'Đại học trở lên': 'bachelor degree',
};

function educationRequirements(education: string | null): unknown {
  if (!education) return undefined;
  if (education === NO_REQUIREMENT) return 'no requirements';
  const category = EDUCATION_CATEGORY[education];
  return category ? { '@type': 'EducationalOccupationalCredential', credentialCategory: category } : undefined;
}

/** "Từ 2 năm" → 24 months, "6 tháng" → 6; free text Google could not read is left out. */
function experienceRequirements(experience: string | null): unknown {
  if (!experience) return undefined;
  if (experience === NO_REQUIREMENT) return 'no requirements';
  const match = /(\d+)\s*(năm|tháng)/.exec(experience);
  if (!match) return undefined;
  const months = Number(match[1]) * (match[2] === 'năm' ? 12 : 1);
  return { '@type': 'OccupationalExperienceRequirements', monthsOfExperience: months };
}

function postalAddress(address: string | null): Record<string, string> {
  const place = jobLocation(address);
  return {
    '@type': 'PostalAddress',
    ...(place.street ? { streetAddress: place.street } : {}),
    ...(place.district ? { addressLocality: place.district } : {}),
    ...(place.city ? { addressRegion: place.city } : {}),
    addressCountry: 'VN',
  };
}

function baseSalary(job: JobDetailDto): unknown {
  // BR-08: no salary in the structured data when the job does not state one.
  const min = job.salaryMin ?? job.salaryMax;
  const max = job.salaryMax ?? job.salaryMin;
  if (!hasSalary(job) || min == null || max == null) return undefined;
  return {
    '@type': 'MonetaryAmount',
    currency: 'VND',
    value: { '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitText: 'MONTH' },
  };
}

/** Google marks a job as remote only with these two; hybrid and office jobs are placed at their address. */
function remoteWork(job: JobDetailDto): Record<string, unknown> {
  if (job.workMode !== 'remote') return {};
  return {
    jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: { '@type': 'Country', name: 'VN' },
  };
}

/** Keys whose value is undefined are dropped, so optional properties are absent rather than empty. */
const compact = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

/**
 * schema.org JobPosting for Google for Jobs. Used by the job page (browser)
 * and the share page (server). Only for jobs that take applications (BR-16).
 */
export function jobPostingData(job: JobDetailDto, org: Org): Record<string, unknown> {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: jobDescriptionHtml(job),
    identifier: { '@type': 'PropertyValue', name: org.name, value: job.id },
    datePosted: job.publishedAt?.slice(0, 10),
    validThrough: `${job.deadline}T23:59:59+07:00`,
    employmentType: GOOGLE_EMPLOYMENT_TYPE[job.employmentType],
    hiringOrganization: {
      '@type': 'Organization',
      name: org.name,
      sameAs: COMPANY_WEBSITE,
      logo: `${org.url}${SITE_LOGO_PATH}`,
    },
    jobLocation: { '@type': 'Place', address: postalAddress(job.address) },
    experienceRequirements: experienceRequirements(job.experience),
    educationRequirements: educationRequirements(job.education),
    baseSalary: baseSalary(job),
    totalJobOpenings: job.openings ?? undefined,
    ...remoteWork(job),
    directApply: true,
  });
}

/** Việc làm › job, as on the page. */
export function jobBreadcrumbData(job: Pick<JobDetailDto, 'slug' | 'title'>, org: Org): Record<string, unknown> {
  const items = [
    { name: 'Việc làm', item: `${org.url}/` },
    { name: job.title, item: `${org.url}${jobPath(job.slug)}` },
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })),
  };
}
