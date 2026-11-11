import { describe, expect, it } from 'vitest';
import { HR_SECTIONS, sectionOf } from './sections';

describe('sectionOf', () => {
  it.each([
    ['/hr', 'Tổng quan'],
    ['/hr/tin', 'Tin tuyển dụng'],
    ['/hr/tin/moi', 'Tin tuyển dụng'],
    ['/hr/tin-tuc', 'Tin tức'],
    ['/hr/tin-tuc/abc', 'Tin tức'],
    ['/hr/ho-so', 'Hồ sơ ứng viên'],
  ])('should place %s under "%s"', (path, label) => {
    expect(sectionOf(path)?.label).toBe(label);
  });

  it('should find no section outside the admin', () => {
    expect(sectionOf('/tin-tuc')).toBeNull();
  });
});

describe('HR_SECTIONS', () => {
  it('should give every area its own icon, so they can be told apart at a glance', () => {
    expect(new Set(HR_SECTIONS.map((s) => s.icon)).size).toBe(HR_SECTIONS.length);
  });

  it('should give every area its own colour, so they can be told apart at a glance', () => {
    expect(new Set(HR_SECTIONS.map((s) => s.tone)).size).toBe(HR_SECTIONS.length);
  });
});
