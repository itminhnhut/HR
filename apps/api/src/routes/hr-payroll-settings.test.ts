import type { PayrollSettingDto } from '@careers/shared';
import { asc } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { payrollLog } from '../db/schema.js';
import { addSetting, approvedMonth, givePayrollRight, lineOf, valueIn, viewOf } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Cấu hình có phiên bản và ghi đè (spec-luong.md 6, 7, 9; docs/test-cases-luong.md A, L-L01, L-L02). A stored row is
 * a change on top of the engine's defaults; "default" below means no stored row applies. Amounts are illustrative.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
  await givePayrollRight(flow);
});

const logLines = async () =>
  (await flow.t.db.select().from(payrollLog).orderBy(asc(payrollLog.at), asc(payrollLog.id))).map((l) => l.detail);

const people = async () => ({
  a: await flow.addPerson({ code: 'NV01', fullName: 'NV A', employment: 'probation' }),
  b: await flow.addPerson({ code: 'NV02', fullName: 'NV B', employment: 'probation' }),
});

describe('L-L01 one person over everyone', () => {
  it('L-L01: should let one person’s row win from its month, and hand back to everyone’s from the stop', async () => {
    // Arrange
    const { a, b } = await people();
    await addSetting(flow, { key: 'khoan.com.thue', from: '2026-01', value: { kind: 'cap', cap: 'meal' } });

    // Act
    await addSetting(flow, { key: 'khoan.com.thue', employeeId: a.id, from: '2026-12', value: { kind: 'taxable' } });
    await addSetting(flow, { key: 'khoan.com.thue', employeeId: a.id, from: '2027-03', stop: true });

    // Assert
    const meal = { kind: 'cap', cap: 'meal' };
    expect(await valueIn(flow, '2026-11', 'khoan.com.thue', a)).toEqual(meal);
    expect(await valueIn(flow, '2026-12', 'khoan.com.thue', a)).toEqual({ kind: 'taxable' });
    expect(await valueIn(flow, '2027-02', 'khoan.com.thue', a)).toEqual({ kind: 'taxable' });
    expect(await valueIn(flow, '2027-03', 'khoan.com.thue', a)).toEqual(meal);
    expect(await valueIn(flow, '2026-12', 'khoan.com.thue', b)).toEqual(meal);
  });

  it.todo('L-L01: should keep an approved month on the value it was approved with (approval snapshot, step 16)');
});

describe('L-L02 a change for everyone from a month', () => {
  it('L-L02: should change everyone from T12 but the person with their own row, and log one line', async () => {
    // Arrange
    const { a, b } = await people();
    await addSetting(flow, { key: 'quy-tac.ty-le-thu-viec', employeeId: b.id, from: '2026-11', value: 0.9 });

    // Act
    await addSetting(flow, { key: 'quy-tac.ty-le-thu-viec', from: '2026-12', value: 0.95, source: 'Quy chế mới' });

    // Assert
    expect(await valueIn(flow, '2026-12', 'quy-tac.ty-le-thu-viec', a)).toBe(0.95);
    expect(await valueIn(flow, '2026-12', 'quy-tac.ty-le-thu-viec', b)).toBe(0.9);
    expect(await valueIn(flow, '2026-11', 'quy-tac.ty-le-thu-viec', a)).toBe('default');
    const lines = await logLines();
    expect(lines.filter((l) => l.includes('cho tất cả'))).toEqual([
      'Thêm Tỷ lệ lương thử việc cho tất cả: 95%, từ T12/2026. Nguồn: Quy chế mới',
    ]);
    expect(lines).toContain('Thêm Tỷ lệ lương thử việc cho NV02 NV B: 90%, từ T11/2026');
  });
});

