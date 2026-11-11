import { describe, expect, it } from 'vitest';
import {
  graphSendError,
  graphSendRequest,
  graphTokenError,
  graphTokenRequest,
  graphTransport,
  MailError,
  mailerFromEnv,
  mailRouteOf,
  sendMail,
  type Mailer,
  type MailMessage,
} from './mailer.js';

/** The mailer without a network: fetch is a fake that records what it was asked. Every value is made up. */
const config = {
  tenantId: 'tenant-1',
  clientId: 'client-1',
  clientSecret: 'made-up-secret',
  from: 'luong@example.com',
};
const message: MailMessage = {
  to: 'nv01@example.com',
  subject: 'Phiếu lương tháng 10/2026',
  html: '<p>Xin chào</p>',
  attachments: [{ fileName: 'Phieu-luong-2026-10-NV01.xlsx', contentType: 'application/x', contentBase64: 'UEsDBA==' }],
};

function fakeFetch(answers: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = answers.shift();
    if (!next) throw new Error('No answer left');
    return next;
  };
  return { calls, fetchFn };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const recording = (devTo: string | null) => {
  const sent: MailMessage[] = [];
  const mailer: Mailer = { transport: async (m) => void sent.push(m), devTo };
  return { sent, mailer };
};

describe('Microsoft Graph requests', () => {
  it('should ask the tenant for a client-credentials token of Graph', () => {
    // Act
    const { url, init } = graphTokenRequest(config);

    // Assert
    expect(url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token');
    const body = new URLSearchParams(String(init.body));
    expect(body.get('scope')).toBe('https://graph.microsoft.com/.default');
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_id')).toBe('client-1');
  });

  it('should post an HTML mail with its file to the sending mailbox and keep it in Sent Items', () => {
    // Act
    const { url, init } = graphSendRequest(config, 'token-1', message);

    // Assert
    expect(url).toBe('https://graph.microsoft.com/v1.0/users/luong%40example.com/sendMail');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-1');
    expect(JSON.parse(String(init.body))).toEqual({
      message: {
        subject: 'Phiếu lương tháng 10/2026',
        body: { contentType: 'HTML', content: '<p>Xin chào</p>' },
        toRecipients: [{ emailAddress: { address: 'nv01@example.com' } }],
        attachments: [
          {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: 'Phieu-luong-2026-10-NV01.xlsx',
            contentType: 'application/x',
            contentBytes: 'UEsDBA==',
          },
        ],
      },
      saveToSentItems: true,
    });
  });

  it('should get one token and reuse it for the next mail', async () => {
    // Arrange
    const { calls, fetchFn } = fakeFetch([
      json(200, { access_token: 'token-1', expires_in: 3600 }),
      new Response(null, { status: 202 }),
      new Response(null, { status: 202 }),
    ]);
    const send = graphTransport(config, fetchFn, () => new Date('2026-11-05T03:00:00Z'));

    // Act
    await send(message);
    await send(message);

    // Assert
    expect(calls.map((c) => new URL(c.url).hostname)).toEqual([
      'login.microsoftonline.com',
      'graph.microsoft.com',
      'graph.microsoft.com',
    ]);
  });

  it('should say in Vietnamese why Microsoft refused, without the secret', async () => {
    // Arrange
    const { fetchFn } = fakeFetch([
      json(200, { access_token: 'token-1', expires_in: 3600 }),
      json(403, { error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } }),
    ]);
    const send = graphTransport(config, fetchFn, () => new Date('2026-11-05T03:00:00Z'));

    // Act
    const failure = await send(message).catch((e: unknown) => e);

    // Assert
    expect(failure).toBeInstanceOf(MailError);
    expect((failure as MailError).message).toContain('chưa được cấp quyền Mail.Send');
    expect((failure as MailError).message).not.toContain('made-up-secret');
  });

  it('should name the wrong secret, the missing mailbox and a refused sign-in', () => {
    // Assert
    expect(graphTokenError({ error_description: 'AADSTS7000215: Invalid client secret provided.' })).toContain(
      'MAIL_GRAPH_CLIENT_SECRET',
    );
    expect(graphTokenError({ error_description: 'AADSTS90002: Tenant not found.' })).toContain('MAIL_GRAPH_TENANT_ID');
    expect(graphSendError(404, { error: { code: 'ErrorInvalidUser' } })).toContain('MAIL_FROM_ADDRESS');
    expect(graphSendError(500, {})).toBe('Microsoft từ chối gửi thư (mã 500).');
  });
});

describe('a test machine never mails an employee', () => {
  it('should send to the employee on production without a test mailbox', async () => {
    // Arrange
    const { sent, mailer } = recording(null);

    // Act
    const result = await sendMail(mailer, true, message);

    // Assert
    expect(result.sentTo).toBe('nv01@example.com');
    expect(sent.map((m) => m.to)).toEqual(['nv01@example.com']);
  });

  it('should send to MAIL_DEV_TO only, with the intended address in the subject', async () => {
    // Arrange
    const { sent, mailer } = recording('thu@example.com');

    // Act
    const result = await sendMail(mailer, false, message);

    // Assert
    expect(result.sentTo).toBe('thu@example.com');
    expect(sent.map((m) => m.to)).toEqual(['thu@example.com']);
    expect(sent[0]?.subject).toBe('[THỬ – lẽ ra gửi nv01@example.com] Phiếu lương tháng 10/2026');
  });

  it('should redirect on production too while MAIL_DEV_TO is set', async () => {
    // Arrange
    const { sent, mailer } = recording('thu@example.com');

    // Act
    await sendMail(mailer, true, message);

    // Assert
    expect(sent.map((m) => m.to)).toEqual(['thu@example.com']);
  });

  it('should refuse to send off production without MAIL_DEV_TO', async () => {
    // Arrange
    const { sent, mailer } = recording(null);

    // Act
    const failure = await sendMail(mailer, false, message).catch((e: unknown) => e);

    // Assert
    expect(failure).toBeInstanceOf(MailError);
    expect(sent).toEqual([]);
    expect(mailRouteOf(mailer, false).blocked).toContain('MAIL_DEV_TO');
  });

  it('should be off until every Microsoft Graph value is set', () => {
    // Arrange
    const { fetchFn } = fakeFetch([]);
    const env = { MAIL_GRAPH_TENANT_ID: 't', MAIL_GRAPH_CLIENT_ID: 'c', MAIL_FROM_ADDRESS: 'luong@example.com' };

    // Act
    const off = mailerFromEnv(env, fetchFn, () => new Date());
    const on = mailerFromEnv(
      { ...env, MAIL_GRAPH_CLIENT_SECRET: 's', MAIL_DEV_TO: ' Thu@Example.com ' },
      fetchFn,
      () => new Date(),
    );

    // Assert
    expect(off).toBeNull();
    expect(mailRouteOf(off, true)).toEqual({ isConfigured: false, redirectTo: null, blocked: null });
    expect(on?.devTo).toBe('thu@example.com');
  });
});
