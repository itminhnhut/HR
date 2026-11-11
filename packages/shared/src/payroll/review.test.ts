import { describe, expect, it } from 'vitest';
import { KPI_K } from '../../test-fixtures/payroll-fixtures.js';
import { codes, find, reviewMonth as month, rowInput } from '../../test-fixtures/payroll-review-inputs.js';
import { payrollConfigFor, payrollDates, reviewPayroll, type SettingRow } from './index.js';

/**
 * Rà soát as a pure function: a list of warnings (level, code, cell), never a block (spec 4.8, 11.3).
 * Cases: docs/test-cases-luong.md, review cases of groups C, D, E, L (and B02, B03, B12, B21, K1-13, K1-17).
 */

describe('a clean month', () => {
  it('should have nothing to say about an official person on full days with every field filled', () => {
    expect(reviewPayroll(month([rowInput()]))).toEqual([]);
  });
});

describe('red: Duyệt needs "Đã xem" (spec 11.3)', () => {
  it('L-B02: should flag a person with days in the closing and no profile, on a zero row', () => {
    // Act
    const items = reviewPayroll(month([rowInput({}, { line: null, profile: { exists: false, gap: null } })]));

    // Assert
    expect(codes(items)).toEqual(['red:missing-profile']);
    expect(items[0]?.message).toBe('NV A có công, chưa có hồ sơ, dòng 0 đồng');
  });

  it('L-B03: should flag days worked before the first pay level', () => {
    // Act
    const items = reviewPayroll(
      month([rowInput({}, { profile: { exists: true, gap: { from: '2026-10-07', to: '2026-10-14' } } })]),
    );

    // Assert
    expect(find(items, 'profile-gap')).toMatchObject({
      level: 'red',
      message: '07/10–14/10 có công nhưng chưa có mức',
    });
  });

  it('L-D14: should flag a negative net pay without blocking it', () => {
    // Act: advance 15 tr against a net pay of about 12 tr
    const items = reviewPayroll(month([rowInput({ amounts: { luong: 13_000_000 }, advance: 15_000_000 })]));

    // Assert
    expect(find(items, 'negative-net')).toMatchObject({ level: 'red', cell: 'netPay' });
  });

  it('L-B12, L-D16: should flag time pay under the zone minimum and the insurance salary raised to the floor', () => {
    // Act
    const items = reviewPayroll(month([rowInput({ amounts: { luong: 5_000_000 } })]));

    // Assert
    expect(find(items, 'below-zone-minimum')).toMatchObject({ level: 'red', cell: 'socialBase' });
    expect(find(items, 'insurance-floor')).toMatchObject({ level: 'yellow', cell: 'socialBase' });
  });

  it('should flag a missing block or contract type', () => {
    // Act
    const items = reviewPayroll(
      month([rowInput({}, { employment: { leftOn: null, contractTypeId: null, block: null, unconfirmedDates: [] } })]),
    );

    // Assert
    expect(codes(items)).toEqual(['red:missing-contract', 'red:missing-block']);
  });

  it('L-L29: should flag a date used for the split, insurance or 10% that HR has not confirmed', () => {
    // Act
    const items = reviewPayroll(
      month([
        rowInput(
          {},
          {
            employment: {
              leftOn: null,
              contractTypeId: 'khong-thoi-han',
              block: 'BO',
              unconfirmedDates: ['Ngày chính thức'],
            },
          },
        ),
      ]),
    );

    // Assert
    expect(find(items, 'unconfirmed-date')).toMatchObject({
      level: 'red',
      message: 'Ngày chính thức chưa được HR xác nhận',
    });
  });

  it('L-L30: should remind HR to confirm the closing in the first month on the web', () => {
    // Act
    const items = reviewPayroll(month([rowInput()], { firstWebMonth: true, closingConfirmed: false }));

    // Assert
    expect(codes(items)).toEqual(['red:closing-unconfirmed']);
    expect(items[0]?.employeeId).toBeNull();
  });
});

