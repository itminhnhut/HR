import type {
  EmployeeDto,
  PayrollLogPageDto,
  PayrollMonthDto,
  PayslipChangesDto,
  PayslipListDto,
  PayslipSendResultDto,
} from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hrUsers } from '../db/schema.js';
import { MailError, type MailMessage } from '../lib/mailer.js';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Lương › Phiếu lương over the real API: the list with each person's address and send status, "Đánh dấu đã gửi" and
 * "Gửi tự động" through a fake mailer. A made-up company in November 2026; no test opens a network connection.
 */

let flow: Flow;
let sent: MailMessage[];

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
  sent = [];
  flow.t.deps.mailer = null;
  flow.t.deps.config.isProduction = false;
});

/** A tiny zip header in base64: what an .xlsx file starts with. */
const XLSX_FILE = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]).toString('base64');

const list = (key = '2026-11') => flow.payroll<PayslipListDto>('GET', `/months/${key}/payslips`);
const approve = () => flow.payroll<PayrollMonthDto>('POST', '/months/2026-11/approve', { acknowledgedRed: true });
const reopen = () => flow.payroll<PayrollMonthDto>('POST', '/months/2026-11/reopen', { reason: 'Sửa số' });
const mark = (ids: string[], expected = 200, isSent = true) =>
  flow.payroll<PayslipListDto>('POST', '/months/2026-11/payslips/mark', { employeeIds: ids, sent: isSent }, expected);
const send = (employeeId: string, expected = 200, fileBase64 = XLSX_FILE) =>
  flow.payroll<PayslipSendResultDto>('POST', '/months/2026-11/payslips/send', { employeeId, fileBase64 }, expected);
const logLines = async () =>
  (await flow.payroll<PayrollLogPageDto>('GET', '/log?ky=2026-11&nhom=bang-luong')).lines.map(
    (l) => `${l.action}: ${l.detail}`,
  );
const attemptPayroll = (method: string, path: string, body?: unknown) =>
  flow.attemptAt(method, `/api/hr/payroll${path}`, body);
const personOf = (dto: PayslipListDto, p: EmployeeDto) => dto.people.find((x) => x.employeeId === p.id);
const useMailer = (devTo: string | null, fail?: string) => {
  flow.t.deps.mailer = {
    devTo,
    transport: async (message) => {
      if (fail) throw new MailError(fail);
      sent.push(message);
    },
  };
};
const tick = () => {
  flow.t.clock.now = new Date(flow.t.clock.now.getTime() + 60_000);
};

/** NV A with an email, NV B without; both paid 9 000 000 a month; November closed. */
async function november(): Promise<{ a: EmployeeDto; b: EmployeeDto }> {
  await givePayrollRight(flow);
  const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01', email: 'nv01@example.com' });
  const b = await flow.addPerson({ code: 'NV02', fullName: 'NV B', joinedOn: '2025-03-01' });
  for (const person of [a, b]) {
    const level = { effectiveOn: '2025-03-01', contractTypeId: 'khong-thoi-han', amounts: { luong: 9_000_000 } };
    await flow.payroll('POST', `/profiles/${person.id}/versions`, level, 201);
  }
  await flow.at('2026-11-26');
  await flow.close(2026, 11);
  return { a, b };
}

describe('the payslip list of a month', () => {
  it('should answer 403 to someone without the payroll right', async () => {
    // Arrange
    await november();
    await flow.t.db.update(hrUsers).set({ canPayroll: false, canApprovePayroll: false });

    // Act
    const res = await attemptPayroll('GET', '/months/2026-11/payslips');
    const marked = await attemptPayroll('POST', '/months/2026-11/payslips/mark', { employeeIds: [] });

    // Assert
    expect([res.status, marked.status]).toEqual([403, 403]);
  });

  it('should list everyone with their address, net pay and "never sent", preview only while a draft', async () => {
    // Arrange
    const { a, b } = await november();

    // Act
    const dto = await list();

    // Assert
    expect(dto).toMatchObject({ monthKey: '2026-11', status: 'draft', canSend: false, approvalNo: null });
    expect(dto.mail).toEqual({ isConfigured: false, redirectTo: null, blocked: null });
    expect(personOf(dto, a)).toMatchObject({ code: 'NV01', fullName: 'NV A', email: 'nv01@example.com' });
    expect(personOf(dto, a)?.netPay).toBeGreaterThan(0);
    expect(personOf(dto, b)).toMatchObject({ email: null, send: { state: 'never', at: null, by: null } });
  });

  it('should show the address HR types after the month was approved', async () => {
    // Arrange
    const { b } = await november();
    await approve();

    // Act
    await flow.updatePerson(b, { email: 'nv02@example.com' });

    // Assert
    expect(personOf(await list(), b)?.email).toBe('nv02@example.com');
  });
});

