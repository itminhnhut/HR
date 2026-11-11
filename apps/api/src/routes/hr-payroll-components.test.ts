import { asc } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { payrollLog } from '../db/schema.js';
import { addSetting, approvedMonth, givePayrollRight, valueIn } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Khoản lương, quy tắc, tuỳ chọn, loại HĐ (spec-luong.md 5.9, 6.2, 9; docs/test-cases-luong.md L-A17–L-A29). Keys and
 * value shapes are the engine's; "default" means no stored row applies. Amounts are illustrative.
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

describe('L-A17 – L-A23 pay components', () => {
  it('L-A17: should change how Xăng xe + ĐT is taxed from T12 only', async () => {
    // Arrange + Act
    await addSetting(flow, { key: 'khoan.xang-dt.thue', from: '2026-12', value: { kind: 'cap', cap: 'regulated' } });
    await addSetting(flow, {
      key: 'khoan.xang-dt.muc-quy-che',
      from: '2026-12',
      value: 1_000_000,
      source: 'Quy chế CTP',
    });

    // Assert
    expect(await valueIn(flow, '2026-11', 'khoan.xang-dt.thue')).toBe('default');
    expect(await valueIn(flow, '2026-12', 'khoan.xang-dt.thue')).toEqual({ kind: 'cap', cap: 'regulated' });
    expect(await valueIn(flow, '2026-12', 'khoan.xang-dt.muc-quy-che')).toBe(1_000_000);
  });

  it('L-A18: should take Chuyên cần out of the insurance salary from T12 only', async () => {
    // Arrange + Act
    await addSetting(flow, { key: 'khoan.chuyen-can.tinh-bh', from: '2026-12', value: false });

    // Assert
    expect(await valueIn(flow, '2026-11', 'khoan.chuyen-can.tinh-bh')).toBe('default');
    expect(await valueIn(flow, '2026-12', 'khoan.chuyen-can.tinh-bh')).toBe(false);
  });

  it('L-A19: should add a component from T11 as a new version of the list', async () => {
    // Arrange
    const travel = {
      id: 'di-lai',
      name: 'Phụ cấp đi lại',
      order: 9,
      perDay: true,
      probationRate: true,
      insured: false,
      contractPay: false,
      overtimeBase: true,
      tax: { kind: 'taxable' },
      defaultAmount: 300_000,
      regulatedCap: null,
      stoppedFrom: null,
    };

    // Act
    await addSetting(flow, { key: 'khoan.danh-sach', from: '2026-11', value: [travel] });

    // Assert
    expect(await valueIn(flow, '2026-10', 'khoan.danh-sach')).toBe('default');
    expect(await valueIn(flow, '2026-11', 'khoan.danh-sach')).toEqual([travel]);
  });

  it('L-A19: should refuse a list with two components of the same id', async () => {
    // Arrange
    const one = {
      id: 'com',
      name: 'Tiền cơm',
      order: 1,
      perDay: true,
      probationRate: true,
      insured: false,
      contractPay: false,
      overtimeBase: true,
      tax: { kind: 'exempt' },
      defaultAmount: 0,
      regulatedCap: null,
      stoppedFrom: null,
    };

    // Act
    const res = await addSetting(flow, { key: 'khoan.danh-sach', from: '2026-11', value: [one, one] }, 422);

    // Assert
    expect(res).toMatchObject({ error: 'Hai khoản trùng mã.' });
  });

  it('L-A20: should rename a component from T12, earlier months keeping the old name', async () => {
    // Arrange + Act
    await addSetting(flow, { key: 'khoan.nha-o.ten', from: '2026-12', value: 'Phụ cấp nhà ở' });

    // Assert
    expect(await valueIn(flow, '2026-11', 'khoan.nha-o.ten')).toBe('default');
    expect(await valueIn(flow, '2026-12', 'khoan.nha-o.ten')).toBe('Phụ cấp nhà ở');
  });

  it.todo('L-A20: should title a summary of several months with the newest name and note the old one (Excel, step 23)');

  it('L-A21: should refuse to delete a component list an approved month used, and stop the component instead', async () => {
    // Arrange
    const { setting } = await addSetting(flow, { key: 'khoan.danh-sach', from: '2026-01', value: [clothing()] });
    await approvedMonth(flow, 2026, 10);

    // Act
    const refused = await flow.payroll<{ error: string }>('DELETE', `/settings/${setting.id}`, undefined, 409);
    await addSetting(flow, { key: 'khoan.trang-phuc.ngung', from: '2026-12', value: '2026-12' });

    // Assert
    expect(refused.error).toBe('Đã dùng ở T10/2026 đã duyệt. Dùng Ngừng từ tháng.');
    expect(await valueIn(flow, '2026-11', 'khoan.trang-phuc.ngung')).toBe('default');
    expect(await valueIn(flow, '2026-12', 'khoan.trang-phuc.ngung')).toBe('2026-12');
  });

  it('L-A22: should delete a component list nobody used, and log it', async () => {
    // Arrange
    const { setting } = await addSetting(flow, { key: 'khoan.danh-sach', from: '2026-12', value: [clothing()] });

    // Act
    await flow.payroll('DELETE', `/settings/${setting.id}`);

    // Assert
    expect(await valueIn(flow, '2026-12', 'khoan.danh-sach')).toBe('default');
    expect(await logLines()).toContain('Xoá Khoản lương cho tất cả: Trang phục, từ T12/2026');
  });
});

