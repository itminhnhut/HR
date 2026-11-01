import { describe, expect, it } from 'vitest';
import { toItems, toLines, toSections, usesBullets } from './format.js';

describe('toSections', () => {
  it('should keep a field without bullets as one untitled group of every line', () => {
    // Arrange
    const text = 'Tìm khách hàng mới\n\nChăm sóc khách cũ là việc chính';

    // Act
    const sections = toSections(text);

    // Assert
    expect(sections).toEqual([{ title: null, items: ['Tìm khách hàng mới', 'Chăm sóc khách cũ là việc chính'] }]);
  });

  it('should read lines without a bullet as headings once the field uses bullets', () => {
    // Arrange
    const text = [
      '1. Quản lý đơn hàng',
      '• Theo dõi lịch tàu',
      '  - Cập nhật trạng thái đơn',
      '',
      '2. Thủ tục hải quan',
      '* Khai báo tờ khai',
    ].join('\n');

    // Act
    const sections = toSections(text);

    // Assert
    expect(sections).toEqual([
      { title: '1. Quản lý đơn hàng', items: ['Theo dõi lịch tàu', 'Cập nhật trạng thái đơn'] },
      { title: '2. Thủ tục hải quan', items: ['Khai báo tờ khai'] },
    ]);
  });

  it('should put items before the first heading in an untitled group', () => {
    expect(toSections('- Đi làm ngay\nKỹ năng\n- Excel')).toEqual([
      { title: null, items: ['Đi làm ngay'] },
      { title: 'Kỹ năng', items: ['Excel'] },
    ]);
  });

  it('should keep a heading that has no items under it', () => {
    expect(toSections('Ghi chú\n- Excel\nCuối cùng')).toEqual([
      { title: 'Ghi chú', items: ['Excel'] },
      { title: 'Cuối cùng', items: [] },
    ]);
  });

  it('should give empty text no groups', () => {
    expect(toSections('')).toEqual([]);
    expect(toSections(null)).toEqual([]);
    expect(toSections('\n  \n')).toEqual([]);
  });

  it('should not count a bare bullet with nothing after it as using bullets', () => {
    expect(toSections('Tìm khách\n-\nChốt đơn')).toEqual([{ title: null, items: ['Tìm khách', 'Chốt đơn'] }]);
  });
});

describe('toItems', () => {
  it('should list items without the headings', () => {
    expect(toItems('Nhóm A\n• Một\n• Hai\nNhóm B\n• Ba')).toEqual(['Một', 'Hai', 'Ba']);
  });

  it('should match toLines for a field without bullets, so old jobs read the same', () => {
    const text = 'Giao tiếp tốt\nBiết Excel\n\nCó laptop';
    expect(toItems(text)).toEqual(toLines(text));
  });
});

describe('usesBullets', () => {
  it('should tell a bulleted field from a plain one', () => {
    expect(usesBullets('Nhóm\n  • Một')).toBe(true);
    expect(usesBullets('Một\nHai')).toBe(false);
    expect(usesBullets('')).toBe(false);
  });
});