describe('yellow (spec 11.3)', () => {
  it('L-C09: should say a Sunday made up a weekday when it sits inside the paid days', () => {
    // Act: one Sunday worked, no overtime day
    const row = rowInput(
      {},
      { closing: { paid: 22, norm: 22, overtime: 0, sundayWorked: 1, leaveClosing: 0, leaveOverdrawn: 0 } },
    );

    // Assert
    expect(find(reviewPayroll(month([row])), 'sunday-makeup')).toMatchObject({
      level: 'yellow',
      message: 'CN bù ngày thường',
    });
  });

  it('L-C12: should say an overtime day has no overtime hours yet', () => {
    // Act: OT 1 from a third Saturday
    const row = rowInput(
      {},
      { closing: { paid: 22, norm: 22, overtime: 1, sundayWorked: 0, leaveClosing: 0, leaveOverdrawn: 0 } },
    );

    // Assert
    expect(find(reviewPayroll(month([row])), 'overtime-without-hours')).toMatchObject({
      message: 'OT 1 ngày chưa có giờ làm thêm',
    });
  });

  it('L-D05: should show the formula and the typed number when HR typed over a probation KPI %', () => {
    // Act
    const items = reviewPayroll(month([rowInput({ probation: true, days: 19.5, kpiAmount: KPI_K, kpiPercent: 0.85 })]));

    // Assert: 19,5 ÷ 22 × 90% = 79,77%
    expect(find(items, 'override-differs')).toMatchObject({
      level: 'yellow',
      cell: 'kpiPercent',
      message: '% KPI gõ 85% khác số tính 79,77%',
    });
  });

  it('L-D32: should say the typed paid days differ from the closing', () => {
    // Act
    const items = reviewPayroll(
      month([
        rowInput(
          { days: 20 },
          {
            inputs: { restDaysTyped: null, paidDaysTyped: 20, overtimeHoursBefore: 0 },
            closing: { paid: 21, norm: 22, overtime: 0, sundayWorked: 0, leaveClosing: 0, leaveOverdrawn: 0 },
          },
        ),
      ]),
    );

    // Assert
    expect(find(items, 'paid-days-override')).toMatchObject({
      cell: 'paidDays',
      message: 'Ngày công gõ 20 khác Chấm công 21',
    });
  });

  it('L-D10: should flag overtime beyond 40 hours a month and beyond 200 a year', () => {
    // Act
    const overMonth = reviewPayroll(month([rowInput({ overtime: { weekdayHours: 45, restDays: 0, holidayDays: 0 } })]));
    const overYear = reviewPayroll(
      month([
        rowInput(
          { overtime: { weekdayHours: 20, restDays: 0, holidayDays: 0 } },
          { inputs: { restDaysTyped: null, paidDaysTyped: null, overtimeHoursBefore: 190 } },
        ),
      ]),
    );

    // Assert
    expect(find(overMonth, 'overtime-limit')?.message).toBe('Làm thêm 45 giờ, vượt 40 giờ/tháng');
    expect(find(overYear, 'overtime-limit')?.message).toBe('Làm thêm cả năm 210 giờ, vượt 200 giờ/năm');
  });

  it('L-D33: should flag a change of more than 10% from the last approved month, with the known causes', () => {
    // Act
    const row = rowInput({}, { previous: { netPay: 15_000_000, causes: ['làm thêm'] } });

    // Assert
    expect(find(reviewPayroll(month([row])), 'change-over-10')?.message).toMatch(
      /^Thực nhận lệch \+\d+% so với tháng trước · làm thêm$/,
    );
  });

  it('L-D33: should not compare the first month on the web', () => {
    expect(find(reviewPayroll(month([rowInput()], { firstWebMonth: true })), 'change-over-10')).toBeUndefined();
  });

  it('L-D36: should flag a probation person paid from 5 tr without a commitment as withheld 10%', () => {
    // Act
    const items = reviewPayroll(month([rowInput({ probation: true, commitment: false, contractCommitment: false })]));

    // Assert
    expect(find(items, 'probation-no-commitment')).toMatchObject({
      level: 'yellow',
      cell: 'tax',
      message: 'Chưa có cam kết thuế — đang khấu trừ 10% (HĐ dưới 3 tháng, chi từ 5.000.000: NĐ 253/2026 Đ.50 k2)',
    });
  });

  it('should say nothing about the commitment of a probation person who has one, or is paid under the threshold', () => {
    // Act
    const signed = reviewPayroll(month([rowInput({ probation: true, commitment: true })]));
    const small = reviewPayroll(
      month([rowInput({ probation: true, commitment: false, contractCommitment: false, days: 2 })]),
    );

    // Assert
    expect(find(signed, 'probation-no-commitment')).toBeUndefined();
    expect(find(small, 'probation-no-commitment')).toBeUndefined();
  });

  it('should count the people not withheld thanks to the commitment in their contract, with the condition of the law', () => {
    // Act
    const onContract = rowInput({ probation: true, commitment: false });
    const items = reviewPayroll(month([onContract, { ...onContract, employeeId: 'nv-b' }, rowInput()]));

    // Assert
    expect(find(items, 'probation-no-commitment')).toBeUndefined();
    expect(find(items, 'contract-commitment')).toMatchObject({
      level: 'yellow',
      employeeId: null,
      message:
        '2 người không bị khấu trừ 10% nhờ cam kết thuế kèm hợp đồng — cam kết chỉ hợp lệ khi thu nhập ước tính cả năm sau giảm trừ gia cảnh chưa đến mức phải nộp thuế và người đó có mã số thuế (NĐ 253/2026 Đ.50 k2)',
    });
    expect(find(reviewPayroll(month([rowInput()])), 'contract-commitment')).toBeUndefined();
  });

  it('L-K1-17, L-D28: should flag a commitment whose yearly estimate passes the deductions', () => {
    // Arrange: estimate from an opening balance of 150 tr
    const row = rowInput({ probation: true, amounts: { luong: 30_000_000 } });
    const line = row.line;
    const withEstimate = line
      ? { ...line, tax: { ...line.tax, commitment: { annual: 218_400_000, limit: 186_000_000, exceeds: true } } }
      : null;

    // Act
    const items = reviewPayroll(month([{ ...row, line: withEstimate }]));

    // Assert
    expect(find(items, 'commitment-exceeds')).toMatchObject({
      level: 'yellow',
      cell: 'tax',
      message:
        'Thu nhập ước tính cả năm vượt mức được cam kết — nên khấu trừ 10% (ước tính 218.400.000 > 186.000.000; NĐ 253/2026 Đ.50 k2)',
    });
  });

  describe('L-B21: a commitment of the year before', () => {
    const lastYear = (over: Parameters<typeof rowInput>[0], year: number, month: number) => {
      const row = rowInput(over, { person: { hasCommitment: false, commitmentYear: 2026, hasBankAccount: true } });
      return { ...row, config: payrollConfigFor([], 'nv-a', payrollDates(year, month)) };
    };

    it('should ask for a new one in the first payroll month paid in the new year', () => {
      // Act: T12/2026 is paid on 05/01/2027
      const items = reviewPayroll(
        month([lastYear({ probation: true, commitment: false, contractCommitment: false }, 2026, 12)]),
      );

      // Assert
      expect(find(items, 'commitment-expired')).toMatchObject({
        level: 'yellow',
        cell: 'tax',
        message: 'Cần ký lại cam kết thuế năm 2027',
      });
    });

    it('should not ask again in the later months, nor in the months of the same year', () => {
      // Act: T01/2027 is paid in February; T11/2026 in December 2026
      const january = reviewPayroll(
        month([lastYear({ probation: true, commitment: false, contractCommitment: false }, 2027, 1)]),
      );
      const november = reviewPayroll(
        month([lastYear({ probation: true, commitment: false, contractCommitment: false }, 2026, 11)]),
      );

      // Assert
      expect(find(january, 'commitment-expired')).toBeUndefined();
      expect(find(november, 'commitment-expired')).toBeUndefined();
    });

    it('should not ask a person who signed for the new year already, or who is on the brackets now', () => {
      // Act
      const signed = lastYear({ probation: true, commitment: true, contractCommitment: false }, 2026, 12);
      const renewed = { ...signed, person: { hasCommitment: true, commitmentYear: 2027, hasBankAccount: true } };
      const official = lastYear({ probation: false }, 2026, 12);

      // Assert
      expect(find(reviewPayroll(month([renewed])), 'commitment-expired')).toBeUndefined();
      expect(find(reviewPayroll(month([official])), 'commitment-expired')).toBeUndefined();
    });
  });

  describe('insurance the company pays back for the employee', () => {
    const paidBack = (taxable: boolean, probation = false) =>
      reviewPayroll(month([rowInput({ probation, insurancePaid: { taxable } })]));

    it('should point out, without blocking, that it is not taxed while the law counts it as taxable income', () => {
      // Act
      const item = find(paidBack(false), 'insurance-paid-untaxed');

      // Assert
      expect(item).toMatchObject({ level: 'yellow', cell: 'cash' });
      expect(item?.message).toBe(
        'Công ty trả thay BH cho NLĐ nhưng chưa tính thuế — theo NĐ 253/2026 Đ.8 khoản lợi ích do người sử dụng lao động trả thay là thu nhập chịu thuế',
      );
    });

    it('should say nothing once it is taxed, or when the person pays no insurance', () => {
      expect(find(paidBack(true), 'insurance-paid-untaxed')).toBeUndefined();
      expect(find(paidBack(false, true), 'insurance-paid-untaxed')).toBeUndefined();
    });
  });

  it('should remind HR of leave left on leaving and the 14-working-day deadline (BLLĐ Đ.48)', () => {
    // Act: left 15/10 with 3 days left
    const row = rowInput(
      { leftOn: '2026-10-15' },
      {
        closing: { paid: 14, norm: 22, overtime: 0, sundayWorked: 0, leaveClosing: 3, leaveOverdrawn: 0 },
        employment: { leftOn: '2026-10-15', contractTypeId: 'khong-thoi-han', block: 'BO', unconfirmedDates: [] },
      },
    );

    // Assert: 14 working days after 15/10 is 04/11
    expect(find(reviewPayroll(month([row])), 'leave-left')?.message).toBe(
      'Còn 3 ngày phép khi nghỉ việc, trả trước 04/11/2026',
    );
  });

  it('L-K1-13: should only note leave beyond the balance on leaving, without taking more off', () => {
    // Act
    const row = rowInput(
      { leftOn: '2026-10-15' },
      {
        closing: { paid: 14, norm: 22, overtime: 0, sundayWorked: 0, leaveClosing: 0, leaveOverdrawn: 0.5 },
        employment: { leftOn: '2026-10-15', contractTypeId: 'khong-thoi-han', block: 'BO', unconfirmedDates: [] },
      },
    );

    // Assert
    expect(find(reviewPayroll(month([row])), 'leave-overdrawn')?.message).toBe(
      'Nghỉ quá phép 0,5 ngày, Chấm công đã không trả',
    );
  });

  it('should flag paid days above the norm and a missing bank account', () => {
    // Act
    const row = rowInput(
      {},
      {
        closing: { paid: 23, norm: 22, overtime: 0, sundayWorked: 0, leaveClosing: 0, leaveOverdrawn: 0 },
        person: { hasCommitment: false, commitmentYear: null, hasBankAccount: false },
      },
    );

    // Assert
    expect(codes(reviewPayroll(month([row])))).toEqual(['yellow:paid-days-over-norm', 'yellow:missing-bank-account']);
  });

  it('L-C13: should say insurance counted days of an open period are provisional', () => {
    // Arrange
    const row = rowInput();
    const line = row.line;
    const provisional = line
      ? { ...line, insurance: { ...line.insurance, status: { ...line.insurance.status, provisional: true } } }
      : null;

    // Act / Assert
    expect(find(reviewPayroll(month([{ ...row, line: provisional }])), 'insurance-provisional')?.level).toBe('yellow');
  });

  it('L-L19: should flag a person override that goes against a known law rule', () => {
    // Arrange: insurance switched off for one person on an insured contract
    const rows: SettingRow[] = [
      { key: 'loai-hd.khong-thoi-han.dong-bh', employeeId: 'nv-a', from: '2026-10', value: false },
    ];

    // Act
    const items = reviewPayroll(month([rowInput({ rows })]));

    // Assert
    expect(find(items, 'unlawful-override')).toMatchObject({
      level: 'yellow',
      message: 'Ghi đè riêng tắt đóng BH của HĐLĐ không xác định thời hạn',
    });
  });

  it('L-E06, L-E15: should warn about a draft previous month and retroactive changes not handled yet', () => {
    // Act
    const items = reviewPayroll(month([rowInput()], { previousMonthDraft: true, retroPending: 2 }));

    // Assert
    expect(codes(items)).toEqual(['yellow:previous-month-draft', 'yellow:retro-pending']);
  });
});
