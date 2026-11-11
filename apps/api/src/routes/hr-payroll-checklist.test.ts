import type { PayrollChecklistDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { payrollLog } from '../db/schema.js';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Danh sách kiểm trước tháng lương đầu (spec-luong.md 17.2, 11.5; docs/test-cases-luong.md L-B28): facts about each
 * person the web runs on by default until HR confirms them. People are fake.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
  await givePayrollRight(flow);
});

const checklist = () => flow.payroll<PayrollChecklistDto>('GET', '/first-month-checklist');

describe('L-B28 the check before the first payroll month', () => {
  it('L-B28: should list every item for each person with the default in use, red until confirmed, the commitment yellow', async () => {
    // Arrange
    await flow.addPerson({ code: 'NV01', fullName: 'NV A', employment: 'probation', joinedOn: '2026-09-01' });
    await flow.addPerson({ code: 'NV02', fullName: 'NV B', joinedOn: '2025-03-01' });
    await flow.addPerson({ code: 'NV09', fullName: 'NV I', joinedOn: '2025-03-01', leftOn: '2026-09-30' });

    // Act
    const list = await checklist();

    // Assert
    expect(list.month).toBe('2026-11');
    expect(list.people.map((p) => p.code)).toEqual(['NV01', 'NV02']);
    const a = list.people[0]?.items.map((i) => [i.item, i.value, i.isDefault, i.level]);
    expect(a).toEqual([
      ['loai-hd', 'thu-viec (mặc định theo loại NV Thử việc)', true, 'red'],
      ['thu-viec', '60 ngày', true, 'red'],
      ['ngay', 'Vào 01/09/2026', false, 'red'],
      ['cam-ket-thue', 'Chưa có cam kết năm 2026', true, 'yellow'],
      ['nguoi-phu-thuoc', '0', true, 'red'],
      ['doan-vien', 'Không', true, 'red'],
      ['khoan-32', 'Không có', true, 'yellow'],
      ['muc-dien-thoai-trang-phuc', 'Chưa có hồ sơ', true, 'red'],
      ['so-du-dau-nam', '0', true, 'red'],
    ]);
    expect(list.unconfirmed).toBe(18);
  });

  it('L-B28: should show what HR entered, and take an item off once confirmed, with a log line', async () => {
    // Arrange
    const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', employment: 'probation', joinedOn: '2026-09-01' });
    await flow.payroll(
      'POST',
      `/profiles/${a.id}/versions`,
      { effectiveOn: '2026-09-01', contractTypeId: '12-thang', probationDays: 30, amounts: { 'xang-dt': 2_000_000 } },
      201,
    );

    // Act
    await flow.payroll('PUT', '/first-month-checks', { item: 'loai-hd', employeeId: a.id, confirmed: true });
    const list = await checklist();

    // Assert
    const items = list.people[0]?.items ?? [];
    expect(items.find((i) => i.item === 'loai-hd')).toMatchObject({
      value: '12-thang',
      isDefault: false,
      confirmed: true,
      confirmedBy: 'Lan',
      level: null,
    });
    expect(items.find((i) => i.item === 'thu-viec')?.value).toBe('30 ngày');
    expect(items.find((i) => i.item === 'muc-dien-thoai-trang-phuc')?.value).toBe('xang-dt 2.000.000');
    expect(list.unconfirmed).toBe(8);
    const lines = await flow.t.db.select().from(payrollLog);
    expect(lines.map((l) => [l.area, l.detail])).toContainEqual(['ho-so', 'Xác nhận Loại HĐ của NV01 NV A']);
  });

  it('L-B28: should take the dates from Chấm công, confirmed there, and refuse a person item without the person', async () => {
    // Arrange
    const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2026-09-01', joinedOnConfirmed: true });

    // Act
    const list = await checklist();

    // Assert
    expect(list.people[0]?.items.find((i) => i.item === 'ngay')).toMatchObject({ confirmed: true, level: null });
    await flow.payroll('PUT', '/first-month-checks', { item: 'ngay', employeeId: a.id, confirmed: true }, 422);
    await flow.payroll('PUT', '/first-month-checks', { item: 'loai-hd', confirmed: true }, 422);
  });

  it.todo(
    'L-B28: Rà soát of the first month is red while an item is unconfirmed, and a click opens its cell (steps 15, 21)',
  );
});