describe('Đánh dấu đã gửi', () => {
  it('should refuse a draft month with 409', async () => {
    // Arrange
    const { a } = await november();

    // Act
    const res = await attemptPayroll('POST', '/months/2026-11/payslips/mark', { employeeIds: [a.id] });

    // Assert
    expect(res).toMatchObject({ status: 409, code: 'payslip_month_not_approved' });
  });

  it('should keep who marked it and when, and write a log line without any amount', async () => {
    // Arrange
    const { a, b } = await november();
    await approve();
    tick();

    // Act
    const dto = await mark([a.id]);

    // Assert
    expect(personOf(dto, a)?.send).toMatchObject({ state: 'sent', channel: 'manual', error: null });
    expect(personOf(dto, a)?.send.at).toBe(flow.t.clock.now.toISOString());
    expect(personOf(dto, a)?.send.by).toBeTruthy();
    expect(personOf(dto, b)?.send.state).toBe('never');
    const line = (await logLines())[0] ?? '';
    expect(line).toBe('Đánh dấu đã gửi phiếu lương: Bản duyệt lần 1: NV01 NV A');
    expect(line).not.toMatch(/\d{1,3}(\.\d{3})+/);
  });

  it('should take the mark back', async () => {
    // Arrange
    const { a } = await november();
    await approve();
    await mark([a.id]);

    // Act
    const dto = await mark([a.id], 200, false);

    // Assert
    expect(personOf(dto, a)?.send.state).toBe('never');
  });

  it('should read "stale" once the month is reopened, and still after it is approved again', async () => {
    // Arrange
    const { a } = await november();
    await approve();
    await mark([a.id]);

    // Act
    tick();
    await reopen();
    const reopened = await list();
    tick();
    await approve();
    const again = await list();

    // Assert
    expect(personOf(reopened, a)?.send.state).toBe('stale');
    expect(again.approvalNo).toBe(2);
    expect(personOf(again, a)?.send.state).toBe('stale');
    expect(personOf(await mark([a.id]), a)?.send.state).toBe('sent');
  });
});

