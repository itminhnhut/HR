import { describe, expect, it } from 'vitest';
import {
  CATEGORY_COLORS,
  COLOR_CLASSES,
  departmentClasses,
  departmentColor,
  hashColor,
  newsCategoryColor,
} from './colors';

describe('departmentColor', () => {
  it('should give the known departments their fixed colours', () => {
    expect(departmentColor('Kinh doanh')).toBe('blue');
    expect(departmentColor('Kỹ thuật')).toBe('teal');
    expect(departmentColor('Marketing')).toBe('rose');
    expect(departmentColor('Vận hành')).toBe('amber');
    expect(departmentColor('Nhân sự')).toBe('violet');
    expect(departmentColor('Tuyển dụng')).toBe('violet');
    expect(departmentColor('Kế toán')).toBe('emerald');
  });

  it('should match a department whatever its case, spacing or accents', () => {
    expect(departmentColor('  kỹ THUẬT ')).toBe('teal');
    expect(departmentColor('ky thuat')).toBe('teal');
    expect(departmentColor('ke-toan')).toBe('emerald');
  });

  it('should give an unknown department one of the six colours, the same every time', () => {
    const first = departmentColor('Pháp chế');
    expect(CATEGORY_COLORS).toContain(first);
    expect(departmentColor('Pháp chế')).toBe(first);
    expect(departmentColor('pháp chế')).toBe(first);
  });
});

describe('newsCategoryColor', () => {
  it('should give the known categories their fixed colours, by slug or by name', () => {
    expect(newsCategoryColor('cam-nang-ung-vien')).toBe('violet');
    expect(newsCategoryColor('Cẩm nang ứng viên')).toBe('violet');
    expect(newsCategoryColor('doi-song-top-flow')).toBe('rose');
    expect(newsCategoryColor('Đời sống TOP FLOW')).toBe('rose');
    expect(newsCategoryColor('kien-thuc-nganh-nuoc')).toBe('teal');
    expect(newsCategoryColor('tin-tuyen-dung')).toBe('blue');
  });

  it('should colour a new category by its hash, so its slug and its name agree', () => {
    expect(newsCategoryColor('Sự kiện')).toBe(hashColor('su-kien'));
    expect(newsCategoryColor('su-kien')).toBe(hashColor('Sự kiện'));
  });
});

describe('hashColor', () => {
  it('should spread different names over several colours', () => {
    const names = ['Pháp chế', 'Kho vận', 'Sản xuất', 'Thu mua', 'IT', 'Dự án', 'Bảo hành', 'Hành chính'];
    expect(new Set(names.map(hashColor)).size).toBeGreaterThanOrEqual(4);
  });

  it('should still return a colour for an empty name', () => {
    expect(CATEGORY_COLORS).toContain(hashColor(''));
  });
});

describe('COLOR_CLASSES', () => {
  it('should name the tokens of the colour in every class', () => {
    for (const color of CATEGORY_COLORS) {
      for (const cls of Object.values(COLOR_CLASSES[color])) expect(cls).toContain(`cat-${color}`);
    }
  });

  it('should hand a department its colour classes', () => {
    expect(departmentClasses('Kinh doanh').text).toBe('text-cat-blue');
    expect(departmentClasses('Kế toán').soft).toBe('bg-cat-emerald-soft');
  });
});
