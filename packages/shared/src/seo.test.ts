import { describe, expect, it } from 'vitest';
import { COMPANY_WEBSITE, jobBreadcrumbData, jobPostingData, pageTitle, SITE_LOGO_PATH } from './seo.js';
import type { JobDetailDto } from './types.js';

const job: JobDetailDto = {
  id: 'j1',
  slug: 'ky-su',
  title: 'Kỹ sư',
  department: 'Kỹ thuật',
  employmentType: 'internship',
  place: 'Gò Vấp, TP. HCM',
  deadline: '2026-11-30',
  status: 'open',
  publishedAt: '2026-10-20T02:00:00.000Z',
  perks: '',
  salaryMin: null,
  salaryMax: null,
  address: null,
  workingHours: null,
  experience: null,
  education: null,
  responsibilities: ['Viết API'],
  requirements: ['Biết SQL'],
  preferred: [],
  benefits: [],
  roadmap: [],
};
const org = { name: 'Công ty', url: 'https://x.vn' };
const addressOf = (data: Record<string, unknown>) => (data.jobLocation as { address: Record<string, unknown> }).address;

/** Google for Jobs: required and recommended JobPosting properties. */
const GOOGLE_REQUIRED = ['datePosted', 'description', 'hiringOrganization', 'jobLocation', 'title'];
const GOOGLE_RECOMMENDED = ['employmentType', 'identifier', 'validThrough', 'directApply'];

describe('jobPostingData', () => {
  it('should carry every field Google for Jobs requires or recommends', () => {
    // Arrange / Act
    const data = jobPostingData({ ...job, salaryMin: 10_000_000 }, org);

    // Assert
    for (const key of [...GOOGLE_REQUIRED, ...GOOGLE_RECOMMENDED, 'baseSalary']) {
      expect(data[key], key).toBeDefined();
    }
    expect(data).toMatchObject({
      '@type': 'JobPosting',
      title: 'Kỹ sư',
      datePosted: '2026-10-20',
      validThrough: '2026-11-30T23:59:59+07:00',
      employmentType: 'INTERN',
      identifier: { '@type': 'PropertyValue', name: 'Công ty', value: 'j1' },
    });
  });

  it('should name the company with its main website and an absolute logo', () => {
    expect(jobPostingData(job, org).hiringOrganization).toEqual({
      '@type': 'Organization',
      name: 'Công ty',
      sameAs: COMPANY_WEBSITE,
      logo: `https://x.vn${SITE_LOGO_PATH}`,
    });
    expect(COMPANY_WEBSITE).toBe('https://topflow.vn');
  });

  it('should describe the job as HTML sections, benefits and nice-to-haves included', () => {
    const data = jobPostingData(
      { ...job, preferred: ['Đã dùng CRM'], benefits: ['Lương tháng 13', 'Hoa hồng <20%>'] },
      org,
    );

    expect(data.description).toBe(
      '<p><strong>Mô tả công việc</strong></p><ul><li>Viết API</li></ul>' +
        '<p><strong>Yêu cầu</strong></p><ul><li>Biết SQL</li></ul>' +
        '<p><strong>Ưu tiên (không bắt buộc)</strong></p><ul><li>Đã dùng CRM</li></ul>' +
        '<p><strong>Quyền lợi</strong></p><ul><li>Lương tháng 13</li><li>Hoa hồng &lt;20%&gt;</li></ul>',
    );
  });

  it('should leave empty sections out of the description', () => {
    expect(jobPostingData(job, org).description).not.toContain('Ưu tiên');
    expect(jobPostingData(job, org).description).not.toContain('Quyền lợi');
  });

  it('should state experience and education in the form Google reads', () => {
    const data = jobPostingData({ ...job, experience: 'Từ 2 năm', education: 'Cao đẳng trở lên' }, org);

    expect(data.experienceRequirements).toEqual({
      '@type': 'OccupationalExperienceRequirements',
      monthsOfExperience: 24,
    });
    expect(data.educationRequirements).toEqual({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'associate degree',
    });
  });

  it('should say "no requirements" when the job asks for none, and nothing when unset', () => {
    const none = jobPostingData({ ...job, experience: 'Không yêu cầu', education: 'Không yêu cầu' }, org);

    expect(none).toMatchObject({ experienceRequirements: 'no requirements', educationRequirements: 'no requirements' });
    expect(jobPostingData(job, org)).not.toHaveProperty('experienceRequirements');
    expect(jobPostingData(job, org)).not.toHaveProperty('educationRequirements');
  });

  it('should leave salary out when the job states none (BR-08)', () => {
    expect(jobPostingData(job, org)).not.toHaveProperty('baseSalary');
  });

  it('should use one bound for both ends when only one is given', () => {
    const data = jobPostingData({ ...job, salaryMin: 15_000_000 }, org);
    expect(data.baseSalary).toMatchObject({ value: { minValue: 15e6, maxValue: 15e6, unitText: 'MONTH' } });
  });

  it('should place jobs without their own address at the office', () => {
    expect(addressOf(jobPostingData(job, org))).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Gò Vấp',
      addressRegion: 'TP. Hồ Chí Minh',
      addressCountry: 'VN',
    });
  });

  it('should place the Đà Nẵng job in Đà Nẵng, not in TP. Hồ Chí Minh', () => {
    const address = addressOf(jobPostingData({ ...job, address: 'Hải Châu, Đà Nẵng' }, org));

    expect(address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Hải Châu',
      addressRegion: 'Đà Nẵng',
      addressCountry: 'VN',
    });
  });

  it('should give a street address only when the job names a street', () => {
    const address = addressOf(jobPostingData({ ...job, address: '12 Phan Văn Trị, Gò Vấp, TP. Hồ Chí Minh' }, org));

    expect(address).toMatchObject({
      streetAddress: '12 Phan Văn Trị',
      addressLocality: 'Gò Vấp',
      addressRegion: 'TP. Hồ Chí Minh',
    });
  });
});

describe('jobBreadcrumbData', () => {
  it('should lead from the job board to the job', () => {
    expect(jobBreadcrumbData(job, org)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Việc làm', item: 'https://x.vn/' },
        { '@type': 'ListItem', position: 2, name: 'Kỹ sư', item: 'https://x.vn/viec-lam/ky-su' },
      ],
    });
  });
});

describe('pageTitle', () => {
  it('should add the brand after one separator', () => {
    expect(pageTitle('Tin tức', 'TOP FLOW')).toBe('Tin tức · TOP FLOW');
  });

  it('should not repeat a brand the title already names', () => {
    expect(pageTitle('Một ngày làm việc tại TOP FLOW', 'TOP FLOW')).toBe('Một ngày làm việc tại TOP FLOW');
    expect(pageTitle('Top Flow tuyển dụng', 'TOP FLOW')).toBe('Top Flow tuyển dụng');
  });
});
