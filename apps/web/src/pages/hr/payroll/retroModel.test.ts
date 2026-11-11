import { EMPTY_MONTH_INPUTS, type PayrollRetroItemDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { person } from './payrollTestData';
import {
  parseRetroAmount,
  retroAppliedWords,
  retroCellRows,
  retroId,
  retroKindOf,
  retroOutWords,
  retroPatches,
  signedMoney,
} from './retroModel';

/** Truy lĩnh / truy thu on the screen (spec R6 (a), 11.4). People and amounts are made up. */

const item = (over: Partial<PayrollRetroItemDto> = {}): PayrollRetroItemDto => ({
  employeeId: 'nv-a',
  code: 'NV01',
  fullName: 'NV A',
  origin: '2026-11',
  originApproval: 1,
  cells: { income: 3_000_000, social: 240_000, netPay: 2_760_000 },
  computed: 2_760_000,
  typed: null,
  reason: '',
  amount: 2_760_000,
  placed: true,
  causes: [],
  ...over,
});

describe('words of an adjustment', () => {
  it('should name it by the sign of the difference in net pay', () => {
    expect(retroKindOf(item())).toBe('Truy lĩnh');
    expect(retroKindOf(item({ computed: -310_000 }))).toBe('Truy thu');
    expect(retroKindOf(item({ computed: 0 }))).toBe('Điều chỉnh');
  });

  it('should write amounts with their sign', () => {
    expect(signedMoney(2_760_000)).toBe('+2.760.000');
    expect(signedMoney(-310_000)).toBe('−310.000');
    expect(signedMoney(0)).toBe('0');
  });

  it('should say what is paid: the computed amount, HR’s amount, left out, or no row', () => {
    expect(retroAppliedWords(item())).toBe('+2.760.000');
    expect(retroAppliedWords(item({ typed: 1_000_000, amount: 1_000_000 }))).toBe('HR gõ +1.000.000');
    expect(retroAppliedWords(item({ typed: 0, amount: 0 }))).toBe('HR bỏ ra');
    expect(retroAppliedWords(item({ placed: false, amount: 0 }))).toBe('Không có dòng lương tháng này');
  });

  it('should tell an approved month where its difference goes', () => {
    expect(retroOutWords({ month: '2026-12', people: 2, net: -310_000 })).toBe(
      'Số hiện tại khác bản đã duyệt — chênh lệch chuyển sang tháng 12 (2 người, thực nhận −310.000).',
    );
  });
});

describe('the cells behind an adjustment', () => {
  it('should list each cell that differs once, with its column number, in the grid’s order', () => {
    const rows = retroCellRows(item(), []);

    expect(rows.map((r) => r.cell)).toEqual(['income', 'social', 'netPay']);
    expect(rows[0]?.label).toMatch(/26.*Thu nhập thực tế/);
    expect(rows.map((r) => r.value)).toEqual([3_000_000, 240_000, 2_760_000]);
  });
});

describe('what HR’s choice saves', () => {
  const december = {
    lines: [
      person({
        employeeId: 'nv-a',
        inputs: { ...EMPTY_MONTH_INPUTS, retro: [{ origin: '2026-10', amount: 0, reason: 'Cũ' }] },
      }),
      person({ employeeId: 'nv-b', code: 'NV02' }),
    ],
    retro: [
      item(),
      item({ employeeId: 'nv-b', code: 'NV02' }),
      item({ employeeId: 'nv-c', code: 'NV03', placed: false }),
    ],
  };
  const all = new Set(december.retro.map(retroId));

  it('should leave the selected ones out for each person, keeping what the person had for other months', () => {
    const patches = retroPatches(december, all, { kind: 'exclude' }, ' Đã trả tay ');

    expect(patches).toEqual([
      {
        employeeId: 'nv-a',
        input: {
          retro: [
            { origin: '2026-10', amount: 0, reason: 'Cũ' },
            { origin: '2026-11', amount: 0, reason: 'Đã trả tay' },
          ],
        },
      },
      { employeeId: 'nv-b', input: { retro: [{ origin: '2026-11', amount: 0, reason: 'Đã trả tay' }] } },
    ]);
  });

  it('should save a typed amount, and take the entry off to go back to the computed one', () => {
    const one = new Set([retroId(december.retro[1] ?? item())]);

    expect(retroPatches(december, one, { kind: 'amount', amount: -300_000 }, 'Thoả thuận')).toEqual([
      { employeeId: 'nv-b', input: { retro: [{ origin: '2026-11', amount: -300_000, reason: 'Thoả thuận' }] } },
    ]);
    expect(retroPatches(december, new Set([retroId(item())]), { kind: 'reset' }, '')).toEqual([
      { employeeId: 'nv-a', input: { retro: [{ origin: '2026-10', amount: 0, reason: 'Cũ' }] } },
    ]);
  });

  it('should read a typed amount with dots and a minus sign, and refuse anything else', () => {
    expect(parseRetroAmount('1.500.000')).toEqual({ value: 1_500_000 });
    expect(parseRetroAmount('-300.000')).toEqual({ value: -300_000 });
    expect(parseRetroAmount('ba trăm')).toHaveProperty('error');
  });
});
