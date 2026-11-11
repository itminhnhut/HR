import { describe, expect, it } from 'vitest';
import { checkValueWords } from './profileModel';

/** The checklist in a person's Hồ sơ lương shows names, not ids. */

const CATALOGUE = {
  contractTypes: [{ id: 'khong-thoi-han', name: 'HĐLĐ không xác định thời hạn' }],
  components: [
    { id: 'xang-dt', name: 'Xăng xe + ĐT' },
    { id: 'trang-phuc', name: 'Trang phục' },
  ],
};

describe('checkValueWords', () => {
  it('should show the contract type by its name', () => {
    expect(checkValueWords('khong-thoi-han', CATALOGUE)).toBe('HĐLĐ không xác định thời hạn');
  });

  it('should show every component by its name and keep the amounts', () => {
    expect(checkValueWords('xang-dt 3.000.000, trang-phuc 400.000', CATALOGUE)).toBe(
      'Xăng xe + ĐT 3.000.000, Trang phục 400.000',
    );
  });

  it('should leave words that are not an id as they are', () => {
    expect(checkValueWords('60 ngày (mặc định)', CATALOGUE)).toBe('60 ngày (mặc định)');
    expect(checkValueWords('xang-dt-khac 1', CATALOGUE)).toBe('xang-dt-khac 1');
  });
});
