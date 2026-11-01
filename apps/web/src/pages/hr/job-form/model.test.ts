import { DEFAULT_JOB_TEMPLATE, type HrJobDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { emptyForm, fromJob, hasPick, toInput, togglePick } from './model';

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
  level: null,
  openings: null,
  workMode: null,
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

  it('should send level, openings and work mode back as HR set them', () => {
    // Arrange
    const form = fromJob({ ...savedJob, level: 'Nhân viên', openings: 2, workMode: 'hybrid' }, DEFAULT_JOB_TEMPLATE);

    // Act
    const input = toInput(form, 'publish');

    // Assert
    expect(form).toMatchObject({ level: 'Nhân viên', openings: '2', workMode: 'hybrid' });
    expect(input).toMatchObject({ level: 'Nhân viên', openings: 2, workMode: 'hybrid' });
  });

  it('should send nothing for level, openings and work mode left empty', () => {
    const input = toInput(emptyForm(DEFAULT_JOB_TEMPLATE), 'draft');

    expect(input).toMatchObject({ level: null, openings: null, workMode: null });
  });
});

describe('requirement quick picks', () => {
  it('should add a ticked line as a plain line to a field without bullets', () => {
    expect(togglePick('Giao tiếp tốt\n', 'Có laptop cá nhân')).toBe('Giao tiếp tốt\nCó laptop cá nhân');
    expect(togglePick('', 'Có laptop cá nhân')).toBe('Có laptop cá nhân');
  });

  it('should add a ticked line with a bullet when the field uses bullets, so it is not read as a heading', () => {
    // Arrange
    const text = 'Kỹ năng\n• Dùng thành thạo Excel\n';

    // Act
    const next = togglePick(text, 'Có laptop cá nhân');

    // Assert
    expect(next).toBe('Kỹ năng\n• Dùng thành thạo Excel\n• Có laptop cá nhân');
  });

  it('should see a picked line with its bullet as ticked and untick it', () => {
    const text = 'Kỹ năng\n• Có laptop cá nhân\n- Dùng Excel';

    expect(hasPick(text, 'Có laptop cá nhân')).toBe(true);
    expect(togglePick(text, 'Có laptop cá nhân')).toBe('Kỹ năng\n- Dùng Excel');
  });
});
