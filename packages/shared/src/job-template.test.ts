import { describe, expect, it } from 'vitest';
import { formatSalary, groupThousands } from './format.js';
import { placeLabel } from './job-location.js';
import { composeWorkingHours, parseWorkingHours } from './job-template.js';

describe('formatSalary', () => {
  it('shows VND amounts in millions, with a comma for half millions', () => {
    expect(formatSalary({ salaryMin: 15_000_000, salaryMax: 20_000_000 })).toBe('15 – 20 triệu');
    expect(formatSalary({ salaryMin: 7_500_000, salaryMax: 7_500_000 })).toBe('7,5 triệu');
    expect(formatSalary({ salaryMin: 10_000_000, salaryMax: null })).toBe('Từ 10 triệu');
    expect(formatSalary({ salaryMin: null, salaryMax: null })).toBe('Thỏa thuận');
  });

  it('groups thousands with dots', () => {
    expect(groupThousands(15000000)).toBe('15.000.000');
    expect(groupThousands(950)).toBe('950');
  });
});

describe('working hours', () => {
  it('reads back what the form composed', () => {
    const text = composeWorkingHours('Thứ 2 – Thứ 7', '08:00', '17:30');
    expect(text).toBe('Thứ 2 – Thứ 7, 8:00 – 17:30');
    expect(parseWorkingHours(text)).toEqual({ days: 'Thứ 2 – Thứ 7', start: '08:00', end: '17:30' });
  });

  it('treats hand-typed hours as custom', () => {
    expect(parseWorkingHours('T2 – T7, 8:00 – 17:30')).toBeNull();
    expect(parseWorkingHours('Ca sáng 6:00 – 14:00')).toBeNull();
  });
});

describe('placeLabel', () => {
  it('falls back to the office when the job has no address of its own', () => {
    expect(placeLabel(null)).toBe('Gò Vấp, TP. HCM');
    expect(placeLabel('  ')).toBe('Gò Vấp, TP. HCM');
    expect(placeLabel('Kho Bình Dương')).toBe('Kho Bình Dương');
  });

  it('should show the district and short city of a long TopCV address instead of the whole address', () => {
    // Arrange
    const address = 'Hồ Chí Minh: 110/20/2 Đường Số 30, Phường An Nhơn (Phường An Nhơn thuộc quận Gò Vấp cũ)';

    // Act / Assert
    expect(placeLabel(address)).toBe('Gò Vấp, TP. HCM');
    expect(placeLabel('12 Bạch Đằng, Hải Châu, TP. Đà Nẵng')).toBe('Hải Châu, Đà Nẵng');
    expect(placeLabel('Hải Châu, Đà Nẵng')).toBe('Hải Châu, Đà Nẵng');
  });
});
