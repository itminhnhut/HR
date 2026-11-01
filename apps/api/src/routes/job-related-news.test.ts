import type { JobPageResponse } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getJobPage } from '../services/public-jobs.js';
import { jobBotPage } from '../services/job-bot-page.js';
import { insertJob, json } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';
import { insertCategory, insertPost, tagPost } from '../test/news-fixtures.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(() => t.reset());

const SITE = { url: 'https://tuyendung.test', companyName: 'Công ty Test' };

/** One post `days` after the test clock (newer posts have more days). */
const later = (days: number) => new Date(t.clock.now.getTime() + days * 86_400_000);

describe('related news posts on a job page', () => {
  it('should send up to 3 published posts that match the job, best match first', async () => {
    // Arrange
    await insertJob(t, { slug: 'kinh-doanh', title: 'Nhân viên Kinh doanh B2B', department: 'Kinh doanh' });
    const life = await insertCategory(t, 'Đời sống');
    const best = await insertPost(t, life.id, { title: 'Bí quyết kinh doanh B2B', slug: 'bi-quyet' });
    const tagged = await insertPost(t, life.id, { title: 'Một ngày ở văn phòng', slug: 'mot-ngay' });
    await tagPost(t, tagged.id, ['Kinh doanh']);
    await insertPost(t, life.id, { title: 'Kinh doanh B2B (nháp)', slug: 'nhap', status: 'draft' });
    await insertPost(t, life.id, { title: 'Tiệc cuối năm', slug: 'tiec' });

    // Act
    const { related } = await json<JobPageResponse>(await t.request('/api/jobs/kinh-doanh'));

    // Assert
    expect(related?.map((post) => post.slug)).toEqual(['bi-quyet', 'mot-ngay']);
    expect(related?.[0]).toEqual({
      slug: 'bi-quyet',
      title: 'Bí quyết kinh doanh B2B',
      cover: best.cover,
      category: { name: 'Đời sống', slug: 'doi-song' },
    });
  });

  it('should fall back to the newest hiring and careers posts when no post matches the job', async () => {
    // Arrange
    await insertJob(t, { slug: 'ke-toan', title: 'Kế toán', department: 'Tài chính' });
    const hiring = await insertCategory(t, 'Tuyển dụng');
    const careers = await insertCategory(t, 'Hướng nghiệp');
    const life = await insertCategory(t, 'Đời sống');
    await insertPost(t, careers.id, { title: 'Viết CV', slug: 'viet-cv', publishedAt: later(1) });
    await insertPost(t, hiring.id, { title: 'Ngày hội việc làm', slug: 'ngay-hoi', publishedAt: later(2) });
    await insertPost(t, life.id, { title: 'Tiệc cuối năm', slug: 'tiec', publishedAt: later(3) });

    // Act
    const { related } = await getJobPage(t.db, 'ke-toan', t.clock.now);

    // Assert
    expect(related?.map((post) => post.slug)).toEqual(['ngay-hoi', 'viet-cv']);
  });

  it('should link the related posts from the crawler page, before the similar jobs', async () => {
    // Arrange
    await insertJob(t, { slug: 'kinh-doanh', title: 'Nhân viên Kinh doanh B2B', department: 'Kinh doanh' });
    await insertJob(t, { slug: 'khac', title: 'Kỹ sư', department: 'Kỹ thuật' });
    const life = await insertCategory(t, 'Đời sống');
    await insertPost(t, life.id, { title: 'Bí quyết kinh doanh <B2B>', slug: 'bi-quyet' });
    const { job, similar, related } = await getJobPage(t.db, 'kinh-doanh', t.clock.now);

    // Act
    const html = jobBotPage(SITE, job, similar, related);

    // Assert
    expect(html).toContain('<h2>Bài viết liên quan</h2>');
    expect(html).toContain('<a href="https://tuyendung.test/tin-tuc/bi-quyet">Bí quyết kinh doanh &lt;B2B&gt;</a>');
    expect(html.indexOf('Bài viết liên quan')).toBeLessThan(html.indexOf('Việc làm tương tự'));
  });

  it('should show the related posts to crawlers that open the job address', async () => {
    // Arrange
    await insertJob(t, { slug: 'kinh-doanh', title: 'Nhân viên Kinh doanh B2B', department: 'Kinh doanh' });
    const life = await insertCategory(t, 'Đời sống');
    await insertPost(t, life.id, { title: 'Bí quyết kinh doanh B2B', slug: 'bi-quyet' });

    // Act
    const html = await (await t.request('/share/jobs/kinh-doanh')).text();

    // Assert
    expect(html).toContain('<a href="https://tuyendung.test/tin-tuc/bi-quyet">Bí quyết kinh doanh B2B</a>');
  });

  it('should leave the section out of the crawler page when there is nothing to link', async () => {
    await insertJob(t, { slug: 'kinh-doanh' });
    const { job, similar } = await getJobPage(t.db, 'kinh-doanh', t.clock.now);

    expect(jobBotPage(SITE, job, similar, [])).not.toContain('Bài viết liên quan');
  });
});
