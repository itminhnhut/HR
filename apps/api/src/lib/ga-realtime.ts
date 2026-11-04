import type { RealtimeDto, RealtimeRow } from '@careers/shared';
import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';
import type { FetchFn } from './indexnow.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const API = 'https://analyticsdata.googleapis.com/v1beta/properties';
const REQUEST_TIMEOUT_MS = 8_000;
/** The panel asks about once a minute: everyone looking shares one answer, and one quota charge. */
const FRESH_MS = 60_000;
/** A failure is not retried for every request either. */
const FAILURE_MS = 30_000;
const LIST_MAX = 5;
const MINUTES = 30;

const NOT_SET = new Set(['(not set)', '']);
const DEVICE_NAME: Record<string, string> = { desktop: 'Máy tính', mobile: 'Điện thoại', tablet: 'Máy bảng' };

export interface GaRealtimeConfig {
  /** The number in Analytics > Property settings, not the "G-…" measurement id. */
  propertyId: string;
  clientEmail: string;
  privateKey: string;
}

export type RealtimeReader = () => Promise<RealtimeDto>;

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });

const reportSchema = z.object({
  rows: z
    .array(
      z.object({
        dimensionValues: z.array(z.object({ value: z.string() })).optional(),
        metricValues: z.array(z.object({ value: z.string() })).min(1),
      }),
    )
    .optional(),
});

type Report = z.infer<typeof reportSchema>;

const usersOf = (row: NonNullable<Report['rows']>[number]) => Number(row.metricValues[0]?.value ?? 0) || 0;
const nameOf = (row: NonNullable<Report['rows']>[number]) => row.dimensionValues?.[0]?.value ?? '';

function topRows(report: Report, rename: (name: string) => string = (name) => name): RealtimeRow[] {
  return (report.rows ?? [])
    .map((row) => ({ name: NOT_SET.has(nameOf(row)) ? 'Không rõ' : rename(nameOf(row)), users: usersOf(row) }))
    .sort((a, b) => b.users - a.users)
    .slice(0, LIST_MAX);
}

/** Oldest first; a minute without events has no row. */
function usersPerMinute(report: Report): number[] {
  const perMinute = Array<number>(MINUTES).fill(0);
  for (const row of report.rows ?? []) {
    const ago = Number(nameOf(row));
    if (Number.isInteger(ago) && ago >= 0 && ago < MINUTES) perMinute[MINUTES - 1 - ago] = usersOf(row);
  }
  return perMinute;
}

function assertOk(response: Response, what: string): void {
  // The status is enough to tell what went wrong; neither the key nor a token ever goes in a message.
  if (!response.ok) throw new Error(`${what} answered ${response.status}`);
}

/** Reads who is on the site from the Analytics Realtime API, with a service account that may only read. */
export function createGaRealtimeReader(config: GaRealtimeConfig, fetchFn: FetchFn, now: () => Date): RealtimeReader {
  let token: { value: string; until: number } | null = null;
  let answer: { value: RealtimeDto; until: number } | null = null;
  let pending: Promise<RealtimeDto> | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.until > now().getTime()) return token.value;
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(config.clientEmail)
      .setAudience(TOKEN_URL)
      .setIssuedAt(Math.floor(now().getTime() / 1000))
      .setExpirationTime(Math.floor(now().getTime() / 1000) + 3600)
      .sign(await importPKCS8(config.privateKey, 'RS256'));
    const response = await fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assertOk(response, 'Google sign-in');
    const parsed = tokenSchema.parse(await response.json());
    // A minute early, so a token never runs out in the middle of a request.
    token = { value: parsed.access_token, until: now().getTime() + (parsed.expires_in - 60) * 1000 };
    return parsed.access_token;
  }

  async function report(bearer: string, dimension?: string): Promise<Report> {
    const response = await fetchFn(`${API}/${config.propertyId}:runRealtimeReport`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        metrics: [{ name: 'activeUsers' }],
        ...(dimension ? { dimensions: [{ name: dimension }] } : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assertOk(response, 'Analytics');
    return reportSchema.parse(await response.json());
  }

  async function read(): Promise<RealtimeDto> {
    const bearer = await accessToken();
    const [total, pages, cities, devices, minutes] = await Promise.all([
      report(bearer),
      report(bearer, 'unifiedScreenName'),
      report(bearer, 'city'),
      report(bearer, 'deviceCategory'),
      report(bearer, 'minutesAgo'),
    ]);
    return {
      status: 'ok',
      activeUsers: total.rows?.[0] ? usersOf(total.rows[0]) : 0,
      perMinute: usersPerMinute(minutes),
      pages: topRows(pages),
      cities: topRows(cities),
      devices: topRows(devices, (name) => DEVICE_NAME[name] ?? name),
      fetchedAt: now().toISOString(),
    };
  }

  async function refresh(): Promise<RealtimeDto> {
    try {
      const value = await read();
      answer = { value, until: now().getTime() + FRESH_MS };
      return value;
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'unknown';
      console.warn(`Analytics realtime failed: ${reason}`);
      const value: RealtimeDto = { status: 'error' };
      answer = { value, until: now().getTime() + FAILURE_MS };
      return value;
    } finally {
      pending = null;
    }
  }

  return () => {
    if (answer && answer.until > now().getTime()) return Promise.resolve(answer.value);
    pending ??= refresh();
    return pending;
  };
}

/** Turned off until the three settings exist; a key pasted into Vercel keeps its line breaks as "\n". */
export function gaRealtimeConfig(env: Record<string, string | undefined>): GaRealtimeConfig | null {
  const propertyId = env.GA_PROPERTY_ID?.trim();
  const clientEmail = env.GA_CLIENT_EMAIL?.trim();
  const privateKey = env.GA_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!propertyId || !clientEmail || !privateKey) return null;
  if (!/^\d+$/.test(propertyId)) {
    console.warn('GA_PROPERTY_ID must be the number of the property, not the "G-…" id: realtime is off.');
    return null;
  }
  return { propertyId, clientEmail, privateKey };
}
