import { DEFAULT_MESSAGE_TEMPLATES, renderMailHtml, type PayslipListDto, type PayslipPersonDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import {
  listedPeople,
  mailWithPayslipHtml,
  mailWithPayslipText,
  notSentCount,
  payslipMailOf,
  sendBlock,
  statusFilterOf,
  statusWords,
  walkWords,
} from './payslipsModel';

/** Phiếu lương without React. Made-up people. */
const person = (id: string, over: Partial<PayslipPersonDto> = {}): PayslipPersonDto => ({
  employeeId: id,
  code: `NV${id}`,
  fullName: `Người Thử ${id}`,
  department: 'Kế toán',
  block: 'BO',
  email: `nv${id}@example.com`,
  netPay: 9_000_000,
  send: { state: 'never', at: null, by: null, channel: null, error: null },
  ...over,
});
const sentAt = {
  state: 'sent' as const,
  at: '2026-11-05T07:05:00.000Z',
  by: 'HR Thử',
  channel: 'manual' as const,
  error: null,
};
const list = (people: PayslipPersonDto[], over: Partial<PayslipListDto> = {}): PayslipListDto => ({
  monthKey: '2026-10',
  status: 'approved',
  approvalNo: 1,
  payDate: '2026-11-05',
  canSend: true,
  mail: { isConfigured: false, redirectTo: null, blocked: null },
  people,
  ...over,
});
const all = (people: PayslipPersonDto[]) => new Set(people.map((p) => p.employeeId));

describe('who the list shows', () => {
  it('should put the people without an email first, the rest in the order of the sheet', () => {
    // Arrange
    const people = [person('1'), person('2', { email: null }), person('3'), person('4', { email: null })];

    // Act
    const shown = listedPeople(people, all(people), '');

    // Assert
    expect(shown.map((p) => p.employeeId)).toEqual(['2', '4', '1', '3']);
  });

  it('should keep only the people the filter bar keeps and the status asked for', () => {
    // Arrange
    const people = [person('1', { send: sentAt }), person('2'), person('3', { send: { ...sentAt, state: 'stale' } })];

    // Assert
    expect(listedPeople(people, new Set(['1', '2']), '').map((p) => p.employeeId)).toEqual(['1', '2']);
    expect(listedPeople(people, all(people), 'chua').map((p) => p.employeeId)).toEqual(['2']);
    expect(listedPeople(people, all(people), 'da').map((p) => p.employeeId)).toEqual(['1']);
    expect(listedPeople(people, all(people), 'doi').map((p) => p.employeeId)).toEqual(['3']);
    expect(statusFilterOf('lung-tung')).toBe('');
  });

  it('should count everyone not sent for the approval in force on the tab', () => {
    // Arrange
    const people = [person('1', { send: sentAt }), person('2'), person('3', { send: { ...sentAt, state: 'stale' } })];

    // Assert
    expect(notSentCount(list(people))).toBe(2);
    expect(notSentCount(undefined)).toBe(0);
  });
});

describe('what a status reads', () => {
  it('should say when and by whom it was sent, in Vietnam time', () => {
    expect(statusWords(sentAt)).toEqual({ text: 'Đã gửi lúc 14:05 05/11/2026 bởi HR Thử', tone: 'green' });
  });

  it('should say the numbers changed after a reopen, and "Chưa gửi" for nobody yet', () => {
    expect(statusWords({ ...sentAt, state: 'stale' }).text).toContain('Số đã đổi, cần gửi lại');
    expect(statusWords(person('1').send)).toEqual({ text: 'Chưa gửi', tone: 'grey' });
  });
});

describe('when sending is off', () => {
  it('should give the reason for a month that is not approved, and for a person without an email', () => {
    expect(sendBlock(list([], { canSend: false }), person('1'))).toContain('Tháng lương chưa duyệt');
    expect(sendBlock(list([]), person('1', { email: null }))).toContain('chưa có email');
    expect(sendBlock(list([]), person('1'))).toBeNull();
  });
});

describe('the mail of one person', () => {
  it('should address Outlook, Gmail and the mail app to the employee with the subject of the template', () => {
    // Act
    const mail = payslipMailOf(DEFAULT_MESSAGE_TEMPLATES.payslip, list([]), person('1'), null);

    // Assert
    const outlook = new URL(mail.outlook);
    expect(outlook.searchParams.get('to')).toBe('nv1@example.com');
    expect(outlook.searchParams.get('subject')).toBe('[Top Flow] Phiếu lương tháng 10/2026 - Người Thử 1');
    expect(outlook.searchParams.get('body')).toBeNull();
    expect(mail.outlook).not.toContain('+');
    expect(new URL(mail.gmail).searchParams.get('to')).toBe('nv1@example.com');
    expect(mail.text).toContain('Ngày chi trả: 05/11/2026.');
    expect(mail.text).not.toContain('9.000.000');
  });

  it('should put the payslip table inside the mail before the closing, and leave a mail without a payslip alone', () => {
    // Arrange
    const slip = {
      title: 'PHIẾU LƯƠNG THÁNG 10/2026',
      info: [['Họ và tên', 'Người Thử 1']],
      sections: [{ title: 'Thu nhập', lines: [{ label: 'Lương <cơ bản>', amount: 9_000_000, format: 'money' }] }],
      netPay: 9_000_000,
    } as unknown as Parameters<typeof mailWithPayslipHtml>[1];

    // Act
    const mail = payslipMailOf(DEFAULT_MESSAGE_TEMPLATES.payslip, list([]), person('1'), null);
    const html = mailWithPayslipHtml(renderMailHtml(mail.content, mail.details), slip);

    // Assert
    expect(html).toContain('PHIẾU LƯƠNG THÁNG 10/2026');
    expect(html).toContain('Lương &lt;cơ bản&gt;');
    expect(html).toContain('9.000.000 đ');
    expect(html.indexOf('Thân gửi anh/chị')).toBeLessThan(html.indexOf('Thu nhập'));
    expect(html.indexOf('Thu nhập')).toBeLessThan(html.indexOf('Thân mến,'));
    expect(mailWithPayslipHtml('<html><body><p>Thư</p></body></html>', slip)).toContain('Thu nhập');
    expect(mailWithPayslipText('Chào', slip)).toContain('- Lương <cơ bản>: 9.000.000');
    expect(mailWithPayslipHtml('<body>x</body>', null)).toBe('<body>x</body>');
  });

  it('should say where a walk through several people stands', () => {
    expect(walkWords(1, 5)).toBe('Người 2/5');
  });
});