describe('Gửi tự động', () => {
  it('should answer 409 "Chưa cấu hình hộp thư gửi" while no mailbox is configured', async () => {
    // Arrange
    const { a } = await november();
    await approve();

    // Act
    const res = await attemptPayroll('POST', '/months/2026-11/payslips/send', {
      employeeId: a.id,
      fileBase64: XLSX_FILE,
    });

    // Assert
    expect(res).toMatchObject({ status: 409, code: 'mail_not_configured' });
  });

  it('should refuse a draft month with 409 and send nothing', async () => {
    // Arrange
    const { a } = await november();
    useMailer('thu@example.com');

    // Act
    const res = await attemptPayroll('POST', '/months/2026-11/payslips/send', {
      employeeId: a.id,
      fileBase64: XLSX_FILE,
    });

    // Assert
    expect(res).toMatchObject({ status: 409, code: 'payslip_month_not_approved' });
    expect(sent).toEqual([]);
  });

  it('should never mail the employee from a test machine: the mail goes to MAIL_DEV_TO with the file attached', async () => {
    // Arrange
    const { a } = await november();
    await approve();
    useMailer('thu@example.com');
    tick();

    // Act
    const result = await send(a.id);

    // Assert
    expect(result).toMatchObject({ isSent: true, sentTo: 'thu@example.com', error: null });
    expect(sent.map((m) => m.to)).toEqual(['thu@example.com']);
    expect(sent[0]?.subject).toBe('[THỬ – lẽ ra gửi nv01@example.com] [Top Flow] Phiếu lương tháng 11/2026 - NV A');
    expect(sent[0]?.html).toContain('Thân gửi anh/chị NV A,');
    expect(sent[0]?.attachments).toEqual([
      {
        fileName: 'Phieu-luong-2026-11-NV01.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        contentBase64: XLSX_FILE,
      },
    ]);
    expect(personOf(await list(), a)?.send).toMatchObject({ state: 'sent', channel: 'auto' });
    expect((await logLines())[0]).toBe(
      'Gửi phiếu lương: NV01 NV A → thu@example.com (máy thử, không gửi cho nhân viên)',
    );
  });

  it('should mail the employee on production, with the template HR saved on Mẫu thư', async () => {
    // Arrange
    const { a } = await november();
    await approve();
    useMailer(null);
    flow.t.deps.config.isProduction = true;
    const template = { subject: 'Lương {Tháng} của {Họ tên}', body: 'Chào {Họ tên}, thực nhận {Thực nhận}.' };
    const saved = await flow.attemptAt('PUT', '/api/hr/message-templates/payslip', template);

    // Act
    const result = await send(a.id);

    // Assert
    expect(saved.status).toBe(200);
    expect(result.sentTo).toBe('nv01@example.com');
    expect(sent[0]?.to).toBe('nv01@example.com');
    expect(sent[0]?.subject).toBe('Lương 11/2026 của NV A');
    expect(sent[0]?.html).toMatch(/Chào NV A, thực nhận [\d.]+ đ\./);
  });

  it('should refuse to send off production without MAIL_DEV_TO', async () => {
    // Arrange
    const { a } = await november();
    await approve();
    useMailer(null);

    // Act
    const res = await attemptPayroll('POST', '/months/2026-11/payslips/send', {
      employeeId: a.id,
      fileBase64: XLSX_FILE,
    });

    // Assert
    expect(res).toMatchObject({ status: 409, code: 'mail_blocked' });
    expect(sent).toEqual([]);
  });

  it('should not send to someone without an email', async () => {
    // Arrange
    const { b } = await november();
    await approve();
    useMailer('thu@example.com');

    // Act
    const res = await attemptPayroll('POST', '/months/2026-11/payslips/send', {
      employeeId: b.id,
      fileBase64: XLSX_FILE,
    });

    // Assert
    expect(res).toMatchObject({ status: 409, code: 'payslip_no_email' });
    expect(sent).toEqual([]);
  });

  it('should refuse a file that is not an Excel file, and one over 2 MB', async () => {
    // Arrange
    const { a } = await november();
    await approve();
    useMailer('thu@example.com');
    const text = Buffer.from('not a zip file').toString('base64');
    const big = Buffer.concat([Buffer.from([0x50, 0x4b]), Buffer.alloc(2 * 1024 * 1024)]).toString('base64');

    // Act
    const wrong = await attemptPayroll('POST', '/months/2026-11/payslips/send', { employeeId: a.id, fileBase64: text });
    const large = await attemptPayroll('POST', '/months/2026-11/payslips/send', { employeeId: a.id, fileBase64: big });

    // Assert
    expect([wrong.status, large.status]).toEqual([422, 422]);
    expect(sent).toEqual([]);
  });

  it('should keep the provider\'s reason as "failed" and answer it, so the next person can still be sent', async () => {
    // Arrange
    const { a } = await november();
    await approve();
    useMailer('thu@example.com', 'Ứng dụng chưa được cấp quyền Mail.Send');
    tick();

    // Act
    const result = await send(a.id);

    // Assert
    expect(result).toMatchObject({ isSent: false, sentTo: null, error: 'Ứng dụng chưa được cấp quyền Mail.Send' });
    expect(personOf(await list(), a)?.send).toMatchObject({ state: 'failed', channel: 'auto', error: result.error });
    expect((await logLines())[0]).toBe('Gửi phiếu lương bị lỗi: NV01 NV A: Ứng dụng chưa được cấp quyền Mail.Send');
  });
});

