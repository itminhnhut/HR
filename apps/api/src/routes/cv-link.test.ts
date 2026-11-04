import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedDemoData } from '../db/seed.js';
import { applications } from '../db/schema.js';
import { upsertHrUser } from '../services/hr-accounts.js';
import { pdfFile } from '../test/fakes.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let appId: string;
let cookie: string;

const DAY = 24 * 60 * 60 * 1000;

const linkOf = async (id = appId) => t.request(`/api/hr/applications/${id}/cv-link`, { headers: { cookie } });

async function openLink() {
  const { url } = (await (await linkOf()).json()) as { url: string; expiresAt: string };
  return new URL(url);
}

beforeAll(async () => {
  t = await createTestContext();
});

beforeEach(async () => {
  await t.reset();
  await seedDemoData(t.db, t.clock.now);
  await upsertHrUser(t.db, { email: 'hr@lee-hr.com', name: 'HR', password: 'Hop-Dong-Test-2026' });
  const login = await t.send('POST', '/api/hr/auth/login', { email: 'hr@lee-hr.com', password: 'Hop-Dong-Test-2026' });
  cookie = (login.headers.getSetCookie()[0] ?? '').split(';')[0] ?? '';
  const [row] = await t.db.select().from(applications).limit(1);
  if (!row) throw new Error('no demo application');
  appId = row.id;
  const stored = await t.cvStore.put(row.jobId, pdfFile('CV.pdf'));
  await t.db.update(applications).set({ cvPathname: stored, cvLink: null }).where(eq(applications.id, appId));
});

describe('The CV link in an interview invitation', () => {
  it('should open the PDF for someone with no session, on the public site address', async () => {
    // Act
    const url = await openLink();
    const res = await t.request(url.pathname);

    // Assert
    expect(url.origin).toBe('https://tuyendung.test');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect((await res.text()).startsWith('%PDF-')).toBe(true);
  });

  it('should only be handed out to a signed-in HR', async () => {
    // Act
    const res = await t.request(`/api/hr/applications/${appId}/cv-link`);

    // Assert
    expect(res.status).toBe(401);
  });

  it('should stay the same all day, so a copied letter does not change under HR', async () => {
    // Arrange
    const first = await openLink();

    // Act
    t.clock.now = new Date(t.clock.now.getTime() + 60 * 60 * 1000);
    const later = await openLink();

    // Assert
    expect(later.pathname).toBe(first.pathname);
  });

  it('should open until 30 days have passed and not after', async () => {
    // Arrange
    const url = await openLink();

    // Act
    t.clock.now = new Date(t.clock.now.getTime() + 30 * DAY);
    const stillOpen = await t.request(url.pathname);
    t.clock.now = new Date(t.clock.now.getTime() + 2 * DAY);
    const expired = await t.request(url.pathname);

    // Assert
    expect(stillOpen.status).toBe(200);
    expect(expired.status).toBe(404);
  });

  it.each([
    ['a changed signature', (p: string) => `${p.slice(0, -1)}${p.endsWith('A') ? 'B' : 'A'}`],
    ['a later expiry', (p: string) => p.replace(/\.(\d+)\./, (_, exp: string) => `.${Number(exp) + 1}.`)],
    ['nonsense', () => '/api/cv/khong-phai-link'],
  ])('should refuse %s', async (_name, tamper) => {
    // Arrange
    const url = await openLink();

    // Act
    const res = await t.request(tamper(url.pathname));

    // Assert
    expect(res.status).toBe(404);
  });

  it("should not open another person's CV with this signature", async () => {
    // Arrange
    const url = await openLink();
    const others = await t.db.select().from(applications);
    const other = others.find((a) => a.id !== appId);
    if (!other) throw new Error('no second application');
    const stored = await t.cvStore.put(other.jobId, pdfFile('Khac.pdf'));
    await t.db.update(applications).set({ cvPathname: stored }).where(eq(applications.id, other.id));

    // Act
    const res = await t.request(url.pathname.replace(appId, other.id));

    // Assert
    expect(res.status).toBe(404);
  });

  it('should stop working once the CV is replaced', async () => {
    // Arrange
    const url = await openLink();
    const [row] = await t.db.select().from(applications).where(eq(applications.id, appId));
    if (!row) throw new Error('no application');
    const stored = await t.cvStore.put(row.jobId, pdfFile('Moi.pdf'));

    // Act
    await t.db.update(applications).set({ cvPathname: stored }).where(eq(applications.id, appId));
    const res = await t.request(url.pathname);

    // Assert
    expect(res.status).toBe(404);
  });

  it('should stop working once the application is deleted', async () => {
    // Arrange
    const url = await openLink();

    // Act
    await t.db.delete(applications).where(eq(applications.id, appId));
    const res = await t.request(url.pathname);

    // Assert
    expect(res.status).toBe(404);
  });

  it('should not offer a link for a CV that is only a pasted address', async () => {
    // Arrange: a job site's address can carry the employer's own access token.
    await t.db
      .update(applications)
      .set({ cvPathname: null, cvLink: 'https://ntd.vieclam24h.vn/cv?token=abc' })
      .where(eq(applications.id, appId));

    // Act
    const res = await linkOf();

    // Assert
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('vieclam24h');
  });

  it('should say the same for a link to nobody as for a bad signature', async () => {
    // Arrange
    const url = await openLink();
    const bad = await t.request(`${url.pathname.slice(0, -1)}${url.pathname.endsWith('A') ? 'B' : 'A'}`);
    await t.db.delete(applications).where(eq(applications.id, appId));

    // Act
    const gone = await t.request(url.pathname);

    // Assert
    expect(await gone.text()).toBe(await bad.text());
  });
});