describe('L-A02 – L-A04, L-A30 which version a month reads (R2)', () => {
  it('L-A02: should mark a value from a later date as upcoming and leave the month on what it had', async () => {
    // Arrange + Act
    await addSetting(flow, { key: 'luat.luong-co-so', from: '2027-07-01', value: 2_700_000 });

    // Assert
    const line = await lineOf(flow, '2026-10', 'luat.luong-co-so');
    expect(line.inForce).toBeNull();
    expect(line.rows.map((r) => [r.value, r.status])).toEqual([[2_700_000, 'upcoming']]);
  });

  it('L-A03: should read insurance parameters on day 1 of the calendar month, the whole period on one value', async () => {
    // Arrange
    await addSetting(flow, { key: 'luat.luong-co-so', from: '2026-01-01', value: 2_340_000 });
    await addSetting(flow, { key: 'luat.luong-co-so', from: '2026-07-01', value: 2_530_000 });

    // Act
    const june = await lineOf(flow, '2026-06', 'luat.luong-co-so');
    const july = await lineOf(flow, '2026-07', 'luat.luong-co-so');

    // Assert
    expect([june.readOn, june.inForce?.value]).toEqual(['2026-06-01', 2_340_000]);
    expect([july.readOn, july.inForce?.value]).toEqual(['2026-07-01', 2_530_000]);
  });

  it('L-A04: should read tax parameters on the pay date, 05 of the next month by default', async () => {
    // Arrange
    await addSetting(flow, { key: 'luat.tran-tien-an', from: '2026-01-01', value: 730_000 });
    await addSetting(flow, { key: 'luat.tran-tien-an', from: '2026-07-01', value: 1_200_000 });

    // Act
    const may = await lineOf(flow, '2026-05', 'luat.tran-tien-an');
    const june = await lineOf(flow, '2026-06', 'luat.tran-tien-an');

    // Assert
    expect([may.readOn, may.inForce?.value]).toEqual(['2026-06-05', 730_000]);
    expect([june.readOn, june.inForce?.value]).toEqual(['2026-07-05', 1_200_000]);
  });

  it('L-A30: should read an old month by its own versions, whatever the day it is opened', async () => {
    // Arrange
    await addSetting(flow, { key: 'quy-tac.gio-mot-ngay', from: '2026-12', value: 7.5 });
    await flow.at('2026-12-20');

    // Act
    const october = await valueIn(flow, '2026-10', 'quy-tac.gio-mot-ngay');

    // Assert
    expect(october).toBe('default');
    expect(await valueIn(flow, '2026-12', 'quy-tac.gio-mot-ngay')).toBe(7.5);
  });

  it.todo('L-A05: should recompute a draft when its pay date crosses a tax date (pay date of the month, step 15)');
  it.todo('L-A07: should recompute a draft touched by a past-dated value and log the rows changed (step 15)');
  it.todo('L-A33: should recompute a draft once when two changes touch it (step 15)');
});

