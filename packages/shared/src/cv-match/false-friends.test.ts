import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';

const TODAY = '2026-11-03';

const CV = (line: string) =>
  ['Nguyễn Văn A', 'Kinh nghiệm làm việc', 'Công ty ABC (01/2020 - 12/2024) Nhân viên mua hàng', `- ${line}`].join('\n');

describe('"nhà cung cấp nước ngoài" is no water supply', () => {
  it('should not ask for plumbing when a requirement mentions foreign suppliers', () => {
    // Act
    const { items } = scoreCv({
      cvText: CV('Đặt hàng và theo dõi đơn hàng'),
      requirements: ['Làm việc với nhà cung cấp nước ngoài'],
      today: TODAY,
    });

    // Assert
    expect(items[0]?.reason ?? '').not.toContain('cấp thoát nước');
  });

  it('should not read foreign suppliers in a CV as plumbing work', () => {
    // Act
    const { items } = scoreCv({
      cvText: CV('Làm việc với nhà cung cấp nước ngoài'),
      requirements: ['Có kinh nghiệm thi công cấp thoát nước'],
      today: TODAY,
    });

    // Assert
    expect(items[0]?.verdict).not.toBe('met');
  });

  it('should still read real water supply work', () => {
    // Act
    const { items } = scoreCv({
      cvText: CV('Giám sát thi công hệ thống cấp nước tòa nhà'),
      requirements: ['Biết thiết kế cấp thoát nước'],
      today: TODAY,
    });

    // Assert
    expect(items[0]?.verdict).toBe('met');
  });
});
