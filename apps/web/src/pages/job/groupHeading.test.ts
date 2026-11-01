import { describe, expect, it } from 'vitest';
import { groupHeadingParts } from './groupHeading';

describe('group heading', () => {
  it('should move a leading "1. " into the number chip', () => {
    expect(groupHeadingParts('1. Quản lý đơn hàng & vận chuyển nhập khẩu')).toEqual({
      number: '1',
      text: 'Quản lý đơn hàng & vận chuyển nhập khẩu',
    });
    expect(groupHeadingParts('12) Báo cáo')).toEqual({ number: '12', text: 'Báo cáo' });
  });

  it('should keep a heading without a number as HR wrote it', () => {
    expect(groupHeadingParts('THỜI GIAN LÀM VIỆC')).toEqual({ number: null, text: 'THỜI GIAN LÀM VIỆC' });
  });

  it('should not take a year or an amount for a group number', () => {
    expect(groupHeadingParts('2026 mục tiêu')).toEqual({ number: null, text: '2026 mục tiêu' });
    expect(groupHeadingParts('3.5 triệu')).toEqual({ number: null, text: '3.5 triệu' });
  });
});
