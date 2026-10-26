import { describe, expect, it } from 'vitest';
import { filterJobs, filterOptions, hasActiveFilters, readFilters, writeFilters, shownOnPhone } from './jobFilterModel';

const JOBS = [
  { title: 'Nhân viên Kinh doanh B2B', department: 'Kinh doanh', place: 'Gò Vấp, TP. HCM' },
  { title: 'Lập trình viên Frontend (React)', department: 'Kỹ thuật', place: 'Quận 1, TP. HCM' },
  { title: 'Kế toán nội bộ', department: 'Vận hành', place: 'Gò Vấp, TP. HCM' },
];
const NONE = { q: '', department: '', place: '' };
const titles = (jobs: { title: string }[]) => jobs.map((j) => j.title);

describe('filterJobs', () => {
  it('should keep every job when no filter is set', () => {
    // Arrange, Act
    const result = filterJobs(JOBS, NONE);

    // Assert
    expect(result).toHaveLength(3);
  });

  it('should match the title with or without Vietnamese accents', () => {
    // Arrange
    const accented = { ...NONE, q: 'Kế toán' };
    const plain = { ...NONE, q: 'ke toan' };

    // Act
    const withAccents = filterJobs(JOBS, accented);
    const withoutAccents = filterJobs(JOBS, plain);

    // Assert
    expect(titles(withAccents)).toEqual(['Kế toán nội bộ']);
    expect(titles(withoutAccents)).toEqual(['Kế toán nội bộ']);
  });

  it('should match the department in the search text', () => {
    // Arrange
    const filters = { ...NONE, q: 'ky thuat' };

    // Act
    const result = filterJobs(JOBS, filters);

    // Assert
    expect(titles(result)).toEqual(['Lập trình viên Frontend (React)']);
  });

  it('should need every search word to appear', () => {
    // Arrange
    const filters = { ...NONE, q: 'kinh react' };

    // Act
    const result = filterJobs(JOBS, filters);

    // Assert
    expect(result).toEqual([]);
  });

  it('should combine department and location exactly', () => {
    // Arrange
    const filters = { q: '', department: 'Vận hành', place: 'Gò Vấp, TP. HCM' };

    // Act
    const result = filterJobs(JOBS, filters);

    // Assert
    expect(titles(result)).toEqual(['Kế toán nội bộ']);
  });
});

describe('filterOptions', () => {
  it('should list each present value once in Vietnamese order', () => {
    // Arrange
    const values = ['Vận hành', 'Kinh doanh', 'Kỹ thuật', 'Kinh doanh', ''];

    // Act
    const options = filterOptions(values);

    // Assert
    expect(options).toEqual(['Kinh doanh', 'Kỹ thuật', 'Vận hành']);
  });

  it('should keep the current value even when no open job has it', () => {
    // Arrange
    const values = ['Kinh doanh'];

    // Act
    const options = filterOptions(values, 'Nhân sự');

    // Assert
    expect(options).toEqual(['Kinh doanh', 'Nhân sự']);
  });
});

describe('address query', () => {
  it('should read the filters from the address keys', () => {
    // Arrange
    const params = new URLSearchParams('q=ke+toan&phong-ban=V%E1%BA%ADn+h%C3%A0nh&noi-lam=G%C3%B2+V%E1%BA%A5p');

    // Act
    const filters = readFilters(params);

    // Assert
    expect(filters).toEqual({ q: 'ke toan', department: 'Vận hành', place: 'Gò Vấp' });
  });

  it('should drop blank values and keep unrelated keys without changing the original', () => {
    // Arrange
    const params = new URLSearchParams('q=react&utm_source=zalo');

    // Act
    const next = writeFilters(params, { q: '   ', department: 'Kỹ thuật' });

    // Assert
    expect(next.get('q')).toBeNull();
    expect(next.get('phong-ban')).toBe('Kỹ thuật');
    expect(next.get('utm_source')).toBe('zalo');
    expect(params.get('q')).toBe('react');
  });

  it('should treat only non-blank values as active filters', () => {
    // Arrange, Act, Assert
    expect(hasActiveFilters({ ...NONE, q: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...NONE, place: 'Gò Vấp' })).toBe(true);
  });
});

describe('jobs shown on a phone', () => {
  const jobs = (n: number) => Array.from({ length: n }, (_, i) => `job-${i}`);

  it('should show all jobs when there are 10 or fewer', () => {
    expect(shownOnPhone(jobs(10), false)).toHaveLength(10);
    expect(shownOnPhone(jobs(3), false)).toHaveLength(3);
  });

  it('should show the first 10 and keep the rest for "Xem thêm" when there are more', () => {
    expect(shownOnPhone(jobs(12), false)).toEqual(jobs(10));
  });

  it('should show every job once "Xem thêm" was pressed', () => {
    expect(shownOnPhone(jobs(12), true)).toHaveLength(12);
  });
});
