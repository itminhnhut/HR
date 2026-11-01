import { describe, expect, it } from 'vitest';
import { BENEFIT_MAX, DEFAULT_JOB_TEMPLATE, LEVEL_OPTIONS } from './job-template.js';
import { addChoiceSchema, fieldErrors, jobInputSchema, jobTemplateSchema, type JobInput } from './validation.js';

const input: JobInput = {
  title: 'Nhân viên Chứng từ',
  department: 'Xuất nhập khẩu/Logistics',
  employmentType: 'full_time',
  address: null,
  workingHours: null,
  experience: null,
  education: null,
  salaryMin: null,
  salaryMax: null,
  responsibilities: 'Làm chứng từ',
  requirements: 'Biết Excel',
  benefits: [],
  roadmap: [],
  deadline: '',
  intent: 'draft',
};

const errorsOf = (raw: unknown) => {
  const parsed = jobInputSchema.safeParse(raw);
  return parsed.success ? {} : fieldErrors(parsed.error);
};

describe('jobInputSchema', () => {
  it('should accept a benefit of 200 characters and refuse a longer one', () => {
    // Arrange
    const long = 'a'.repeat(BENEFIT_MAX);

    // Act / Assert
    expect(BENEFIT_MAX).toBe(200);
    expect(jobInputSchema.safeParse({ ...input, benefits: [long] }).success).toBe(true);
    expect(errorsOf({ ...input, benefits: [`${long}a`] }).benefits).toBe('Mỗi quyền lợi tối đa 200 ký tự.');
  });

  it('should leave level, openings and work mode empty when an older client sends none', () => {
    const parsed = jobInputSchema.parse(input);

    expect(parsed).toMatchObject({ level: null, openings: null, workMode: null });
  });

  it('should keep level, openings and work mode HR chose', () => {
    const parsed = jobInputSchema.parse({ ...input, level: ' Nhân viên ', openings: 2, workMode: 'hybrid' });

    expect(parsed).toMatchObject({ level: 'Nhân viên', openings: 2, workMode: 'hybrid' });
  });

  it('should take 1 to 100 people and explain anything else', () => {
    expect(jobInputSchema.safeParse({ ...input, openings: 1 }).success).toBe(true);
    expect(jobInputSchema.safeParse({ ...input, openings: 100 }).success).toBe(true);
    for (const openings of [0, 101, 1.5]) {
      expect(errorsOf({ ...input, openings }).openings).toBe('Số lượng tuyển từ 1 đến 100 người.');
    }
  });

  it('should refuse a work mode that is not one of the three', () => {
    expect(errorsOf({ ...input, workMode: 'field' }).workMode).toBe('Chọn Tại văn phòng, Kết hợp hoặc Từ xa.');
  });

  it('should refuse a level longer than a template choice', () => {
    expect(errorsOf({ ...input, level: 'a'.repeat(61) }).level).toBe('Cấp bậc tối đa 60 ký tự.');
  });
});

describe('jobTemplateSchema levels', () => {
  it('should give a template saved before levels existed the built-in levels', () => {
    // Arrange: a stored template from before "Cấp bậc".
    const { levels: _levels, ...older } = DEFAULT_JOB_TEMPLATE;

    // Act
    const parsed = jobTemplateSchema.parse(older);

    // Assert
    expect(parsed.levels).toEqual(LEVEL_OPTIONS);
    expect(LEVEL_OPTIONS).toEqual([
      'Thực tập sinh',
      'Nhân viên',
      'Trưởng nhóm',
      'Trưởng/Phó phòng',
      'Quản lý',
      'Giám đốc',
    ]);
  });

  it('should let HR add a level from the job form', () => {
    expect(addChoiceSchema.parse({ list: 'levels', value: 'Phó Giám đốc' })).toEqual({
      list: 'levels',
      value: 'Phó Giám đốc',
    });
  });
});