describe('Thay đổi từ lần gửi', () => {
  const changes = (person: EmployeeDto, expected = 200) =>
    flow.payroll<PayslipChangesDto>('GET', `/months/2026-11/payslips/${person.id}/changes`, undefined, expected);
  const support = (person: EmployeeDto, amount: number) =>
    flow.payroll('PUT', `/months/2026-11/lines/${person.id}/inputs`, {
      cash: [{ kind: 'support', amount, reason: 'Hỗ trợ thử' }],
    });
  const stillRight = (person: EmployeeDto, expected = 200) =>
    flow.payroll<PayslipListDto>('POST', `/months/2026-11/payslips/${person.id}/unchanged`, {}, expected);

  /** Approved, NV A marked sent, reopened; `change` runs on the draft; approved again as number 2. */
  async function sentThenApprovedAgain(change: (people: { a: EmployeeDto; b: EmployeeDto }) => Promise<unknown>) {
    const people = await november();
    await approve();
    tick();
    await mark([people.a.id]);
    tick();
    await reopen();
    tick();
    await change(people);
    tick();
    await approve();
    return people;
  }

  it('should answer 403 to someone without the payroll right', async () => {
    // Arrange
    const { a } = await november();
    await flow.t.db.update(hrUsers).set({ canPayroll: false, canApprovePayroll: false });

    // Act
    const read = await attemptPayroll('GET', `/months/2026-11/payslips/${a.id}/changes`);
    const confirm = await attemptPayroll('POST', `/months/2026-11/payslips/${a.id}/unchanged`, {});

    // Assert
    expect([read.status, confirm.status]).toEqual([403, 403]);
  });

  it('should compare what was sent with the payslip now: the figures that differ, net pay first, and why', async () => {
    // Arrange
    const { a, b } = await sentThenApprovedAgain(async (p) => {
      await support(p.a, 500_000);
      await support(p.b, 700_000);
    });

    // Act
    const dto = await changes(a);

    // Assert
    expect(dto.sent).toMatchObject({ approvalNo: 1, channel: 'manual' });
    expect(dto.current).toEqual({ status: 'approved', approvalNo: 2 });
    expect(dto.events.map((e) => [e.kind, e.approvalNo, e.reason])).toEqual([
      ['reopened', 1, 'Sửa số'],
      ['approved', 2, null],
    ]);
    const net = dto.cells[0];
    expect(net?.key).toBe('netPay');
    expect((net?.now ?? 0) - (net?.sent ?? 0)).toBe(500_000);
    expect(dto.cells.map((c) => c.key)).toContain('cash');
    expect(dto.sentMonth?.lines.map((l) => l.employeeId)).toEqual([a.id]);
    expect(dto.sentMonth?.approval?.no).toBe(1);
    expect(dto.canConfirmUnchanged).toBe(false);
    const words = dto.log.map((l) => `${l.action}: ${l.detail}`);
    expect(words.some((w) => w.startsWith('Sửa đầu vào tháng') && w.includes('NV01'))).toBe(true);
    expect(words.some((w) => w.startsWith('Mở lại'))).toBe(true);
    expect(words.some((w) => w.includes('NV02'))).toBe(false);
    expect(dto.log.map((l) => l.at)).toEqual([...dto.log.map((l) => l.at)].sort().reverse());
    expect(JSON.stringify(dto.sentMonth)).not.toContain(b.id);
    await stillRight(a, 409);
  });

  it('should say nothing differs when the month was only reopened and approved again, and let HR confirm it', async () => {
    // Arrange
    const { a } = await sentThenApprovedAgain(async () => undefined);

    // Act
    const before = await changes(a);
    tick();
    const list2 = await stillRight(a);

    // Assert
    expect(before.cells).toEqual([]);
    expect(before.canConfirmUnchanged).toBe(true);
    expect(personOf(list2, a)?.send).toMatchObject({ state: 'sent', channel: 'manual' });
    expect((await logLines())[0]).toBe(
      'Xác nhận phiếu lương không đổi: Bản duyệt lần 2: NV01 NV A (số trên phiếu không đổi so với bản duyệt lần 1 đã gửi)',
    );
  });

  it('should have nothing to compare for someone never sent', async () => {
    // Arrange
    const { b } = await sentThenApprovedAgain(async () => undefined);

    // Act
    const dto = await changes(b);

    // Assert
    expect(dto).toMatchObject({
      sent: null,
      sentMonth: null,
      cells: [],
      events: [],
      log: [],
      canConfirmUnchanged: false,
    });
  });
});
