import { describe, expect, it } from 'vitest';
import { jobPostingData } from './seo.js';
import type { JobDetailDto } from './types.js';

const job: JobDetailDto = {
  id: 'j1',
  slug: 'ky-su',
  title: 'Kỹ sư',
  department: 'Kỹ thuật',
  employmentType: 'internship',
  remote: false,
  city: 'Hà Nội',
  deadline: '2026-11-30',
  status: 'open',
  publishedAt: '2026-10-20T02:00:00.000Z',
  perks: '',
  salaryMin: null,
  salaryMax: null,
  salaryNote: null,
  address: null,
  workingHours: null,
  level: null,
  experience: null,
  education: null,
  language: null,
  headcount: null,
  skills: [],
  summary: 'Tóm tắt',
  teamNote: null,
  responsibilities: ['Viết API'],
  requirements: ['Biết SQL'],
  niceToHave: [],
  benefits: { income: [], insurance: [], timeOff: [], growth: [], environment: [] },
  plan: { day30: null, day60: null, day90: null },
};
const org = { name: 'Công ty', url: 'https://x.vn' };

describe('jobPostingData', () => {
  it('describes the job for Google for Jobs', () => {
    expect(jobPostingData(job, org)).toMatchObject({
      '@type': 'JobPosting',
      title: 'Kỹ sư',
      description: 'Tóm tắt\nViết API\nBiết SQL',
      datePosted: '2026-10-20',
      validThrough: '2026-11-30T23:59:59+07:00',
      employmentType: 'INTERN',
      hiringOrganization: { name: 'Công ty', sameAs: 'https://x.vn' },
    });
  });

  it('leaves salary out when the job states none (BR-08)', () => {
    expect(jobPostingData(job, org)).not.toHaveProperty('baseSalary');
  });

  it('uses one bound for both ends when only one is given', () => {
    const data = jobPostingData({ ...job, salaryMin: 15 }, org);
    expect(data.baseSalary).toMatchObject({ value: { minValue: 15e6, maxValue: 15e6, unitText: 'MONTH' } });
  });

  it('marks remote jobs as telecommute', () => {
    expect(jobPostingData({ ...job, remote: true }, org).jobLocationType).toBe('TELECOMMUTE');
  });
});
