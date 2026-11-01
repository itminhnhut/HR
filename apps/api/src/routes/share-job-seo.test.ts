import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { insertJob } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(() => t.reset());

const TOPCV_ADDRESS = 'Hồ Chí Minh: 110/20/2 Đường Số 30, Phường An Nhơn (Phường An Nhơn thuộc quận Gò Vấp cũ)';

const crawlerPage = async (slug: string) => (await t.request(`/viec-lam/${slug}`)).text();
const metaContent = (html: string, attr: string, key: string) =>
  new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`).exec(html)?.[1];
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
    (match) => JSON.parse(match[1] ?? '{}') as Record<string, unknown>,
  );

describe('job page for crawlers: title, description and address', () => {
  it('should title the page "Tuyển {job} – {short place}" with the brand, and use it for og:title', async () => {
    // Arrange
    await insertJob(t, { slug: 'kinh-doanh', title: 'Nhân viên Kinh doanh', address: TOPCV_ADDRESS });

    // Act
    const html = await crawlerPage('kinh-doanh');

    // Assert
    const title = 'Tuyển Nhân viên Kinh doanh – Gò Vấp, TP.HCM · Công ty Test';
    expect(html).toContain(`<title>${title}</title>`);
    expect(metaContent(html, 'property', 'og:title')).toBe(title);
  });

  it('should tidy the spaces in parentheses for the title only and keep the heading as HR typed it', async () => {
    await insertJob(t, { slug: 'ke-toan', title: 'Kế toán ( Thuế )' });

    const html = await crawlerPage('ke-toan');

    expect(html).toContain('<title>Tuyển Kế toán (Thuế) – Gò Vấp, TP.HCM · Công ty Test</title>');
    expect(html).toContain('<h1>Kế toán ( Thuế )</h1>');
  });

  it('should describe the job starting with "Tuyển", without the raw address, the same in og:description', async () => {
    // Arrange
    await insertJob(t, {
      slug: 'kinh-doanh',
      title: 'Nhân viên Kinh doanh',
      address: TOPCV_ADDRESS,
      salaryMin: 12_000_000,
      salaryMax: 18_000_000,
      experience: 'Từ 1 năm',
      deadline: '2026-11-30',
    });

    // Act
    const html = await crawlerPage('kinh-doanh');

    // Assert
    const description = metaContent(html, 'name', 'description');
    expect(description).toBe(
      'Tuyển Nhân viên Kinh doanh tại Gò Vấp, TP.HCM. Lương 12 – 18 triệu, toàn thời gian, kinh nghiệm từ 1 năm. ' +
        'Hạn nộp 30/11/2026, ứng tuyển online trong 1 phút.',
    );
    expect(metaContent(html, 'property', 'og:description')).toBe(description);
  });

  it('should give Google the street, old district and city of a TopCV address, and show it as HR typed it', async () => {
    // Arrange
    await insertJob(t, { slug: 'kinh-doanh', address: TOPCV_ADDRESS });

    // Act
    const html = await crawlerPage('kinh-doanh');

    // Assert
    const posting = jsonLd(html).find((data) => data['@type'] === 'JobPosting');
    expect(posting?.jobLocation).toEqual({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '110/20/2 Đường Số 30, Phường An Nhơn',
        addressLocality: 'Gò Vấp',
        addressRegion: 'TP. Hồ Chí Minh',
        addressCountry: 'VN',
      },
    });
    expect(html).toContain(`<dd>${TOPCV_ADDRESS}</dd>`);
  });
});
