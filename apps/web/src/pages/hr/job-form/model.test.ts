import { DEFAULT_JOB_TEMPLATE, type HrJobDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { emptyForm, fromJob, toInput } from './model';

const savedJob: HrJobDto = {
  id: 'j1',
  slug: 'kinh-doanh',
  title: 'Kinh doanh',
  department: 'Kinh doanh',
  employmentType: 'full_time',
  address: null,
  workingHours: null,
  experience: null,
  education: null,
  salaryMin: null,
  salaryMax: null,
  responsibilities: 'Tìm khách',
  requirements: 'Giao tiếp tốt',
  preferred: 'Đã dùng CRM\nCó sẵn khách hàng',
  benefits: [],
  roadmap: [],
  deadline: '2026-11-30',
  state: 'published',
  status: 'open',
};

describe('job form model', () => {
  it('should start a new job with no nice-to-haves', () => {
    expect(emptyForm(DEFAULT_JOB_TEMPLATE).preferred).toBe('');
  });

  it('should send the nice-to-haves back unchanged when HR edits a job', () => {
    // Arrange
    const form = fromJob(savedJob, DEFAULT_JOB_TEMPLATE);

    // Act
    const input = toInput(form, 'publish');

    // Assert
    expect(input.requirements).toBe('Giao tiếp tốt');
    expect(input.preferred).toBe('Đã dùng CRM\nCó sẵn khách hàng');
  });
});