describe('L-A10 – L-A14 changing a stored value (R5)', () => {
  it('L-A10: should refuse to edit or delete a value an approved month used, with 409', async () => {
    // Arrange
    const { setting } = await addSetting(flow, {
      key: 'luat.giam-tru',
      from: '2026-01-01',
      value: { personal: 15_500_000, dependant: 6_200_000 },
    });
    await approvedMonth(flow, 2026, 10);

    // Act
    const edit = await flow.payroll<{ error: string; code: string }>(
      'PUT',
      `/settings/${setting.id}`,
      { value: { personal: 16_000_000, dependant: 6_200_000 } },
      409,
    );
    const remove = await flow.payroll<{ error: string }>('DELETE', `/settings/${setting.id}`, undefined, 409);

    // Assert
    expect(edit.error).toBe('Đã dùng ở T10/2026 đã duyệt. Thêm mức mới hoặc Sửa lỗi.');
    expect(edit.code).toBe('payroll_setting_used');
    expect(remove.error).toContain('Đã dùng ở T10/2026 đã duyệt');
  });

  it('L-A11: should correct a used value with a replacement on the same date, the old one kept as replaced', async () => {
    // Arrange
    const { setting } = await addSetting(flow, { key: 'luat.tran-tien-an', from: '2026-07-01', value: 1_100_000 });
    await approvedMonth(flow, 2026, 10);

    // Act
    const fixed = await flow.payroll<{ setting: PayrollSettingDto; approvedMonthsTouched: string[] }>(
      'POST',
      `/settings/${setting.id}/correct`,
      { value: 1_200_000, source: 'Gõ sai' },
      201,
    );

    // Assert
    expect(fixed.setting).toMatchObject({ from: '2026-07-01', value: 1_200_000, supersededBy: null });
    expect(fixed.approvedMonthsTouched).toEqual(['2026-10']);
    const line = await lineOf(flow, '2026-10', 'luat.tran-tien-an');
    expect(line.inForce?.id).toBe(fixed.setting.id);
    expect(line.rows.map((r) => [r.value, r.status, r.supersededBy])).toEqual([
      [1_200_000, 'in-force', null],
      [1_100_000, 'superseded', fixed.setting.id],
    ]);
    expect(await logLines()).toContain(
      'Sửa lỗi Trần tiền ăn miễn thuế cho tất cả: 1.100.000 → 1.200.000, từ 01/07/2026. Nguồn: Gõ sai',
    );
  });

  it.todo('L-A11: should run the retroactive flow on the approved months a correction reaches (step 17)');

  it('L-A12: should edit and delete a value no approved month used, logging old → new', async () => {
    // Arrange
    await approvedMonth(flow, 2026, 10);
    const { setting } = await addSetting(flow, {
      key: 'luat.khau-tru-10',
      from: '2027-01-01',
      value: { rate: 0.1, threshold: 5_000_000 },
    });
    const future = await addSetting(flow, { key: 'luat.luong-co-so', from: '2027-07-01', value: 2_700_000 });

    // Act
    const edited = await flow.payroll<{ setting: PayrollSettingDto }>('PUT', `/settings/${setting.id}`, {
      value: { rate: 0.1, threshold: 6_000_000 },
    });
    await flow.payroll('DELETE', `/settings/${future.setting.id}`);

    // Assert
    expect(edited.setting.value).toEqual({ rate: 0.1, threshold: 6_000_000 });
    expect(await valueIn(flow, '2027-07', 'luat.luong-co-so')).toBe('default');
    expect(await logLines()).toEqual(
      expect.arrayContaining([
        'Sửa Khấu trừ 10%: tỷ lệ và ngưỡng một lần chi cho tất cả: rate 10%, threshold 5.000.000 → rate 10%, threshold 6.000.000, từ 01/01/2027',
        'Xoá Lương cơ sở cho tất cả: 2.700.000, từ 01/07/2027',
      ]),
    );
  });

  it.todo('L-A12: should recompute a draft month a change touches (step 15)');

  it('L-A13: should refuse a second value on the same date and point to Sửa lỗi', async () => {
    // Arrange
    const deduction = { personal: 15_500_000, dependant: 6_200_000 };
    await addSetting(flow, { key: 'luat.giam-tru', from: '2026-01-01', value: deduction });

    // Act
    const res = await addSetting(flow, { key: 'luat.giam-tru', from: '2026-01-01', value: deduction }, 409);

    // Assert
    expect(res).toMatchObject({ error: 'Đã có mức từ 01/01/2026. Dùng Sửa lỗi.' });
  });

  it('L-A14: should refuse to delete the only value of months the default does not reach', async () => {
    // Arrange: a row from 08/2025, before the engine's default starts (2026-01)
    const { setting } = await addSetting(flow, { key: 'quy-tac.ty-le-thu-viec', from: '2025-08', value: 0.9 });

    // Act
    const res = await flow.payroll<{ error: string }>('DELETE', `/settings/${setting.id}`, undefined, 422);

    // Assert
    expect(res.error).toBe('T8/2025–T12/2025 sẽ không có mức.');
  });

  it('L-A14: should let a later value be deleted, the earlier one taking its months back', async () => {
    // Arrange
    await addSetting(flow, { key: 'quy-tac.ty-le-thu-viec', from: '2025-08', value: 0.9 });
    const later = await addSetting(flow, { key: 'quy-tac.ty-le-thu-viec', from: '2025-11', value: 0.95 });

    // Act
    await flow.payroll('DELETE', `/settings/${later.setting.id}`);

    // Assert
    expect(await valueIn(flow, '2025-12', 'quy-tac.ty-le-thu-viec')).toBe(0.9);
  });
});

describe('L-A08 a change reaching an approved month', () => {
  it('L-A08: should save it and name the approved months it reaches, leaving the choice to HR', async () => {
    // Arrange
    await approvedMonth(flow, 2026, 10);

    // Act
    const saved = await addSetting(flow, {
      key: 'luat.luong-toi-thieu-vung',
      from: '2026-10-01',
      value: { I: 5_500_000, II: 4_900_000, III: 4_300_000, IV: 3_850_000 },
    });

    // Assert
    expect(saved.approvedMonthsTouched).toEqual(['2026-10']);
  });

  it.todo('L-A08: should show the difference per person and create back pay in the next draft (step 17)');
  it.todo('L-A09: should default to "chỉ ghi nhận" for a tax law over a whole year (step 17)');
});

