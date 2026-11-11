import { EMPTY_MONTH_INPUTS } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { bulkPatch, bulkPeople, bulkResultWords, defaultPicked, EMPTY_BULK } from './bulkInputsModel';
import { person } from './payrollTestData';

/** "Nhập cho nhiều người" (F11): one value or one more line for the people picked. */

const NO_FILTER = { people: [], depts: [], regions: [], contracts: [], blocks: [], query: '' };

const A = person({ employeeId: 'a', fullName: 'NV A', block: 'BO', kpiAmount: 1_000_000 });
const B = person({ employeeId: 'b', fullName: 'NV B', block: 'KD', kpiAmount: 2_000_000 });
const NO_KPI = person({ employeeId: 'c', fullName: 'NV C', block: 'KD', kpiAmount: 0 });

describe('who a column can be typed for', () => {
  it('should offer (19) only for the people who have a KPI', () => {
    // Act + Assert
    expect(bulkPeople([A, B, NO_KPI], 'kpiPercent').map((l) => l.employeeId)).toEqual(['a', 'b']);
    expect(bulkPeople([A, B, NO_KPI], 'otherIncome')).toHaveLength(3);
  });

  it('should tick the people the grid is filtered to when the dialog opens', () => {
    // Act
    const picked = defaultPicked([A, B, NO_KPI], { ...NO_FILTER, blocks: ['KD'] }, 'kpiPercent');

    // Assert
    expect(picked).toEqual(['b']);
  });

  it('should tick nobody when the grid shows everyone: HR picks who the value is for', () => {
    // Act + Assert
    expect(defaultPicked([A, B, NO_KPI], NO_FILTER, 'kpiPercent')).toEqual([]);
    expect(defaultPicked([A, B, NO_KPI], NO_FILTER, 'otherIncome')).toEqual([]);
  });
});

describe('what is sent for each person', () => {
  it('should send the same % as a fraction to everyone', () => {
    // Act
    const patch = bulkPatch({ ...EMPTY_BULK, amount: '100' });

    // Assert
    expect(patch.ok && patch.patchFor(A)).toEqual({ kpiPercent: 1 });
  });

  it('should put (19) back to the computed % when the box is left empty', () => {
    // Act
    const patch = bulkPatch({ ...EMPTY_BULK, amount: '' });

    // Assert
    expect(patch.ok && patch.patchFor(A)).toEqual({ kpiPercent: null });
  });

  it('should add the new line of (24) after the lines the person already has this month', () => {
    // Arrange
    const old = { amount: 100_000, taxable: true, reason: 'Thưởng nóng' };
    const line = person({ inputs: { ...EMPTY_MONTH_INPUTS, otherIncome: [old] } });

    // Act
    const patch = bulkPatch({
      ...EMPTY_BULK,
      column: 'otherIncome',
      amount: '500.000',
      tax: 'exempt',
      reason: 'Quà lễ',
    });

    // Assert
    expect(patch.ok && patch.patchFor(line)).toEqual({
      otherIncome: [old, { amount: 500_000, taxable: false, reason: 'Quà lễ' }],
    });
  });

  it('should ask for the tax choice and the reason of (24), and an amount for (32)', () => {
    // Act + Assert
    expect(bulkPatch({ ...EMPTY_BULK, column: 'otherIncome', amount: '500.000' })).toEqual({
      ok: false,
      error: 'Chọn chịu thuế hay miễn thuế.',
    });
    expect(bulkPatch({ ...EMPTY_BULK, column: 'otherIncome', amount: '500.000', tax: 'taxable' })).toEqual({
      ok: false,
      error: 'Nhập lý do.',
    });
    expect(bulkPatch({ ...EMPTY_BULK, column: 'cash', amount: '' })).toEqual({
      ok: false,
      error: 'Nhập số tiền lớn hơn 0, số đồng.',
    });
  });

  it('should send (32) with its kind, the reason optional', () => {
    // Act
    const patch = bulkPatch({ ...EMPTY_BULK, column: 'cash', amount: '1.000.000', kind: 'advance' });

    // Assert
    expect(patch.ok && patch.patchFor(A)).toEqual({ cash: [{ kind: 'advance', amount: 1_000_000, reason: '' }] });
  });
});

describe('a truy lĩnh / truy thu added by hand (C03)', () => {
  const RETRO = {
    ...EMPTY_BULK,
    column: 'retro',
    amount: '500.000',
    origin: '2026-09',
    reason: 'Bù lương tháng 9',
  } as const;

  it('should ask for the month it is for and a reason', () => {
    expect(bulkPatch({ ...RETRO, origin: '' })).toEqual({ ok: false, error: 'Chọn tháng gốc của khoản này.' });
    expect(bulkPatch({ ...RETRO, reason: ' ' })).toEqual({ ok: false, error: 'Nhập lý do.' });
  });

  it('should add it to what the person already has, replacing their own line of the same month', () => {
    // Arrange
    const other = { origin: '2026-08', amount: 100_000, reason: 'Khác' };
    const same = { origin: '2026-09', amount: 1, reason: 'Cũ' };
    const line = person({ inputs: { ...EMPTY_MONTH_INPUTS, retro: [other, same] } });

    // Act
    const pay = bulkPatch(RETRO);
    const take = bulkPatch({ ...RETRO, retroKind: 'take' });

    // Assert
    expect(pay.ok && pay.patchFor(line)).toEqual({
      retro: [other, { origin: '2026-09', amount: 500_000, reason: 'Bù lương tháng 9' }],
    });
    expect(take.ok && take.patchFor(A)).toEqual({
      retro: [{ origin: '2026-09', amount: -500_000, reason: 'Bù lương tháng 9' }],
    });
  });

  it('should be offered for everyone of the month', () => {
    expect(bulkPeople([A, B, NO_KPI], 'retro')).toHaveLength(3);
  });
});

describe('the result in words', () => {
  it('should say how many were saved and who was not, with the reason', () => {
    // Act + Assert
    expect(bulkResultWords(3, [])).toBe('Đã lưu 3/3 người.');
    expect(bulkResultWords(3, [{ name: 'NV C', reason: 'Tháng đã duyệt' }])).toBe(
      'Đã lưu 2/3 người. Chưa lưu: NV C (Tháng đã duyệt)',
    );
  });
});
