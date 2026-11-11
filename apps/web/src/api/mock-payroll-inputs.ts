import {
  EMPTY_MONTH_INPUTS,
  fieldErrors,
  PAYROLL_INSURANCE_PAID,
  payrollMonthInputsSchema,
  toNumber,
  type PayrollLine,
  type PayrollLineInput,
  type PayrollMonthInputsDto,
  type PayrollOverrideDto,
} from '@careers/shared';
import type { MockPayrollProfile } from './mock-seed';
import { ApiError } from './types';

/**
 * Đầu vào tháng in the demo (spec-luong.md 2 (4), 5.3 (19), (21)–(24), (32)): what HR typed for a person this month,
 * applied to the engine input the way the API applies it, so the row on screen is the engine's own answer.
 */

type Values = Omit<PayrollMonthInputsDto, 'updatedBy' | 'updatedAt'>;
type Patch = Partial<Values>;

/** The demo's first month starts with NV J's 0% typed over the computed % KPI (the 0% of HR's file, L-L04). */
export function seededInputs(by: string, at: string): Record<string, PayrollMonthInputsDto> {
  return {
    'nv-j': { ...EMPTY_MONTH_INPUTS, kpiPercent: 0, note: 'Vào giữa kỳ, chưa giao KPI', updatedBy: by, updatedAt: at },
  };
}

const sumOf = (inputs: PayrollMonthInputsDto, kind: string) =>
  inputs.cash.filter((c) => c.kind === kind).reduce((s, c) => s + c.amount, 0);

/** The golden input with HR's numbers on top: (19) typed, overtime, other income, and (32) added to the profile's. */
export function withInputs(base: PayrollLineInput, inputs: PayrollMonthInputsDto): PayrollLineInput {
  const cash = base.cash ?? {};
  return {
    ...base,
    income: {
      ...base.income,
      kpiPercent: inputs.kpiPercent ?? base.income.kpiPercent,
      overtime: {
        weekdayHours: inputs.overtimeHours,
        restDays: inputs.restDays ?? 0,
        holidayDays: inputs.holidayDays ?? 0,
      },
      otherIncome: [...(base.income.otherIncome ?? []), ...inputs.otherIncome],
    },
    cash: {
      ...cash,
      support: (cash.support ?? 0) + sumOf(inputs, 'support'),
      refund: (cash.refund ?? 0) + sumOf(inputs, 'refund'),
      advance: (cash.advance ?? 0) + sumOf(inputs, 'advance'),
    },
  };
}

/**
 * What the month reads from the demo profile, as the API does: "Công ty trả thay BH" of (32) in its months, and a
 * signed commitment for the tax year of the pay date. Without one the contract's own commitment applies.
 */
export function withProfile(
  base: PayrollLineInput,
  profile: MockPayrollProfile | undefined,
  dates: { monthKey: string; payDate: string; taxYear: number },
): PayrollLineInput {
  const paidBack = (profile?.recurring ?? []).filter(
    (r) =>
      r.kind === PAYROLL_INSURANCE_PAID && r.fromMonth <= dates.monthKey && (!r.toMonth || dates.monthKey <= r.toMonth),
  );
  const signed = profile?.commitments.find((c) => c.year === dates.taxYear && c.signedOn <= dates.payDate);
  return {
    ...base,
    person: { ...base.person, hasCommitment: !!signed, commitmentSignedOn: signed?.signedOn ?? null },
    cash: { ...base.cash, insurancePaid: paidBack.length > 0 ? { taxable: paidBack.some((r) => r.taxable) } : null },
  };
}

/** As the API marks them (spec 6.3): (19) over a computed %, (22) and (23) over the close (none in the demo). */
export function typedOverrides(inputs: PayrollMonthInputsDto, line: PayrollLine): PayrollOverrideDto[] {
  const { updatedBy, updatedAt } = inputs;
  if (!updatedBy || !updatedAt) return [];
  const computedKpi = line.income.kpiPercentComputed.n === 0n ? null : inputs.kpiPercent;
  const typed: [PayrollOverrideDto['cell'], number | null, number][] = [
    ['kpiPercent', computedKpi, toNumber(line.income.kpiPercentComputed)],
    ['restDays', inputs.restDays, 0],
    ['holidayDays', inputs.holidayDays, 0],
  ];
  return typed.flatMap(([cell, value, computed]) =>
    value === null ? [] : [{ cell, computed, typed: value, reason: inputs.note, by: updatedBy, at: updatedAt }],
  );
}

/** The body of the PUT, checked as the API checks it: 422 with the first message and each field's. */
export function parseInputs(raw: unknown): Patch {
  const parsed = payrollMonthInputsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const errors = fieldErrors(parsed.error);
  throw new ApiError(422, Object.values(errors)[0] ?? 'Kiểm tra lại.', errors);
}

/** What is stored after the patch; unchanged when nothing changed, so the log line and "who saved" stay put. */
export function nextInputs(before: PayrollMonthInputsDto, patch: Patch, by: string, at: string): PayrollMonthInputsDto {
  const { updatedBy: _by, updatedAt: _at, ...values } = before;
  const after: Values = { ...values, ...patch };
  if (JSON.stringify(after) === JSON.stringify(values)) return before;
  return { ...after, updatedBy: by, updatedAt: at };
}
