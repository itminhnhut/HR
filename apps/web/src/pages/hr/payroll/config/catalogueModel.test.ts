import { catalogueId, DEFAULT_COMPONENTS, DEFAULT_CONTRACT_TYPES } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { addComponent, addContract, EMPTY_COMPONENT, EMPTY_CONTRACT, renameEntry, stopEntry } from './catalogueModel';

/** Thêm, đổi tên, ngừng dùng a pay component or a contract type (F27). */

describe('the id of a new entry', () => {
  it('should be its name without accents, and take a number when the id is taken', () => {
    expect(catalogueId('PC độc hại', [])).toBe('pc-doc-hai');
    expect(catalogueId('  Điện thoại / Xăng  ', [])).toBe('dien-thoai-xang');
    expect(catalogueId('PC độc hại', ['pc-doc-hai', 'pc-doc-hai-2'])).toBe('pc-doc-hai-3');
  });
});

describe('adding', () => {
  it('should refuse a pay component without a name or with a name already in the list', () => {
    expect(addComponent(DEFAULT_COMPONENTS, EMPTY_COMPONENT, '2026-11')).toEqual({
      ok: false,
      error: 'Nhập tên khoản lương.',
    });
    expect(addComponent(DEFAULT_COMPONENTS, { ...EMPTY_COMPONENT, name: 'tiền cơm' }, '2026-11')).toEqual({
      ok: false,
      error: 'Đã có khoản lương tên này.',
    });
  });

  it('should add a contract type as a new version of the list, 10% meaning a short-term type', () => {
    // Act
    const built = addContract(
      DEFAULT_CONTRACT_TYPES,
      { ...EMPTY_CONTRACT, name: 'HĐ thời vụ', insured: false, taxMethod: 'flat10', probationDays: '0' },
      '2026-12',
    );

    // Assert
    expect(built).toMatchObject({ ok: true, input: { key: 'loai-hd.danh-sach', from: '2026-12' } });
    const list = built.ok && Array.isArray(built.input.value) ? built.input.value : [];
    expect(list).toHaveLength(DEFAULT_CONTRACT_TYPES.length + 1);
    expect(list.at(-1)).toEqual({
      id: 'hd-thoi-vu',
      name: 'HĐ thời vụ',
      insured: false,
      taxMethod: 'flat10',
      shortTerm: true,
      probationDays: 0,
      commitmentIncluded: false,
    });
  });
});

describe('renaming and stopping', () => {
  it('should write a new name and a stop as rows of the entry from the month, never a delete', () => {
    expect(renameEntry('loai-hd', 'thu-viec', ' HĐ thử việc 2 tháng ', '2026-12')).toEqual({
      ok: true,
      input: { key: 'loai-hd.thu-viec.ten', from: '2026-12', value: 'HĐ thử việc 2 tháng', source: '' },
    });
    expect(stopEntry('khoan', 'nha-o', '2027-01')).toEqual({
      key: 'khoan.nha-o.ngung',
      from: '2027-01',
      value: '2027-01',
      source: '',
    });
  });
});
