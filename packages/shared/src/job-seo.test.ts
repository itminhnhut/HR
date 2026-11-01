import { describe, expect, it } from 'vitest';
import { jobSeoDescription, jobSeoTitle } from './job-seo.js';
import { pageTitle, seoJobTitle } from './seo.js';
import type { JobDetailDto } from './types.js';

type SeoJob = Parameters<typeof jobSeoDescription>[0];

const TOPCV_ADDRESS = 'Hồ Chí Minh: 110/20/2 Đường Số 30, Phường An Nhơn (Phường An Nhơn thuộc quận Gò Vấp cũ)';

const job: SeoJob = {
  title: 'Nhân viên Kinh doanh',
  address: TOPCV_ADDRESS,
  salaryMin: 12_000_000,
  salaryMax: 18_000_000,
  employmentType: 'full_time',
  experience: 'Từ 1 năm',
  deadline: '2026-11-30',
  status: 'open',
} satisfies Partial<JobDetailDto>;

describe('seoJobTitle', () => {
  it('should drop the stray spaces inside parentheses and runs of spaces', () => {
    expect(seoJobTitle('Kế toán  ( Yêu Cầu Tiếng Anh )')).toBe('Kế toán (Yêu Cầu Tiếng Anh)');
  });
});

describe('jobSeoTitle', () => {
  it('should lead with "Tuyển", the job and its short place, and fit the brand within 65 characters', () => {
    // Act
    const title = pageTitle(jobSeoTitle(job), 'TOP FLOW');

    // Assert
    expect(title).toBe('Tuyển Nhân viên Kinh doanh – Gò Vấp, TP.HCM · TOP FLOW');
    expect(title.length).toBeLessThanOrEqual(65);
  });

  it('should drop the brand, not the place, when the title with it would pass 65 characters', () => {
    // Arrange
    const long = { ...job, title: 'Kỹ sư Kinh doanh Thiết bị Đường ống' };

    // Act
    const title = pageTitle(jobSeoTitle(long), 'TOP FLOW');

    // Assert
    expect(title).toBe('Tuyển Kỹ sư Kinh doanh Thiết bị Đường ống – Gò Vấp, TP.HCM');
  });

  it('should drop the place when even the title with the place passes 65 characters', () => {
    const long = { ...job, title: 'Chuyên viên Xuất nhập khẩu (Yêu Cầu Tiếng Anh)' };

    expect(jobSeoTitle(long)).toBe('Tuyển Chuyên viên Xuất nhập khẩu (Yêu Cầu Tiếng Anh)');
    expect(pageTitle(jobSeoTitle(long), 'TOP FLOW').length).toBeLessThanOrEqual(65);
  });

  it('should normalise spaces in parentheses for search engines only', () => {
    expect(jobSeoTitle({ ...job, title: 'Kế toán ( Thuế )' })).toBe('Tuyển Kế toán (Thuế) – Gò Vấp, TP.HCM');
  });

  it('should not say "Tuyển" twice when HR already starts the title with it', () => {
    expect(jobSeoTitle({ ...job, title: 'Tuyển Kế toán' })).toBe('Tuyển Kế toán – Gò Vấp, TP.HCM');
  });
});

describe('jobSeoDescription', () => {
  it('should say "Tuyển", the short place, pay, type, experience, deadline and how fast applying is', () => {
    // Act
    const description = jobSeoDescription(job);

    // Assert
    expect(description).toBe(
      'Tuyển Nhân viên Kinh doanh tại Gò Vấp, TP.HCM. Lương 12 – 18 triệu, toàn thời gian, kinh nghiệm từ 1 năm. ' +
        'Hạn nộp 30/11/2026, ứng tuyển online trong 1 phút.',
    );
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).not.toContain('110/20/2');
  });

  it('should leave out what HR left empty and spell a negotiable salary in lower case', () => {
    const description = jobSeoDescription({
      ...job,
      address: null,
      salaryMin: null,
      salaryMax: null,
      experience: null,
    });

    expect(description).toBe(
      'Tuyển Nhân viên Kinh doanh tại Gò Vấp, TP.HCM. Lương thỏa thuận, toàn thời gian. ' +
        'Hạn nộp 30/11/2026, ứng tuyển online trong 1 phút.',
    );
  });

  it('should say no experience is needed when the job asks for none', () => {
    expect(jobSeoDescription({ ...job, experience: 'Không yêu cầu' })).toContain(
      'toàn thời gian, không yêu cầu kinh nghiệm.',
    );
  });

  it('should stay within 160 characters for a long title, still starting with "Tuyển"', () => {
    // Arrange
    const long = { ...job, title: 'Trưởng phòng Kinh doanh Khu vực Miền Nam (Yêu Cầu Tiếng Anh Giao Tiếp Tốt)' };

    // Act
    const description = jobSeoDescription(long);

    // Assert
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.startsWith('Tuyển Trưởng phòng Kinh doanh Khu vực Miền Nam (Yêu Cầu Tiếng Anh')).toBe(true);
    expect(description).toContain('Hạn nộp 30/11/2026');
  });

  it('should tell that a closed job no longer takes applications instead of inviting to apply', () => {
    const description = jobSeoDescription({ ...job, status: 'closed' });

    expect(description).toMatch(/^Vị trí Nhân viên Kinh doanh tại Gò Vấp, TP\.HCM đã ngừng nhận hồ sơ\./);
    expect(description).not.toContain('ứng tuyển online');
  });
});
