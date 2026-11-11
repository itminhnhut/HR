import { beforeEach, describe, expect, it } from 'vitest';
import { demoHrPassword, mockApi, resetMockDb } from './mock';
import { DEMO_HR } from './mock-seed';
import { ApiError } from './types';

/** The demo's Cấu hình lương answers like the API (spec 6, R2, R5): versions from a month, overrides, field errors. */

beforeEach(async () => {
  resetMockDb(new Date());
  await mockApi.hrSignIn(DEMO_HR.email, demoHrPassword());
});

const lineOf = async (month: string, key: string) =>
  (await mockApi.hrPayrollSettingsMonth(month)).lines.find((l) => l.key === key);

describe('the demo payroll settings', () => {
  it('should read a law parameter on day 1 of the month and a tax one on the pay date (R2)', async () => {
    // Act
    const month = await mockApi.hrPayrollSettingsMonth('2026-11');

    // Assert
    expect(month.lines.find((l) => l.key === 'luat.luong-co-so')?.readOn).toBe('2026-11-01');
    expect(month.lines.find((l) => l.key === 'luat.giam-tru')?.readOn).toBe('2026-12-05');
    expect(month.lines.find((l) => l.key === 'quy-tac.ty-le-thu-viec')?.inForce).toBeNull();
  });

  it("L-L03: should count NV A's own meal tax row as one override", async () => {
    // Act
    const line = await lineOf('2026-11', 'khoan.com.thue');

    // Assert
    expect(line?.overrides).toBe(1);
    expect(line?.inForce).toBeNull();
  });

  it('L-L02: should add a version for everyone from a month and leave earlier months alone', async () => {
    // Act
    await mockApi.hrPayrollAddSetting({ key: 'quy-tac.ty-le-thu-viec', from: '2026-12', value: 0.95, source: 'QĐ' });

    // Assert
    expect((await lineOf('2026-11', 'quy-tac.ty-le-thu-viec'))?.inForce).toBeNull();
    expect((await lineOf('2026-11', 'quy-tac.ty-le-thu-viec'))?.rows[0]?.status).toBe('upcoming');
    expect((await lineOf('2026-12', 'quy-tac.ty-le-thu-viec'))?.inForce?.value).toBe(0.95);
  });

  it('L-A24: should refuse a probation rate under the law with an error on the value', async () => {
    // Act
    const error = await mockApi
      .hrPayrollAddSetting({ key: 'quy-tac.ty-le-thu-viec', from: '2026-12', value: 0.8 })
      .catch((e: unknown) => e);

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect(error instanceof ApiError && error.fieldErrors.value).toBe('Luật tối thiểu 85% (BLLĐ Đ.26).');
  });

  it('L-A13: should refuse a second row on the same date and point to Sửa lỗi', async () => {
    // Arrange
    const input = { key: 'luat.giam-tru', from: '2027-01-01', value: { personal: 16_000_000, dependant: 6_400_000 } };
    await mockApi.hrPayrollAddSetting(input);

    // Act
    const error = await mockApi.hrPayrollAddSetting(input).catch((e: unknown) => e);

    // Assert
    expect(error instanceof ApiError && error.status).toBe(409);
    expect(error instanceof ApiError && error.message).toBe('Đã có mức từ 01/01/2027. Dùng Sửa lỗi.');
  });

  it('L-L01: should end a person override with a stop row from a month, keeping it for months before', async () => {
    // Act
    await mockApi.hrPayrollAddSetting({ key: 'khoan.com.thue', employeeId: 'nv-a', from: '2027-03', stop: true });

    // Assert
    expect((await lineOf('2027-02', 'khoan.com.thue'))?.overrides).toBe(1);
    expect((await lineOf('2027-03', 'khoan.com.thue'))?.overrides).toBe(0);
  });

  it('L-A11: should keep the old row marked replaced on Sửa lỗi', async () => {
    // Arrange
    const saved = await mockApi.hrPayrollAddSetting({ key: 'quy-tac.gio-mot-ngay', from: '2026-12', value: 7 });

    // Act
    await mockApi.hrPayrollCorrectSetting(saved.setting.id, { value: 7.5, source: 'Gõ nhầm' });

    // Assert
    const line = await lineOf('2026-12', 'quy-tac.gio-mot-ngay');
    expect(line?.inForce?.value).toBe(7.5);
    expect(line?.rows.map((r) => r.status)).toEqual(['in-force', 'superseded']);
  });
});
