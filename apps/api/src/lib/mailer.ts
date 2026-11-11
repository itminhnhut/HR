import type { FetchFn } from './indexnow.js';

/**
 * Mail the server sends by itself (payslips). One interface, `sendMail({ to, subject, html, attachments })`, behind
 * which sits the company's Microsoft 365 mailbox through Microsoft Graph (client credentials, plain fetch). Tests
 * pass a fake transport through Deps: nothing here opens a connection unless production wires it.
 *
 * A machine that is not Vercel production NEVER mails an employee: every mail goes to MAIL_DEV_TO with the intended
 * address in the subject, and without MAIL_DEV_TO nothing is sent at all.
 */

export interface MailAttachment {
  fileName: string;
  contentType: string;
  contentBase64: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  attachments?: readonly MailAttachment[];
}

/** Sends one mail, or throws a `MailError` whose message HR can read. */
export type MailTransport = (message: MailMessage) => Promise<void>;

export interface Mailer {
  transport: MailTransport;
  /** MAIL_DEV_TO: where every mail goes instead of its recipient. */
  devTo: string | null;
}

/** The provider's reason in Vietnamese, without anything secret. */
export class MailError extends Error {}

export interface MailRoute {
  isConfigured: boolean;
  redirectTo: string | null;
  blocked: string | null;
}

export const MAIL_NOT_CONFIGURED = 'Chưa cấu hình hộp thư gửi';
const NO_DEV_MAILBOX = 'Máy thử chưa đặt MAIL_DEV_TO nên không gửi thư, để không gửi nhầm cho nhân viên.';

/** Where a mail of this machine goes: the recipient on production, the test mailbox anywhere else. */
export function mailRouteOf(mailer: Mailer | null | undefined, isProduction: boolean): MailRoute {
  if (!mailer) return { isConfigured: false, redirectTo: null, blocked: null };
  if (mailer.devTo) return { isConfigured: true, redirectTo: mailer.devTo, blocked: null };
  return { isConfigured: true, redirectTo: null, blocked: isProduction ? null : NO_DEV_MAILBOX };
}

/** Sends through the mailer with the test-machine rule applied. Answers the address the mail really went to. */
export async function sendMail(
  mailer: Mailer | null | undefined,
  isProduction: boolean,
  message: MailMessage,
): Promise<{ sentTo: string }> {
  const route = mailRouteOf(mailer, isProduction);
  if (!mailer || !route.isConfigured) throw new MailError(MAIL_NOT_CONFIGURED);
  if (route.blocked) throw new MailError(route.blocked);
  if (!route.redirectTo) {
    await mailer.transport(message);
    return { sentTo: message.to };
  }
  await mailer.transport({
    ...message,
    to: route.redirectTo,
    subject: `[THỬ – lẽ ra gửi ${message.to}] ${message.subject}`,
  });
  return { sentTo: route.redirectTo };
}

export interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** The mailbox the mail is sent from (MAIL_FROM_ADDRESS). */
  from: string;
}

interface HttpCall {
  url: string;
  init: RequestInit;
}