describe('L-A24 – L-A29 rules, options, contract types', () => {
  it('L-A24: should take a probation rate of 85% from T12 and refuse 80%', async () => {
    // Arrange + Act
    await addSetting(flow, { key: 'quy-tac.ty-le-thu-viec', from: '2026-12', value: 0.85 });
    const refused = await addSetting(flow, { key: 'quy-tac.ty-le-thu-viec', from: '2027-01', value: 0.8 }, 422);

    // Assert
    expect(refused).toMatchObject({ error: 'Luật tối thiểu 85% (BLLĐ Đ.26).' });
    expect(await valueIn(flow, '2026-11', 'quy-tac.ty-le-thu-viec')).toBe('default');
    expect(await valueIn(flow, '2026-12', 'quy-tac.ty-le-thu-viec')).toBe(0.85);
  });

  it('L-A25: should take overtime at 180% from T12 and refuse 140%', async () => {
    // Arrange + Act
    await addSetting(flow, {
      key: 'quy-tac.he-so-lam-them',
      from: '2026-12',
      value: { weekday: 1.8, restDay: 2, holiday: 3 },
    });
    const refused = await addSetting(
      flow,
      { key: 'quy-tac.he-so-lam-them', from: '2027-01', value: { weekday: 1.4, restDay: 2, holiday: 3 } },
      422,
    );

    // Assert
    expect(refused).toMatchObject({ error: 'Dưới mức luật: tối thiểu 150% (BLLĐ Đ.98).' });
    expect(await valueIn(flow, '2026-12', 'quy-tac.he-so-lam-them')).toEqual({ weekday: 1.8, restDay: 2, holiday: 3 });
  });

  it('L-A26: should leave the KPI % of the BO block to HR from T12 only', async () => {
    // Arrange + Act
    const typed = { BO: 'typed', KD: 'typed' };
    await addSetting(flow, { key: 'quy-tac.kpi-theo-khoi', from: '2026-12', value: typed });

    // Assert
    expect(await valueIn(flow, '2026-11', 'quy-tac.kpi-theo-khoi')).toBe('default');
    expect(await valueIn(flow, '2026-12', 'quy-tac.kpi-theo-khoi')).toEqual(typed);
  });

  it('L-A27: should turn KPCĐ off only with a reason, from a month not yet approved, and warn it is required', async () => {
    // Arrange
    await approvedMonth(flow, 2026, 10);

    // Act
    const noReason = await addSetting(flow, { key: 'tuy-chon.d03', from: '2026-11', value: 'off' }, 422);
    const approved = await addSetting(
      flow,
      { key: 'tuy-chon.d03', from: '2026-10', value: 'off', source: 'Công ty xin miễn' },
      422,
    );
    const saved = await addSetting(flow, {
      key: 'tuy-chon.d03',
      from: '2026-11',
      value: 'off',
      source: 'Công ty xin miễn',
    });

    // Assert
    expect(noReason).toMatchObject({ error: 'Tắt KPCĐ phải ghi lý do.' });
    expect(approved).toMatchObject({ error: 'Chỉ áp từ tháng chưa duyệt: sau T10/2026.' });
    expect(saved.warnings).toEqual(['Bắt buộc theo Luật Công đoàn 2024 (Đ.29 k1 b).']);
    expect(await logLines()).toContain('Thêm D03 KPCĐ cho tất cả: off, từ T11/2026. Nguồn: Công ty xin miễn');
  });

  it('L-A28: should change a contract type’s insurance from T12 for everyone on it', async () => {
    // Arrange + Act
    await addSetting(flow, { key: 'loai-hd.12-thang.dong-bh', from: '2026-12', value: false });

    // Assert
    expect(await valueIn(flow, '2026-11', 'loai-hd.12-thang.dong-bh')).toBe('default');
    expect(await valueIn(flow, '2026-12', 'loai-hd.12-thang.dong-bh')).toBe(false);
  });

  it('L-A29: should rename a contract type from a month and refuse to delete a list an approved month used', async () => {
    // Arrange
    const { setting } = await addSetting(flow, { key: 'loai-hd.danh-sach', from: '2026-01', value: [probation()] });
    await approvedMonth(flow, 2026, 10);

    // Act
    await addSetting(flow, { key: 'loai-hd.thu-viec.ten', from: '2026-12', value: 'HĐ thử việc riêng' });
    await flow.payroll('DELETE', `/settings/${setting.id}`, undefined, 409);

    // Assert
    expect(await valueIn(flow, '2026-12', 'loai-hd.thu-viec.ten')).toBe('HĐ thử việc riêng');
  });

  it.todo('L-A29: a draft takes the contract name from the timesheet close (draft months, step 15)');
});

function clothing() {
  return {
    id: 'trang-phuc',
    name: 'Trang phục',
    order: 6,
    perDay: true,
    probationRate: true,
    insured: false,
    contractPay: false,
    overtimeBase: true,
    tax: { kind: 'cap', cap: 'clothing-year' },
    defaultAmount: 350_000,
    regulatedCap: null,
    stoppedFrom: null,
  };
}

function probation() {
  return {
    id: 'thu-viec',
    name: 'HĐ thử việc',
    insured: false,
    taxMethod: 'flat10',
    shortTerm: true,
    probationDays: 60,
  };
}
