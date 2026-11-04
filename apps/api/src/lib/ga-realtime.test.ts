import { generateKeyPairSync } from 'node:crypto';
import { decodeJwt } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { createGaRealtimeReader, gaRealtimeConfig } from './ga-realtime.js';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const CONFIG = { propertyId: '123', clientEmail: 'reader@project.iam.gserviceaccount.com', privateKey };
const START = new Date('2026-11-04T03:00:00.000Z');

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const rows = (...pairs: [string, string][]) => ({
  rows: pairs.map(([name, users]) => ({ dimensionValues: [{ value: name }], metricValues: [{ value: users }] })),
});

const REPORTS: Record<string, unknown> = {
  none: { rows: [{ metricValues: [{ value: '7' }] }] },
  unifiedScreenName: rows(['Trang chủ', '2'], ['Kế toán', '5'], ['(not set)', '1']),
  city: rows(['Ho Chi Minh City', '4']),
  deviceCategory: rows(['mobile', '6'], ['desktop', '1']),
  minutesAgo: rows(['00', '3'], ['29', '1']),
};

function fakeGoogle(overrides: { token?: () => Response; report?: () => Response } = {}) {
  return vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes('oauth2.googleapis.com')) {
      return overrides.token?.() ?? json({ access_token: 'token-1', expires_in: 3600 });
    }
    if (overrides.report) return overrides.report();
    const body = JSON.parse(String(init.body)) as { dimensions?: { name: string }[] };
    return json(REPORTS[body.dimensions?.[0]?.name ?? 'none']);
  });
}

const reportCalls = (fetchFn: ReturnType<typeof fakeGoogle>) =>
  fetchFn.mock.calls.filter(([url]) => url.includes('runRealtimeReport')).length;

describe('createGaRealtimeReader', () => {
  it('should sign in with a read-only scope and turn the reports into the panel numbers', async () => {
    // Arrange
    const fetchFn = fakeGoogle();

    // Act
    const result = await createGaRealtimeReader(CONFIG, fetchFn, () => START)();

    // Assert
    const assertion = new URLSearchParams(String(fetchFn.mock.calls[0]?.[1].body)).get('assertion') ?? '';
    expect(decodeJwt(assertion)).toMatchObject({
      iss: CONFIG.clientEmail,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
    });
    expect(result).toMatchObject({
      status: 'ok',
      activeUsers: 7,
      pages: [
        { name: 'Kế toán', users: 5 },
        { name: 'Trang chủ', users: 2 },
        { name: 'Không rõ', users: 1 },
      ],
      cities: [{ name: 'Ho Chi Minh City', users: 4 }],
      devices: [
        { name: 'Điện thoại', users: 6 },
        { name: 'Máy tính', users: 1 },
      ],
      fetchedAt: START.toISOString(),
    });
  });

  it('should keep the minutes in order, oldest first, with a zero for a minute without a row', async () => {
    const result = await createGaRealtimeReader(CONFIG, fakeGoogle(), () => START)();

    expect(result.status === 'ok' && result.perMinute).toEqual([1, ...Array<number>(28).fill(0), 3]);
  });

  it('should say zero when nobody is on the site', async () => {
    const fetchFn = fakeGoogle({ report: () => json({}) });

    const result = await createGaRealtimeReader(CONFIG, fetchFn, () => START)();

    expect(result).toMatchObject({ status: 'ok', activeUsers: 0, pages: [], cities: [], devices: [] });
  });

  it('should ask Google once a minute however many people look', async () => {
    // Arrange
    const fetchFn = fakeGoogle();
    let time = START.getTime();
    const read = createGaRealtimeReader(CONFIG, fetchFn, () => new Date(time));

    // Act
    await Promise.all([read(), read()]);
    time += 59_000;
    await read();

    // Assert
    expect(reportCalls(fetchFn)).toBe(5);

    // Act
    time += 2_000;
    await read();

    // Assert: fresh numbers, on the token it already has.
    expect(reportCalls(fetchFn)).toBe(10);
    expect(fetchFn.mock.calls.filter(([url]) => url.includes('oauth2')).length).toBe(1);
  });

  it('should answer an error, without any secret in the log, when Google refuses', async () => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchFn = fakeGoogle({ report: () => json({ error: 'denied' }, 403) });

    // Act
    const result = await createGaRealtimeReader(CONFIG, fetchFn, () => START)();

    // Assert
    expect(result).toEqual({ status: 'error' });
    const logged = warn.mock.calls.flat().join(' ');
    expect(logged).toContain('403');
    expect(logged).not.toContain('token-1');
    expect(logged).not.toContain('PRIVATE KEY');
    warn.mockRestore();
  });

  it('should answer an error when Google sends something unexpected', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchFn = fakeGoogle({ report: () => json({ rows: 'nope' }) });

    expect(await createGaRealtimeReader(CONFIG, fetchFn, () => START)()).toEqual({ status: 'error' });
    warn.mockRestore();
  });
});

describe('gaRealtimeConfig', () => {
  const env = { GA_PROPERTY_ID: '123', GA_CLIENT_EMAIL: 'a@b.c', GA_PRIVATE_KEY: 'line1\\nline2' };

  it('should be off until all three settings exist', () => {
    expect(gaRealtimeConfig({ ...env, GA_PRIVATE_KEY: '' })).toBeNull();
  });

  it('should restore the line breaks of a key pasted on one line', () => {
    expect(gaRealtimeConfig(env)?.privateKey).toBe('line1\nline2');
  });

  it('should refuse the "G-…" id, which is not the property number', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(gaRealtimeConfig({ ...env, GA_PROPERTY_ID: 'G-6V6FZ57EST' })).toBeNull();
    warn.mockRestore();
  });
});
