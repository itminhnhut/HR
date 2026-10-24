import { hasSalary } from './format.js';
import { OFFICE } from './job-template.js';
import type { JobDetailDto } from './types.js';

const GOOGLE_EMPLOYMENT_TYPE = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  internship: 'INTERN',
} as const;

/**
 * schema.org JobPosting for Google for Jobs. Used by the job page (browser)
 * and the share page (server). Only for jobs that take applications (BR-16).
 */
export function jobPostingData(job: JobDetailDto, org: { name: string; url: string }): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: [...job.responsibilities, ...job.requirements].join('\n'),
    datePosted: job.publishedAt?.slice(0, 10),
    validThrough: `${job.deadline}T23:59:59+07:00`,
    employmentType: GOOGLE_EMPLOYMENT_TYPE[job.employmentType],
    hiringOrganization: { '@type': 'Organization', name: org.name, sameAs: org.url },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        streetAddress: job.address ?? undefined,
        addressLocality: job.address ? undefined : OFFICE.district,
        addressRegion: OFFICE.city,
        addressCountry: 'VN',
      },
    },
    directApply: true,
  };
  // BR-08: no salary in the structured data when the job does not state one.
  const min = job.salaryMin ?? job.salaryMax;
  const max = job.salaryMax ?? job.salaryMin;
  if (hasSalary(job) && min != null && max != null) {
    data.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'VND',
      value: { '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitText: 'MONTH' },
    };
  }
  return data;
}
