import { z } from 'zod';
import type { PayrollPeriodStatus } from './payroll-api.js';

/** Lương › Phiếu lương: who gets a payslip of a month, where it goes, and whether it was sent. */

/** `stale`: sent, then the month was reopened or approved again — "Số đã đổi, cần gửi lại". */
export type PayslipSendState = 'never' | 'sent' | 'failed' | 'stale';
/** `manual`: HR sent it from their own mailbox and said so. `auto`: the server mailed it. */
export type PayslipSendChannel = 'manual' | 'auto';

export interface PayslipSendDto {
  state: PayslipSendState;
  /** When and by whom it was last sent (or tried); null for `never`. */
  at: string | null;
  by: string | null;
  channel: PayslipSendChannel | null;
  /** Why the last automatic send failed, in words HR reads. */
  error: string | null;
}

export interface PayslipPersonDto {
  employeeId: string;
  code: string;
  fullName: string;
  department: string;
  block: 'BO' | 'KD' | null;
  /** Email nhận phiếu lương as it is now (Chấm công › Nhân viên); null when none. */
  email: string | null;
  netPay: number;
  send: PayslipSendDto;
}

export interface PayslipMailStatusDto {
  /** The server can mail by itself ("Gửi tự động"). False: HR sends from their own mailbox. */
  isConfigured: boolean;
  /** A test machine: every automatic mail goes here, never to the employee. Null: mails go to the employee. */
  redirectTo: string | null;
  /** Configured, but this machine may not send (a test machine without a test mailbox): why. */
  blocked: string | null;
}

export interface PayslipListDto {
  monthKey: string;
  status: PayrollPeriodStatus;
  approvalNo: number | null;
  payDate: string;
  /** Only an approved or paid month is sent; a draft is preview only. */
  canSend: boolean;
  mail: PayslipMailStatusDto;
  people: PayslipPersonDto[];
}

/** "Đánh dấu đã gửi" for the people HR mailed by hand; `sent: false` takes the mark back. */
export const payslipMarkSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1, 'Chọn ít nhất một người.').max(1000),
  sent: z.boolean().default(true),
});
export type PayslipMarkInput = z.input<typeof payslipMarkSchema>;

/** The Excel payslip of one person, built in the browser, at most this many bytes. */
export const PAYSLIP_FILE_MAX_BYTES = 2 * 1024 * 1024;

/** "Gửi tự động" for one person: the server writes the mail from the Mẫu thư template and attaches this file. */
export const payslipSendSchema = z.object({
  employeeId: z.string().uuid(),
  /** The .xlsx file in base64. */
  fileBase64: z
    .string()
    .min(1, 'Thiếu file phiếu lương.')
    .max(Math.ceil((PAYSLIP_FILE_MAX_BYTES * 4) / 3) + 4, 'File phiếu lương quá lớn (tối đa 2 MB).')
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'File phiếu lương không đọc được.'),
});
export type PayslipSendInput = z.input<typeof payslipSendSchema>;

export interface PayslipSendResultDto {
  employeeId: string;
  isSent: boolean;
  /** Where the mail went: the employee, or the test mailbox. */
  sentTo: string | null;
  /** Why it was not sent. */
  error: string | null;
  send: PayslipSendDto;
}
