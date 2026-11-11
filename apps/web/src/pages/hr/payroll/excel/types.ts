import type { PayrollConfig, PayrollDates, PayrollLine, Rational } from '@careers/shared';

/**
 * What the payroll Excel and the payslips are built from (spec 12.1, 11.7): the engine's rows of one month, the
 * people as they were in that month's closing, and which version of the month this is (R4, R8). An approved month
 * passes its snapshot; a draft passes the rows just computed. Nothing here is recomputed.
 *
 * The month the web shows (`fromMonth.ts`) knows less than the engine's row: what it does not say is null here and
 * stays empty in the file, never worked out again.
 */

/**
 * The part of the engine's row the file and the payslip read. The engine's `PayrollLine` is one; so is a row made
 * from the month on screen, where the tax method and what was paid of each component can be unknown (null).
 */
export interface PayrollExportLine {
  cells: PayrollLine['cells'];
  overtime: Pick<PayrollLine['overtime'], 'weekdayHours' | 'restDays' | 'holidayDays'>;
  amounts: Readonly<Record<string, number>>;
  income: {
    leavePayout: Rational | number;
    componentPaid: readonly { component: { name: string }; amount: number; paid: Rational | number | null }[];
  };
  insurance: { status: { note: string } };
  tax: { method: PayrollLine['tax']['method'] | null };
  insurancePaid: { amount: number } | null;
}

/** "Bản duyệt lần N" or "BẢN NHÁP" (R8). A replaced approval names the round that replaced it (L-F14). */
export type PayrollStamp =
  | { kind: 'approved'; round: number; approvedAt: string; approvedBy: string; supersededBy?: number | null }
  | { kind: 'draft'; computedAt: string };

/** One person as the month's timesheet closing and payroll profile have them. */
export interface PayrollPerson {
  employeeId: string;
  code: string;
  name: string;
  /** Null: the month on screen does not carry it. */
  title: string | null;
  /** Khối (BO / KD): HR's column (5) "Bộ phận". */
  block: string | null;
  contractTypeId: string;
  contractName: string;
  region: string;
  /** The region's place in the timesheet's region list (HCM before HN), for the row order (D13). */
  regionOrder: number;
  /** Null: the month on screen does not carry it. */
  dependants: number | null;
  /** (15) KPI at 100%. */
  kpiAmount: number;
  email: string | null;
  bankAccount: string | null;
  bankName: string | null;
  note?: string;
}

/** (32) as HR typed it: support, refund, advance (câu 4). */
export interface PayrollCash {
  support: number;
  refund: number;
  advance: number;
}

/** A back pay or claw-back made in this month for an earlier one (R6); its money is already in (24). */
export interface PayrollAdjustment {
  /** `YYYY-MM` of the month it corrects. */
  originMonth: string;
  reason: string;
  amount: number;
}

export interface PayrollExportRow {
  person: PayrollPerson;
  line: PayrollExportLine;
  cash?: PayrollCash;
  adjustments?: readonly PayrollAdjustment[];
  /**
   * Truy lĩnh / truy thu this month carries from approved months (`PayrollMonthDto.retro`): already inside the row's
   * cells and (42); the payslip names each one so the person sees why the month differs (C02).
   */
  retro?: readonly PayrollAdjustment[];
}

/** A cell HR typed over the computed value (spec 6.3). */
export interface TypedOverride {
  employeeId: string;
  /** HR's column number, e.g. "19". */
  column: string;
  computed: number;
  typed: number;
  reason: string;
}

/** A period split on a new pay level or the day someone became official (spec 5.6). */
export interface PayrollSegmentNote {
  employeeId: string;
  parts: readonly { from: string; to: string; amounts: Readonly<Record<string, number>> }[];
}

export interface PayrollExportMonth {
  dates: PayrollDates;
  /** The month's configuration for everyone: its pay components give the columns, the "Tham số" sheet lists it. */
  config: PayrollConfig;
  rows: readonly PayrollExportRow[];
  norms: readonly { region: string; norm: number }[];
  stamp: PayrollStamp;
  /** The timesheet closing the month reads (spec 10.1); null when the source does not say. */
  closingNo: number | null;
  formulaVersion: string | null;
  /** The month's own total row (D01), when the source has one: the file then matches the screen to the dong. */
  totals?: Readonly<Record<string, number | undefined>>;
  /** True when the rows carry no bank details: a payslip then has no transfer line rather than "no account". */
  isBankUnknown?: boolean;
  /** "Có thay đổi sau duyệt, xử lý ở T…", "Kỳ công đã mở lại" (R6, R7). */
  labels?: readonly string[];
  /** Only some people of the month are in the file (a filtered download): the sheet says so and totals its own rows. */
  partial?: { shown: number; total: number };
  typed?: readonly TypedOverride[];
  segments?: readonly PayrollSegmentNote[];
}

/** Who downloads and when; group H (email, account, bank) can be left out (L-F12). */
export interface PayrollDownload {
  /** Local time, `YYYY-MM-DDTHH:mm`. */
  at: string;
  by: string;
  hideBank?: boolean;
}
