import { EMPLOYMENT_TYPE_LABEL, foldVietnamese, formatDate, formatSalary } from './format.js';
import { shortPlace } from './home-seo.js';
import { placeLabel } from './job-location.js';
import { isListed } from './job-status.js';
import { NO_REQUIREMENT } from './job-template.js';
import { cutDescription } from './news/text.js';
import { SEO_TITLE_MAX, seoJobTitle } from './seo.js';
import type { JobDetailDto } from './types.js';

/**
 * <title> and meta description of a job page, shared by the site (JobPage) and the crawler page
 * (job-bot-page.ts), so Google, Zalo and Facebook read the same words people see in the tab.
 */

/** Google shows about this many characters of a description. */
export const SEO_DESCRIPTION_MAX = 160;

export type SeoJob = Pick<
  JobDetailDto,
  'title' | 'address' | 'salaryMin' | 'salaryMax' | 'employmentType' | 'experience' | 'deadline' | 'status'
>;

/** "Gò Vấp, TP.HCM": the job's short place, spelled as on the home page (shortPlace in home-seo.ts). */
const seoPlace = (address: string | null) => shortPlace(placeLabel(address));

/** "Tuyển Kế toán", without saying "Tuyển" twice when HR started the title with it. */
const hiring = (title: string) => {
  const clean = seoJobTitle(title);
  return /^tuyen\s/.test(foldVietnamese(clean)) ? clean : `Tuyển ${clean}`;
};

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * "Tuyển Kế toán – Gò Vấp, TP.HCM", without the brand: pageTitle adds " · <brand>" when it still fits in
 * SEO_TITLE_MAX. A title too long even without the brand drops the place.
 */
export function jobSeoTitle(job: Pick<SeoJob, 'title' | 'address'>): string {
  const withPlace = `${hiring(job.title)} – ${seoPlace(job.address)}`;
  return withPlace.length <= SEO_TITLE_MAX ? withPlace : hiring(job.title);
}

function experienceText(experience: string | null): string | null {
  if (!experience?.trim()) return null;
  return experience === NO_REQUIREMENT ? 'không yêu cầu kinh nghiệm' : `kinh nghiệm ${lowerFirst(experience.trim())}`;
}

interface DescriptionParts {
  employment: boolean;
  experience: boolean;
  applyClause: boolean;
}

function openDescription(job: SeoJob, parts: DescriptionParts): string {
  const terms = [
    `Lương ${lowerFirst(formatSalary(job))}`,
    parts.employment ? lowerFirst(EMPLOYMENT_TYPE_LABEL[job.employmentType]) : null,
    parts.experience ? experienceText(job.experience) : null,
  ].filter((term): term is string => !!term);
  const deadline = `Hạn nộp ${formatDate(job.deadline)}${parts.applyClause ? ', ứng tuyển online trong 1 phút' : ''}.`;
  return `${hiring(job.title)} tại ${seoPlace(job.address)}. ${terms.join(', ')}. ${deadline}`;
}

/** What to leave out, in order, until the description fits: the invitation first, the pay never. */
const SHORTER: DescriptionParts[] = [
  { employment: true, experience: true, applyClause: true },
  { employment: true, experience: true, applyClause: false },
  { employment: true, experience: false, applyClause: false },
  { employment: false, experience: false, applyClause: false },
];

/**
 * "Tuyển {title} tại {place}. Lương {salary}, {type}, kinh nghiệm {experience}. Hạn nộp {date}, ứng tuyển online
 * trong 1 phút." Empty fields are left out; a long one drops the least useful parts to stay within 160
 * characters. A closed job says it no longer takes applications.
 */
export function jobSeoDescription(job: SeoJob): string {
  if (!isListed(job.status)) {
    const closed = `Vị trí ${seoJobTitle(job.title)} tại ${seoPlace(job.address)} đã ngừng nhận hồ sơ. Xem các vị trí tương tự đang tuyển.`;
    return cutDescription(closed, SEO_DESCRIPTION_MAX);
  }
  const candidates = SHORTER.map((parts) => openDescription(job, parts));
  const fitting = candidates.find((text) => text.length <= SEO_DESCRIPTION_MAX);
  return fitting ?? cutDescription(candidates[candidates.length - 1] ?? '', SEO_DESCRIPTION_MAX);
}
