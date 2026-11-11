import type { EmployeeDto, PayrollLogPageDto, PayrollMonthDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hrUsers } from '../db/schema.js';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Duyệt, Mở lại, Đã chuyển khoản (spec-luong.md R4, R7, 11.4, step 16; docs/test-cases-luong.md L-E01–L-E05,
 * L-E08–L-E10, L-E12, L-E13, L-M01, L-M03–L-M05). A made-up company in November 2026: NV A with a profile, NV C
 * without one (a red warning on the month).
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

type Error422 = { error: string; fieldErrors: Record<string, string> };

const monthOf = (key: string) => flow.payroll<PayrollMonthDto>('GET', `/months/${key}`);
const approve = (key: string, acknowledgedRed = true, expected = 200) =>
  flow.payroll<PayrollMonthDto>('POST', `/months/${key}/approve`, { acknowledgedRed }, expected);
const reopen = (key: string, reason: string, expected = 200) =>
  flow.payroll<PayrollMonthDto>('POST', `/months/${key}/reopen`, { reason }, expected);
const markPaid = (key: string, body: Record<string, unknown>, expected = 200) =>
  flow.payroll<PayrollMonthDto>('POST', `/months/${key}/paid`, body, expected);
const monthLog = async (key: string) =>
  (await flow.payroll<PayrollLogPageDto>('GET', `/log?ky=${key}&nhom=bang-luong`)).lines.map((l) => l.action).reverse();
const frozen = (m: PayrollMonthDto) => ({ lines: m.lines, totals: m.totals, review: m.review, payDate: m.payDate });

async function hireAndCloseNovember(): Promise<{ a: EmployeeDto }> {
  await givePayrollRight(flow);
  const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01' });
  await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2025-06-01' });
  const amounts = { luong: 9_000_000, com: 1_100_000 };
  await flow.payroll(
    'POST',
    `/profiles/${a.id}/versions`,
    { effectiveOn: '2025-03-01', contractTypeId: 'khong-thoi-han', amounts },
    201,
  );
  await flow.at('2026-11-26');
  await flow.close(2026, 11);
  return { a };
}

async function closeDecember() {
  await flow.at('2026-12-26');
  await flow.close(2026, 12);
}

/** A minute later, so log lines of one test keep their order. */
const tick = () => {
  flow.t.clock.now = new Date(flow.t.clock.now.getTime() + 60_000);
};

const withoutApproveRight = () => flow.t.db.update(hrUsers).set({ canPayroll: true, canApprovePayroll: false });

describe('L-E03, L-E05 Duyệt freezes the month', () => {
  it('L-E03: should keep the numbers of the draft as approval 1, by the signed-in HR', async () => {
    // Arrange
    await hireAndCloseNovember();
    const draft = await monthOf('2026-11');

    // Act
    const approved = await approve('2026-11');

    // Assert
    expect(approved).toMatchObject({ status: 'approved', computedAt: null, paidOn: null });
    expect(approved.approval).toMatchObject({ no: 1, at: '2026-11-26T03:00:00.000Z' });
    expect(approved.approval?.by).toBeTruthy();
    expect(frozen(approved)).toEqual(frozen(draft));
    expect(await monthOf('2026-11')).toEqual(approved);
  });

  it('L-E05: should not move a dong when a profile, a dependant and a setting change after the approval', async () => {
    // Arrange
    const { a } = await hireAndCloseNovember();
    const approved = await approve('2026-11');
    const raise = {
      effectiveOn: '2026-11-01',
      contractTypeId: 'khong-thoi-han',
      amounts: { luong: 15_000_000, com: 1_100_000 },
    };

    // Act
    await flow.payroll('POST', `/profiles/${a.id}/versions`, raise, 201);
    await flow.payroll('POST', `/profiles/${a.id}/dependants`, { fromMonth: '2026-11', count: 2 }, 201);
    await flow.updatePerson(a, { fullName: 'NV A mới' });
    await flow.at('2026-12-02');
    const later = await monthOf('2026-11');

    // Assert: the approval is as it was; the view only says where the difference goes (R6)
    expect({ ...later, retroOut: null }).toEqual(approved);
    expect(later.retroOut).toMatchObject({ month: '2026-12', people: 1 });
    expect(later.lines[0]?.amounts.luong).toBe(9_000_000);
  });

  it('L-E04: should refuse typed inputs on the approved month with 409', async () => {
    // Arrange
    const { a } = await hireAndCloseNovember();
    await approve('2026-11');

    // Act
    const body = await flow.payroll<{ code: string }>(
      'PUT',
      `/months/2026-11/lines/${a.id}/inputs`,
      { overtimeHours: 2 },
      409,
    );

    // Assert
    expect(body.code).toBe('payroll_month_locked');
  });
});

