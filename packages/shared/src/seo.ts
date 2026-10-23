import { hasSalary } from './format.js';
import type { JobDetailDto } from './types.js';

const GOOGLE_EMPLOYMENT_TYPE = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  internship: 'INTERN',
  contract: 'CONTRACTOR',
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
    description: [job.summary, ...job.responsibilities, ...job.requirements].filter(Boolean).join('\n'),
    datePosted: job.publishedAt?.slice(0, 10),
    validThrough: `${job.deadline}T23:59:59+07:00`,
    employmentType: GOOGLE_EMPLOYMENT_TYPE[job.employmentType],
    hiringOrganization: { '@type': 'Organization', name: org.name, sameAs: org.url },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        streetAddress: job.address ?? undefined,
        addressLocality: job.city,
        addressCountry: 'VN',
      },
    },
    directApply: true,
  };
  if (job.remote) data.jobLocationType = 'TELECOMMUTE';
  // BR-08: no salary in the structured data when the job does not state one.
  const min = job.salaryMin ?? job.salaryMax;
  const max = job.salaryMax ?? job.salaryMin;
  if (hasSalary(job) && min != null && max != null) {
    data.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'VND',
      value: { '@type': 'QuantitativeValue', minValue: min * 1e6, maxValue: max * 1e6, unitText: 'MONTH' },
    };
  }
  return data;
}
