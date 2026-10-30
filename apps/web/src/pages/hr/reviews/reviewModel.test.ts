import { describe, expect, it } from 'vitest';
import { defaultRespondBy, defaultTitle, fromLocalInput, reviewLink, shortTime, zaloMessage } from './reviewModel';

describe('review form defaults', () => {
  it('should set the reply-by time to 17:00 two working days later, skipping the weekend', () => {
    // Thursday 29/10/2026 → Monday 2/11; Monday → Wednesday.
    expect(defaultRespondBy(new Date(2026, 9, 29, 9, 0))).toBe('2026-11-02T17:00');
    expect(defaultRespondBy(new Date(2026, 10, 2, 9, 0))).toBe('2026-11-04T17:00');
  });

  it('should name the batch after the job when every application is for the same one', () => {
    expect(defaultTitle([{ jobTitle: 'Kế toán' }, { jobTitle: 'Kế toán' }])).toBe('Duyệt ứng viên · Kế toán');
    expect(defaultTitle([{ jobTitle: 'Kế toán' }, { jobTitle: 'Kinh doanh' }])).toBe('Duyệt ứng viên');
  });

  it('should turn an empty date box into nothing to send', () => {
    expect(fromLocalInput('')).toBe('');
    expect(fromLocalInput('2026-11-02T17:00')).toMatch(/^2026-11-02T\d\d:00:00\.000Z$/);
  });
});

describe('sharing the link', () => {
  it('should build the reviewer link and a Zalo message that carries it', () => {
    // Arrange
    const link = reviewLink('abc', 'https://www.lee-hr.com');

    // Act
    const text = zaloMessage(
      { reviewerName: 'anh Minh', title: 'Duyệt ứng viên · Kế toán', total: 3, respondBy: '2026-11-02T10:00:00.000Z' },
      link,
    );

    // Assert
    expect(link).toBe('https://www.lee-hr.com/duyet/abc');
    expect(text).toContain('Gửi anh Minh: Duyệt ứng viên · Kế toán (3 ứng viên).');
    expect(text).toContain(link);
    expect(text).toContain('trước 17:00, 02/11');
  });

  it('should show short times as "17:00, 02/11" in Vietnam time', () => {
    expect(shortTime('2026-11-02T10:00:00.000Z')).toBe('17:00, 02/11');
  });
});