describe('L-E01, L-M01 what Duyệt needs', () => {
  it('L-M01: should refuse with 422 while a red warning is not acknowledged, and change nothing', async () => {
    // Arrange
    await hireAndCloseNovember();
    const draft = await monthOf('2026-11');

    // Act
    const body = await flow.payroll<Error422>('POST', '/months/2026-11/approve', { acknowledgedRed: false }, 422);

    // Assert
    expect(draft.review.some((i) => i.level === 'red')).toBe(true);
    expect(body.error).toMatch(/Đã xem cảnh báo đỏ/);
    expect((await monthOf('2026-11')).status).toBe('draft');
    expect(await monthLog('2026-11')).toEqual([]);
  });

  it('L-E01: should refuse a month still waiting for its close, and a month already approved, with 409', async () => {
    // Arrange
    await hireAndCloseNovember();
    await approve('2026-11');

    // Act
    const waiting = await flow.payroll<{ error: string }>(
      'POST',
      '/months/2026-12/approve',
      { acknowledgedRed: true },
      409,
    );
    const again = await flow.payroll<{ error: string }>(
      'POST',
      '/months/2026-11/approve',
      { acknowledgedRed: true },
      409,
    );

    // Assert
    expect(waiting.error).toMatch(/chốt công/);
    expect(again.error).toMatch(/đã duyệt/);
  });

  it('L-E02: should refuse Duyệt and Mở lại with 403 without the approve right, but allow Đã chuyển khoản', async () => {
    // Arrange
    await hireAndCloseNovember();
    await approve('2026-11');
    await withoutApproveRight();

    // Act
    const reopened = await flow.payroll<{ code: string }>('POST', '/months/2026-11/reopen', { reason: 'Sai' }, 403);
    const paid = await markPaid('2026-11', { paidOn: '2026-12-05' });
    await flow.payroll('POST', '/months/2026-12/approve', { acknowledgedRed: true }, 403);

    // Assert
    expect(reopened.code).toBe('no_payroll_approve');
    expect(paid).toMatchObject({ status: 'paid', paidOn: '2026-12-05' });
  });
});

