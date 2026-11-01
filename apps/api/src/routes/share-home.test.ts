import { addDays, formatDate, todayInVietnam } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { insertJob } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';
import { insertCategory, insertPost } from '../test/news-fixtures.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(() => t.reset());

const SITE = 'https://tuyendung.test';
const home = async () => {
  const res = await t.request('/');
  return { res, html: await res.text() };
};
const jsonLdOf = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
    (m) => JSON.parse(m[1]) as Record<string, unknown>,
  );

describe('GET / for crawlers', () => {
  it('should give the home page a keyword title, a full description, its canonical address and one H1', async () => {
    // Act
    const { res, html } = await home();

    // Assert
    expect(res.status).toBe(200);
    expect(html).toContain('<title>Tuyển dụng Công ty Test – Việc làm Gò Vấp, TP.HCM</title>');
    const description = /<meta name="description" content="([^"]*)">/.exec(html)?.[1] ?? '';
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/">`);
    expect(html).toContain('<meta name="robots" content="index, follow, max-image-preview:large">');
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it('should link every open job with its salary, short place and deadline, and leave out closed jobs', async () => {
    // Arrange
    const deadline = addDays(todayInVietnam(t.clock.now), 20);
    await insertJob(t, { slug: 'ke-toan', title: 'Kế toán', salaryMin: 12_000_000, salaryMax: 15_000_000, deadline });
    await insertJob(t, { slug: 'dong', title: 'Đã đóng', state: 'closed', closedOn: '2026-10-19' });
    await insertJob(t, { slug: 'nhap', title: 'Bản nháp', state: 'draft' });

    // Act
    const { html } = await home();

    // Assert
    const item = /<li>[^]*?ke-toan[^]*?<\/li>/.exec(html)?.[0] ?? '';
    expect(item).toContain(`<a href="${SITE}/viec-lam/ke-toan">Kế toán</a>`);
    expect(item).toContain('12 – 15 triệu');
    expect(item).toContain('Gò Vấp, TP.HCM');
    expect(item).toContain(formatDate(deadline));
    expect(html).not.toContain('/viec-lam/dong');
    expect(html).not.toContain('/viec-lam/nhap');
  });

  it('should link the six newest published articles and the news, about and job pages', async () => {
    // Arrange
    const category = await insertCategory(t, 'Đời sống');
    for (let day = 1; day <= 7; day++) {
      await insertPost(t, category.id, { slug: `bai-${day}`, publishedAt: new Date(`2026-10-0${day}T02:00:00Z`) });
    }
    await insertPost(t, category.id, { slug: 'nhap', status: 'draft', publishedAt: null });

    // Act
    const { html } = await home();

    // Assert
    for (let day = 2; day <= 7; day++) expect(html).toContain(`href="${SITE}/tin-tuc/bai-${day}"`);
    expect(html).not.toContain(`href="${SITE}/tin-tuc/bai-1"`);
    expect(html).not.toContain('/tin-tuc/nhap');
    expect(html).toContain(`href="${SITE}/tin-tuc"`);
    expect(html).toContain(`href="${SITE}/gioi-thieu"`);
  });

  it('should describe the company and the site for Google, with the company logo', async () => {
    // Act
    const { html } = await home();

    // Assert
    const graph = (jsonLdOf(html)[0]?.['@graph'] ?? []) as Record<string, unknown>[];
    expect(graph.map((node) => node['@type'])).toEqual(['Organization', 'WebSite']);
    expect(graph[0]).toMatchObject({
      '@id': `${SITE}/#organization`,
      name: 'Công ty Test',
      logo: `${SITE}/images/logo-512.png`,
    });
    expect(graph[1]).toMatchObject({ url: `${SITE}/`, publisher: { '@id': `${SITE}/#organization` } });
  });

  it('should say so when no job is open instead of an empty list', async () => {
    // Act
    const { html } = await home();

    // Assert
    expect(html).toContain('Hiện chưa có vị trí đang tuyển');
    expect(html).not.toContain('<ul></ul>');
  });
});
