import type { MessageTemplate, TemplateKey } from '../message-templates.js';
import { PLACEHOLDERS } from '../message-templates.js';
import type { MailContent, MailDetails } from './types.js';

/**
 * The payslip mail HR sends to an employee: the `payslip` template of Mẫu thư filled for one person and month. The
 * numbers are in the attached file; `{Thực nhận}` is there for HR who want it in the text.
 */
export interface PayslipMailValues {
  fullName: string;
  /** "10/2026" */
  month: string;
  /** "05/11/2026"; empty when the month has no pay date yet. */
  payDate: string;
  /** "12.345.678 đ" */
  netPay: string;
  hrName: string;
  hrPhone: string;
  company: string;
}

export const PAYSLIP_PLACEHOLDERS: { token: string; key: keyof PayslipMailValues }[] = [
  { token: '{Họ tên}', key: 'fullName' },
  { token: '{Tháng}', key: 'month' },
  { token: '{Ngày trả}', key: 'payDate' },
  { token: '{Thực nhận}', key: 'netPay' },
  { token: '{Tên HR}', key: 'hrName' },
  { token: '{SĐT HR}', key: 'hrPhone' },
  { token: '{Công ty}', key: 'company' },
];

/** The tokens the editor of a template offers: an employee's for the payslip, a candidate's for the others. */
export const placeholderTokensFor = (key: TemplateKey): string[] =>
  (key === 'payslip' ? PAYSLIP_PLACEHOLDERS : PLACEHOLDERS).map((p) => p.token);

function fill(text: string, values: PayslipMailValues, missing: Set<string>): string {
  return PAYSLIP_PLACEHOLDERS.reduce((out, { token, key }) => {
    if (!out.includes(token)) return out;
    const value = values[key].trim();
    if (!value) {
      missing.add(token);
      return out;
    }
    return out.split(token).join(value);
  }, text);
}

/** Fills every text of the payslip template; a field without a value stays as its token and is listed once. */
export function fillPayslipTemplate(
  t: MessageTemplate,
  values: PayslipMailValues,
): { content: MailContent; missing: string[] } {
  const missing = new Set<string>();
  const content: MailContent = {
    key: 'payslip',
    subject: fill(t.subject, values, missing),
    body: fill(t.body, values, missing),
    note: fill(t.note, values, missing),
    calloutTitle: fill(t.calloutTitle, values, missing),
    callout: fill(t.callout, values, missing),
    closing: fill(t.closing, values, missing),
  };
  return { content, missing: [...missing] };
}

/** What the fixed frame of a payslip mail shows: only the signature of the HR who sends it. */
export const payslipMailDetails = (hr: {
  name: string;
  phone: string;
  title: string;
  alias: string;
  email: string;
}): MailDetails => ({
  interviewIso: null,
  address: '',
  meetingUrl: '',
  interviewer: '',
  duration: '',
  candidateName: '',
  jobTitle: '',
  hrName: hr.name,
  hrPhone: hr.phone,
  hrTitle: hr.title,
  hrAlias: hr.alias,
  hrEmail: hr.email,
});

/** "Phieu-luong-2026-10-NV01.xlsx": one person's file, named so HR finds it in Downloads. Only safe characters. */
export const payslipFileName = (monthKey: string, code: string): string =>
  `Phieu-luong-${monthKey}-${code.trim().replace(/[^A-Za-z0-9_-]+/g, '-') || 'NV'}.xlsx`;