describe('L-E09, L-E10, L-E12, L-E13 Mở lại', () => {
  it('L-E09: should ask for a reason, then go back to a draft computed again', async () => {
    // Arrange
    const { a } = await hireAndCloseNovember();
    await approve('2026-11');
    const raise = {
      effectiveOn: '2026-11-01',
      contractTypeId: 'khong-thoi-han',
      amounts: { luong: 15_000_000, com: 1_100_000 },
    };
    await flow.payroll('POST', `/profiles/${a.id}/versions`, raise, 201);

    // Act
    const empty = await flow.payroll<Error422>('POST', '/months/2026-11/reopen', { reason: '  ' }, 422);
    const draft = await reopen('2026-11', 'Tăng lương NV A từ 01/11');

    // Assert
    expect(empty.fieldErrors.reason).toBe('Ghi lý do mở lại.');
    expect(draft).toMatchObject({ status: 'draft', approval: null });
    expect(draft.lines[0]?.amounts.luong).toBe(15_000_000);
  });

  it('L-E12, L-E13: should approve again as approval 2 and log each step with its number', async () => {
    // Arrange
    await hireAndCloseNovember();
    const first = await approve('2026-11');
    tick();
    await reopen('2026-11', 'Kiểm lại');
    tick();

    // Act
    const second = await approve('2026-11');

    // Assert
    expect(second.approval?.no).toBe(2);
    expect(frozen(second)).toEqual(frozen(first));
    expect(await monthLog('2026-11')).toEqual(['Duyệt', 'Mở lại', 'Duyệt']);
    const page = await flow.payroll<PayrollLogPageDto>('GET', '/log?ky=2026-11&nhom=bang-luong');
    const details = page.lines.map((l) => l.detail).reverse();
    expect(details[0]).toMatch(/^Duyệt lần 1/);
    expect(details[1]).toMatch(/^Mở lại bản duyệt lần 1, lý do: Kiểm lại/);
    expect(details[2]).toMatch(/^Duyệt lần 2.*không chênh với lần 1/);
  });

  it('L-E10: should reopen only the latest approved month', async () => {
    // Arrange
    await hireAndCloseNovember();
    await approve('2026-11');
    await closeDecember();
    await approve('2026-12');

    // Act
    const older = await flow.payroll<{ error: string }>('POST', '/months/2026-11/reopen', { reason: 'Sai' }, 409);
    await reopen('2026-12', 'Sai');
    const thenOlder = await reopen('2026-11', 'Sai');

    // Assert
    expect(older.error).toMatch(/Mở lại T12\/2026 trước/);
    expect(thenOlder.status).toBe('draft');
  });

  it('should refuse a draft with 409', async () => {
    // Arrange
    await hireAndCloseNovember();

    // Act
    const body = await flow.payroll<{ error: string }>('POST', '/months/2026-11/reopen', { reason: 'Sai' }, 409);

    // Assert
    expect(body.error).toMatch(/chưa duyệt/);
  });
});

describe('L-E08, L-M05 Đã chuyển khoản', () => {
  it('L-E08: should mark an approved month paid on a day, keep its numbers, and then refuse Mở lại', async () => {
    // Arrange
    await hireAndCloseNovember();
    const approved = await approve('2026-11');
    tick();

    // Act
    const paid = await markPaid('2026-11', { paidOn: '2026-12-05', note: 'Chuyển qua ngân hàng' });
    const refused = await flow.payroll<{ error: string }>('POST', '/months/2026-11/reopen', { reason: 'Sai' }, 409);

    // Assert
    expect(paid).toMatchObject({ status: 'paid', paidOn: '2026-12-05', approval: approved.approval });
    expect(frozen(paid)).toEqual(frozen(approved));
    expect(await monthOf('2026-11')).toEqual(paid);
    expect(refused.error).toMatch(/đã chuyển khoản/);
    const page = await flow.payroll<PayrollLogPageDto>('GET', '/log?ky=2026-11&nhom=bang-luong');
    expect(page.lines[0]).toMatchObject({ action: 'Đã chuyển khoản' });
    expect(page.lines[0]?.detail).toBe('Bản duyệt lần 1, chuyển khoản ngày 05/12/2026. Ghi chú: Chuyển qua ngân hàng');
  });

  it('should refuse a draft with 409 and a day that is not a day with 422', async () => {
    // Arrange
    await hireAndCloseNovember();

    // Act
    const draft = await flow.payroll<{ error: string }>('POST', '/months/2026-11/paid', { paidOn: '2026-12-05' }, 409);
    await approve('2026-11');
    const wrong = await flow.payroll<Error422>('POST', '/months/2026-11/paid', { paidOn: '2026-13-40' }, 422);
    const twice = await markPaid('2026-11', { paidOn: '2026-12-05' });
    const again = await flow.payroll<{ error: string }>('POST', '/months/2026-11/paid', { paidOn: '2026-12-06' }, 409);

    // Assert
    expect(draft.error).toMatch(/đã duyệt/);
    expect(wrong.fieldErrors.paidOn).toBe('Chọn ngày chuyển khoản.');
    expect(twice.paidOn).toBe('2026-12-05');
    expect(again.error).toMatch(/đã duyệt/);
  });
});