/** The client-credentials token request of Microsoft identity. */
export function graphTokenRequest(config: GraphConfig): HttpCall {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  return {
    url: `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  };
}

/** `POST /users/<mailbox>/sendMail`: an HTML mail with its files, kept in Sent Items. */
export function graphSendRequest(config: GraphConfig, token: string, message: MailMessage): HttpCall {
  const attachments = (message.attachments ?? []).map((a) => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: a.fileName,
    contentType: a.contentType,
    contentBytes: a.contentBase64,
  }));
  const body = {
    message: {
      subject: message.subject,
      body: { contentType: 'HTML', content: message.html },
      toRecipients: [{ emailAddress: { address: message.to } }],
      ...(attachments.length > 0 ? { attachments } : {}),
    },
    saveToSentItems: true,
  };
  return {
    url: `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.from)}/sendMail`,
    init: {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  };
}

async function jsonOf(res: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await res.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch (error) {
    // An empty or non-JSON answer still has its status, which is what the caller reports.
    console.warn('Mail provider answered without JSON', res.status, error instanceof Error ? error.name : '');
    return {};
  }
}

/** Why Microsoft refused to sign the app in, from the AADSTS code of the answer. */
export function graphTokenError(body: Record<string, unknown>): string {
  const code = /AADSTS\d+/.exec(String(body.error_description ?? ''))?.[0] ?? '';
  if (code === 'AADSTS7000215' || code === 'AADSTS7000222') {
    return 'Mã bí mật của ứng dụng (MAIL_GRAPH_CLIENT_SECRET) sai hoặc đã hết hạn.';
  }
  if (code === 'AADSTS700016') return 'Không tìm thấy ứng dụng (kiểm tra MAIL_GRAPH_CLIENT_ID).';
  if (code === 'AADSTS90002' || code === 'AADSTS900023') {
    return 'Không tìm thấy tổ chức Microsoft 365 (kiểm tra MAIL_GRAPH_TENANT_ID).';
  }
  return `Microsoft không cho ứng dụng đăng nhập${code ? ` (mã ${code})` : ''}.`;
}

/** Why Microsoft refused the mail, from the status and the error code of the answer. */
export function graphSendError(status: number, body: Record<string, unknown>): string {
  const error = typeof body.error === 'object' && body.error !== null ? (body.error as Record<string, unknown>) : {};
  const code = typeof error.code === 'string' ? error.code : '';
  if (status === 403 || code === 'ErrorAccessDenied') {
    return 'Ứng dụng chưa được cấp quyền Mail.Send (nhờ quản trị Microsoft 365 cấp quyền và bấm "Grant admin consent").';
  }
  if (status === 404 || code === 'ErrorInvalidUser' || code === 'MailboxNotEnabledForRESTAPI') {
    return 'Không tìm thấy hộp thư gửi (kiểm tra MAIL_FROM_ADDRESS).';
  }
  if (code === 'ErrorInvalidRecipients') return 'Địa chỉ người nhận không hợp lệ.';
  if (status === 429) return 'Microsoft đang giới hạn tốc độ gửi, thử lại sau ít phút.';
  return `Microsoft từ chối gửi thư (mã ${code || status}).`;
}

const TOKEN_MARGIN_MS = 60_000;

/** Sends through Microsoft Graph; the token is kept until a minute before it ends. */
export function graphTransport(config: GraphConfig, fetchFn: FetchFn, now: () => Date): MailTransport {
  let cached: { token: string; until: number } | null = null;
  const call = async ({ url, init }: HttpCall): Promise<Response> => {
    try {
      return await fetchFn(url, init);
    } catch (error) {
      console.warn('Mail provider unreachable', error instanceof Error ? error.name : '');
      throw new MailError('Không kết nối được tới Microsoft, thử lại sau.');
    }
  };
  const tokenOf = async (): Promise<string> => {
    if (cached && cached.until > now().getTime()) return cached.token;
    const res = await call(graphTokenRequest(config));
    const body = await jsonOf(res);
    if (!res.ok || typeof body.access_token !== 'string') throw new MailError(graphTokenError(body));
    const seconds = typeof body.expires_in === 'number' ? body.expires_in : 300;
    cached = { token: body.access_token, until: now().getTime() + seconds * 1000 - TOKEN_MARGIN_MS };
    return cached.token;
  };
  return async (message) => {
    const res = await call(graphSendRequest(config, await tokenOf(), message));
    if (res.ok) return;
    if (res.status === 401) cached = null;
    throw new MailError(graphSendError(res.status, await jsonOf(res)));
  };
}

type MailEnv = Readonly<Record<string, string | undefined>>;

/** The mailer of this deployment; null (sending off) until the four Microsoft Graph values are set. */
export function mailerFromEnv(env: MailEnv, fetchFn: FetchFn, now: () => Date): Mailer | null {
  const value = (name: string) => env[name]?.trim() ?? '';
  const config: GraphConfig = {
    tenantId: value('MAIL_GRAPH_TENANT_ID'),
    clientId: value('MAIL_GRAPH_CLIENT_ID'),
    clientSecret: value('MAIL_GRAPH_CLIENT_SECRET'),
    from: value('MAIL_FROM_ADDRESS'),
  };
  if (!config.tenantId || !config.clientId || !config.clientSecret || !config.from) return null;
  return { transport: graphTransport(config, fetchFn, now), devTo: value('MAIL_DEV_TO').toLowerCase() || null };
}
