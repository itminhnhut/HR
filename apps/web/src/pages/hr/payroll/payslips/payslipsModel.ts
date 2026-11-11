import {
  fillPayslipTemplate,
  gmailComposeUrl,
  MAIL_COMPANY,
  MAILTO_SAFE_LENGTH,
  mailtoUrl,
  outlookComposeUrl,
  payslipMailDetails,
  renderMailText,
  type HrMe,
  type MailContent,
  type MailDetails,
  type MessageTemplate,
  type PayslipListDto,
  type PayslipPersonDto,
  type PayslipSendDto,
} from '@careers/shared';
import type { Payslip } from '../excel/payslip';

/** Lương › Phiếu lương without React: who is listed first, what each status reads, and the mail of one person. */

/** `?gui=` of the address: which people the list shows by send status. */
export const STATUS_PARAM = 'gui';
export const STATUS_FILTERS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'chua', label: 'Chưa gửi' },
  { value: 'da', label: 'Đã gửi' },
  { value: 'doi', label: 'Số đã đổi, cần gửi lại' },
  { value: 'thieu-email', label: 'Thiếu email' },
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

export const statusFilterOf = (raw: string | null): StatusFilter =>
  STATUS_FILTERS.find((f) => f.value === raw)?.value ?? '';

/** Sent for the approval in force; anything else still has to go out. */
export const isSent = (p: PayslipPersonDto) => p.send.state === 'sent';

const matches = (p: PayslipPersonDto, filter: StatusFilter): boolean => {
  if (filter === 'chua') return p.send.state === 'never' || p.send.state === 'failed';
  if (filter === 'da') return isSent(p);
  if (filter === 'doi') return p.send.state === 'stale';
  if (filter === 'thieu-email') return !p.email;
  return true;
};

/**
 * The people the list shows: only those the filter bar keeps (`shownIds`), by status, the ones without an email
 * first because they are the ones HR must act on, then in the order of the payroll sheet.
 */
export function listedPeople(
  people: readonly PayslipPersonDto[],
  shownIds: ReadonlySet<string>,
  filter: StatusFilter,
): PayslipPersonDto[] {
  const shown = people.filter((p) => shownIds.has(p.employeeId) && matches(p, filter));
  return [...shown.filter((p) => !p.email), ...shown.filter((p) => p.email)];
}

/** How many people still wait for their payslip: the number on the tab. */
export const notSentCount = (list: PayslipListDto | undefined): number =>
  list ? list.people.filter((p) => !isSent(p)).length : 0;

/** "14:05 05/11/2026" in Vietnam. */
function timeWords(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')} ${get('day')}/${get('month')}/${get('year')}`;
}

export interface StatusWords {
  text: string;
  tone: 'grey' | 'green' | 'amber' | 'red';
}

/** Chưa gửi / Đã gửi lúc … bởi … / Số đã đổi, cần gửi lại / Lỗi. */
export function statusWords(send: PayslipSendDto): StatusWords {
  const when = send.at ? ` lúc ${timeWords(send.at)}` : '';
  const who = send.by ? ` bởi ${send.by}` : '';
  if (send.state === 'sent') return { text: `Đã gửi${when}${who}`, tone: 'green' };
  if (send.state === 'stale') return { text: `Số đã đổi, cần gửi lại (lần trước gửi${when})`, tone: 'amber' };
  if (send.state === 'failed') return { text: `Lỗi: ${send.error ?? 'chưa gửi được'}`, tone: 'red' };
  return { text: 'Chưa gửi', tone: 'grey' };
}

/** Why the send actions are off for this person; null when HR can send. Preview is never off. */
export function sendBlock(
  list: Pick<PayslipListDto, 'canSend'>,
  person: Pick<PayslipPersonDto, 'email'>,
): string | null {
  if (!list.canSend) return 'Tháng lương chưa duyệt nên chỉ xem trước được. Duyệt bảng lương rồi mới gửi phiếu lương.';
  if (!person.email) return 'Người này chưa có email nhận phiếu lương. Nhập email trước khi gửi.';
  return null;
}

