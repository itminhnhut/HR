import type { PayrollLogPageDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { payrollLog } from '../db/schema.js';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Reading Nhật ký lương (spec-luong.md 11.9, step 22; docs/test-cases-luong.md L-I09): by person, by who did it, the
 * approval steps alone, and who has written at all. Made-up lines written straight into the table.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
  await givePayrollRight(flow);
});

const at = (minute: number) => new Date(Date.UTC(2026, 10, 5, 3, minute));

const LINES = [
  {
    area: 'bang-luong',
    actor: 'HR Một',
    action: 'Sửa đầu vào tháng',
    detail: 'NV01 NV A: % KPI trống → 80%',
    month: '2026-11',
    at: at(1),
  },
  {
    area: 'bang-luong',
    actor: 'HR Hai',
    action: 'Sửa đầu vào tháng',
    detail: 'NV010 NV K: ghi chú trống → "x"',
    month: '2026-11',
    at: at(2),
  },
  {
    area: 'cau-hinh',
    actor: 'HR Hai',
    action: 'Thêm',
    detail: 'Thêm Tiền cơm cho NV01 NV A: 900.000, từ T11/2026',
    month: '2026-11',
    at: at(3),
  },
  { area: 'bang-luong', actor: 'HR Một', action: 'Duyệt', detail: 'Duyệt lần 1: 2 người', month: '2026-10', at: at(4) },
  {
    area: 'bang-luong',
    actor: 'HR Một',
    action: 'Mở lại',
    detail: 'Mở lại bản duyệt lần 1, lý do: thử',
    month: '2026-10',
    at: at(5),
  },
  {
    area: 'bang-luong',
    actor: 'HR Một',
    action: 'Đã chuyển khoản',
    detail: 'Bản duyệt lần 2, chuyển khoản ngày 05/11/2026',
    month: '2026-10',
    at: at(6),
  },
] as const;

const read = (query: string, expected = 200) =>
  flow.payroll<PayrollLogPageDto>('GET', `/log${query}`, undefined, expected);
const details = (page: PayrollLogPageDto) => page.lines.map((l) => l.detail);

describe('L-I09 reading the payroll log', () => {
  beforeEach(async () => {
    await flow.t.db.insert(payrollLog).values([...LINES]);
  });

  it('should keep the lines of one person by their code, not those of a code that only starts the same', async () => {
    // Act
    const page = await read('?ma=NV01');

    // Assert
    expect(details(page)).toEqual([LINES[2].detail, LINES[0].detail]);
  });

  it('should keep the lines one HR made', async () => {
    // Act
    const page = await read(`?ai=${encodeURIComponent('HR Hai')}`);

    // Assert
    expect(page.lines.map((l) => l.actor)).toEqual(['HR Hai', 'HR Hai']);
  });

  it('should keep only Duyệt, Mở lại and Đã chuyển khoản when asked for the approval steps', async () => {
    // Act
    const page = await read('?loai=duyet');

    // Assert
    expect(page.lines.map((l) => l.action)).toEqual(['Đã chuyển khoản', 'Mở lại', 'Duyệt']);
  });

  it('should combine the filters with the month', async () => {
    // Act
    const page = await read(`?ky=2026-11&ma=NV01&ai=${encodeURIComponent('HR Một')}`);

    // Assert
    expect(details(page)).toEqual([LINES[0].detail]);
  });

  it('should name everyone who has written in the log, whatever the filter', async () => {
    // Act
    const page = await read('?ky=2026-10');

    // Assert
    expect(page.actors).toEqual(['HR Hai', 'HR Một']);
  });

  it('should refuse a kind it does not know', async () => {
    // Act
    const refused = await flow.payroll<{ error: string }>('GET', '/log?loai=khac', undefined, 422);

    // Assert
    expect(refused.error).toBe('Không đọc được nhật ký lương.');
  });
});
