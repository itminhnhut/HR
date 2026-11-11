import type { PayrollConfig, PayrollDates, PayrollLine } from '@careers/shared';

/**
 * What the payroll Excel and the payslips are built from (spec 12.1, 11.7): the engine's rows of one month, the
 * people as they were in that month's closing, and which version of the month this is (R4, R8). An approved month
 * passes its snapshot; a draft passes the rows just computed. Nothing here is recomputed.
 */

/** "Bản duyệt lần N" or "BẢN NHÁP" (R8). A replaced approval names the round that replaced it (L-F14). */
export type PayrollStamp =
  | { kind: 'approved'; round: number; approvedAt: string; approvedBy: string; supersededBy?: number | null }
  | { kind: 'draft'; computedAt: string };

/** One person as the month's timesheet closing and payroll profile have them. */
export interface PayrollPerson {
  employeeId: string;
  code: string;
  name: string;
  title: string;
  /** Khối (BO / KD): HR's column (5) "Bộ phận". */
  block: string | null;
  contractTypeId: string;
  contractName: string;
  region: string;
  /** The region's place in the timesheet's region list (HCM before HN), for the row order (D13). */
  regionOrder: number;
  dependants: number;
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
  line: PayrollLine;
  cash?: PayrollCash;
  adjustments?: readonly PayrollAdjustment[];
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
  /** The timesheet closing the month reads (spec 10.1). */
  closingNo: number;
  formulaVersion: string;
  /** "Có thay đổi sau duyệt, xử lý ở T…", "Kỳ công đã mở lại" (R6, R7). */
  labels?: readonly string[];
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