/** The person's form in Chấm công › Nhân viên, where the email is typed. */
export const emailLink = (employeeId: string) => `/hr/cham-cong/nhan-vien?nv=${encodeURIComponent(employeeId)}`;

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} đ`;
const dayWords = (iso: string) => iso.split('-').reverse().join('/');

export interface PayslipMail {
  content: MailContent;
  details: MailDetails;
  /** The mail as plain text, for the compose links. */
  text: string;
  /** Tokens of the template without a value, such as {Tên HR}. */
  missing: string[];
  outlook: string;
  gmail: string;
  /** Null when the mail is too long for a mail app link. */
  mailto: string | null;
}

/** The payslip mail of one person: the Mẫu thư template filled in, signed by the HR who sends it. */
export function payslipMailOf(
  template: MessageTemplate,
  list: Pick<PayslipListDto, 'monthKey' | 'payDate'>,
  person: PayslipPersonDto,
  me: HrMe | null | undefined,
): PayslipMail {
  const { content, missing } = fillPayslipTemplate(template, {
    fullName: person.fullName,
    month: `${list.monthKey.slice(5)}/${list.monthKey.slice(0, 4)}`,
    payDate: list.payDate ? dayWords(list.payDate) : '',
    netPay: money(person.netPay),
    hrName: me?.name ?? '',
    hrPhone: me?.phone ?? '',
    company: MAIL_COMPANY.name,
  });
  const details = payslipMailDetails({
    name: me?.name ?? '',
    phone: me?.phone ?? '',
    title: me?.jobTitle ?? '',
    alias: me?.alias ?? '',
    email: me?.contactEmail ?? MAIL_COMPANY.hrEmail,
  });
  const text = renderMailText(content, details);
  const to = person.email ?? '';
  const mailto = mailtoUrl(to, content.subject, text);
  return {
    content,
    details,
    text,
    missing,
    // Recipient and subject only: HR pastes the designed mail, as with the letters to candidates.
    outlook: outlookComposeUrl(person.email, content.subject),
    gmail: gmailComposeUrl(to, content.subject, text, me?.contactEmail),
    mailto: mailto.length > MAILTO_SAFE_LENGTH ? null : mailto,
  };
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CELL = "padding:6px 10px;border:1px solid #d9d9d9;font-family:'Times New Roman',Times,serif;font-size:14px;";

function amountWords(amount: number | null | undefined, format: string): string {
  // A line the month says nothing about stays empty, as on the card.
  if (amount === null || amount === undefined) return '';
  if (format === 'money') return Math.round(amount).toLocaleString('vi-VN');
  if (format === 'percent') return `${(amount * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
  return amount.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

/** The payslip as a plain table for the body of a mail: the same lines as the card, no internal codes. */
export function payslipTableHtml(slip: Payslip): string {
  const info = slip.info
    .map(
      ([label, value]) =>
        `<tr><td style="${CELL}">${escapeHtml(label)}</td><td style="${CELL}">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  const sections = slip.sections
    .map((section) => {
      const head = `<tr><td colspan="2" style="${CELL}background:#f2f2f2;font-weight:bold;">${escapeHtml(section.title)}</td></tr>`;
      const lines = section.lines
        .map((line) => {
          const weight = line.isTotal ? 'font-weight:bold;' : '';
          const indent = line.isDetail ? 'padding-left:24px;color:#555;' : '';
          return `<tr><td style="${CELL}${weight}${indent}">${escapeHtml(line.label)}</td><td align="right" style="${CELL}${weight}">${amountWords(line.amount, line.format)}</td></tr>`;
        })
        .join('');
      return head + lines;
    })
    .join('');
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:16px auto;border-collapse:collapse;background:#ffffff;">
<tr><td colspan="2" align="center" style="${CELL}font-size:16px;font-weight:bold;">${escapeHtml(slip.title)}</td></tr>
${info}${sections}
<tr><td style="${CELL}font-weight:bold;background:#fff2cc;">Thực nhận</td><td align="right" style="${CELL}font-weight:bold;background:#fff2cc;">${money(slip.netPay)}</td></tr>
</table>`;
}

/** Where the closing ("…Thân mến,") of the designed mail starts: the payslip goes right before it. */
const CLOSING_ROW = /<tr><td class="px" style="[^"]*padding:22px 40px 0;/g;

/**
 * The designed mail with the payslip inside it, between the text of the template and the closing: a whole mail HR
 * pastes into Outlook, no file needed. A mail whose frame is not recognised gets the table at its end.
 */
export function mailWithPayslipHtml(mailHtml: string, slip: Payslip | null): string {
  if (!slip) return mailHtml;
  const table = payslipTableHtml(slip);
  const at = [...mailHtml.matchAll(CLOSING_ROW)].at(-1)?.index ?? -1;
  if (at < 0) return mailHtml.replace('</body>', `${table}\n</body>`);
  return `${mailHtml.slice(0, at)}<tr><td class="px" style="padding:6px 40px 0;">${table}</td></tr>\n\n${mailHtml.slice(at)}`;
}

/** The same payslip as plain lines, for Gmail, a mail app and the plain copy. */
export function payslipText(slip: Payslip): string {
  const lines = slip.sections.flatMap((section) => [
    section.title.toUpperCase(),
    ...section.lines.map((l) => `${l.isDetail ? '   ' : '- '}${l.label}: ${amountWords(l.amount, l.format)}`),
  ]);
  return [
    slip.title,
    ...slip.info.map(([label, value]) => `${label}: ${value}`),
    ...lines,
    `THỰC NHẬN: ${money(slip.netPay)}`,
  ].join('\n');
}

/** The plain mail with the payslip after the opening text. */
export const mailWithPayslipText = (text: string, slip: Payslip | null): string =>
  slip ? `${text}\n\n${payslipText(slip)}` : text;

/** "Người 2/5": where a walk through several people stands. */
export const walkWords = (index: number, total: number) => `Người ${index + 1}/${total}`;