describe('L-A15 – L-A16 law parameters', () => {
  it.todo(
    'L-A15: the BHXH, BHYT cap follows the base salary and the BHTN cap the zone: computed by the engine (lawParamsFor), no cap is stored',
  );

  it('L-A16: should version the whole tax table when one bracket changes, the old table kept for earlier months', async () => {
    // Arrange
    const table = (second: number) => [
      { upTo: 10_000_000, rate: 0.05 },
      { upTo: 30_000_000, rate: second },
      { upTo: 60_000_000, rate: 0.2 },
      { upTo: 100_000_000, rate: 0.3 },
      { upTo: null, rate: 0.35 },
    ];
    await addSetting(flow, { key: 'luat.bieu-thue', from: '2026-01-01', value: table(0.1) });

    // Act
    await addSetting(flow, { key: 'luat.bieu-thue', from: '2027-01-01', value: table(0.12) });

    // Assert
    expect(await valueIn(flow, '2026-11', 'luat.bieu-thue')).toEqual(table(0.1));
    expect(await valueIn(flow, '2026-12', 'luat.bieu-thue')).toEqual(table(0.12));
  });
});

describe('saving a value: what is refused', () => {
  it('should refuse an unknown key, a person on a key for everyone only, and a month where a date is needed', async () => {
    // Arrange
    const { a } = await people();

    // Act + Assert
    await addSetting(flow, { key: 'khong.co', from: '2026-12', value: 1 }, 422);
    await addSetting(flow, { key: 'tuy-chon.d01', employeeId: a.id, from: '2026-12', value: 'as-hr' }, 422);
    await addSetting(flow, { key: 'luat.luong-co-so', from: '2026-12', value: 2_600_000 }, 422);
    await addSetting(flow, { key: 'quy-tac.gio-mot-ngay', from: '2026-12-01', value: 8 }, 422);
    await addSetting(flow, { key: 'quy-tac.gio-mot-ngay', from: '2026-12' }, 422);
  });
});

describe('L-A32 the configuration of one month', () => {
  it('L-A32: should show what T7/2026 used, what came later and what was replaced, with the number of overrides', async () => {
    // Arrange
    const { a } = await people();
    await addSetting(flow, { key: 'quy-tac.gio-mot-ngay', from: '2026-01', value: 8 });
    const wrong = await addSetting(flow, { key: 'quy-tac.gio-mot-ngay', from: '2026-06', value: 7 });
    await flow.payroll('POST', `/settings/${wrong.setting.id}/correct`, { value: 7.5 }, 201);
    await addSetting(flow, { key: 'quy-tac.gio-mot-ngay', from: '2026-09', value: 8 });
    await addSetting(flow, { key: 'quy-tac.gio-mot-ngay', employeeId: a.id, from: '2026-07', value: 6 });

    // Act
    const view = await viewOf(flow, '2026-07');

    // Assert
    const line = view.lines.find((l) => l.key === 'quy-tac.gio-mot-ngay');
    expect(view).toMatchObject({ month: '2026-07', payDate: '2026-08-05', insuranceDate: '2026-07-01' });
    expect(line?.inForce?.value).toBe(7.5);
    expect(line?.overrides).toBe(1);
    expect(line?.rows.filter((r) => r.employeeId === null).map((r) => [r.from, r.value, r.status])).toEqual([
      ['2026-09', 8, 'upcoming'],
      ['2026-06', 7.5, 'in-force'],
      ['2026-06', 7, 'superseded'],
      ['2026-01', 8, 'past'],
    ]);
    expect(view.lines.some((l) => l.key === 'luat.bh-nld' && l.inForce === null)).toBe(true);
  });
});

describe('cases that need later steps', () => {
  it.todo(
    'L-A01: an approved month downloads the same Excel after later changes (approval snapshot and Excel, steps 16, 23)',
  );
  it.todo('L-A06: paying later than the approved pay date warns when it crosses a tax date (step 16)');
  it.todo('L-A23: see hr-payroll-profiles.test.ts (needs profiles, step 14)');
  it.todo('L-A31: a new formula version leaves approved months as they are (step 16)');
});
