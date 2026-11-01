import { LEVEL_OPTIONS, type HrJobDto, type JobPageResponse, type JobTemplateResponse } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { insertJob, jobInput, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let cookie: string;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });
const saveNew = async (overrides = {}) => json<HrJobDto>(await hr('POST', '/jobs', jobInput(overrides)));
const publicJob = async (slug: string) => (await json<JobPageResponse>(await t.request(`/api/jobs/${slug}`))).job;

describe('"Cấp bậc", "Số lượng tuyển", "Hình thức làm việc" on a job', () => {
  it('should save the three fields and show them on the public job', async () => {
    // Arrange / Act
    const saved = await saveNew({ level: 'Nhân viên', openings: 2, workMode: 'hybrid' });
    const reread = await json<HrJobDto>(await hr('GET', `/jobs/${saved.id}`));
    const job = await publicJob(saved.slug);

    // Assert
    expect(reread).toMatchObject({ level: 'Nhân viên', openings: 2, workMode: 'hybrid' });
    expect(job).toMatchObject({ level: 'Nhân viên', openings: 2, workMode: 'hybrid' });
  });

  it('should leave them empty for a form from an older page', async () => {
    const saved = await saveNew();

    expect(saved).toMatchObject({ level: null, openings: null, workMode: null });
  });

  it('should refuse more than 100 people or an unknown work mode', async () => {
    const res = await hr('POST', '/jobs', jobInput({ openings: 101, workMode: 'field' as 'remote' }));

    expect(res.status).toBe(422);
    const { fieldErrors } = await json<{ fieldErrors: Record<string, string> }>(res);
    expect(Object.keys(fieldErrors).sort()).toEqual(['openings', 'workMode']);
  });

  it('should tell Google about the openings and a remote job in the crawler page', async () => {
    await insertJob(t, { slug: 'tu-xa', openings: 3, workMode: 'remote', level: 'Trưởng nhóm' });

    const html = await (await t.request('/share/jobs/tu-xa')).text();

    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? '';
    expect(JSON.parse(ld)).toMatchObject({ totalJobOpenings: 3, jobLocationType: 'TELECOMMUTE' });
    expect(html).toContain('<dt>Số lượng tuyển</dt><dd>3 người</dd>');
    expect(html).toContain('<dt>Hình thức làm việc</dt><dd>Từ xa (Remote)</dd>');
    expect(html).toContain('<dt>Cấp bậc</dt><dd>Trưởng nhóm</dd>');
  });
});

describe('grouped duties on the public job', () => {
  const GROUPED = [
    '1. Quản lý đơn hàng',
    '• Theo dõi lịch tàu',
    '• Cập nhật trạng thái',
    '2. Thủ tục hải quan',
    '• Khai báo tờ khai',
  ].join('\n');

  it('should send the headings in sections and only the items in the flat list', async () => {
    // Arrange
    await insertJob(t, { slug: 'chung-tu', responsibilities: GROUPED });

    // Act
    const job = await publicJob('chung-tu');

    // Assert
    expect(job.responsibilities).toEqual(['Theo dõi lịch tàu', 'Cập nhật trạng thái', 'Khai báo tờ khai']);
    expect(job.sections.responsibilities).toEqual([
      { title: '1. Quản lý đơn hàng', items: ['Theo dõi lịch tàu', 'Cập nhật trạng thái'] },
      { title: '2. Thủ tục hải quan', items: ['Khai báo tờ khai'] },
    ]);
  });

  it('should keep a job without bullets as one untitled list', async () => {
    await insertJob(t, { slug: 'cu', responsibilities: 'Làm việc A\nLàm việc B' });

    const job = await publicJob('cu');

    expect(job.responsibilities).toEqual(['Làm việc A', 'Làm việc B']);
    expect(job.sections.responsibilities).toEqual([{ title: null, items: ['Làm việc A', 'Làm việc B'] }]);
  });

  it('should show crawlers the headings above their duties', async () => {
    await insertJob(t, { slug: 'chung-tu', responsibilities: GROUPED });

    const html = await (await t.request('/share/jobs/chung-tu')).text();

    expect(html).toContain(
      '<h3>1. Quản lý đơn hàng</h3><ul><li>Theo dõi lịch tàu</li><li>Cập nhật trạng thái</li></ul>' +
        '<h3>2. Thủ tục hải quan</h3><ul><li>Khai báo tờ khai</li></ul>',
    );
  });
});

describe('"Cấp bậc" choices', () => {
  it('should offer the built-in levels plus levels used on earlier jobs', async () => {
    await insertJob(t, { level: 'Chuyên viên' });

    const body = await json<JobTemplateResponse>(await hr('GET', '/jobs/template'));

    expect(body.template.levels).toEqual(LEVEL_OPTIONS);
    expect(body.levels).toEqual([...LEVEL_OPTIONS, 'Chuyên viên']);
  });

  it('should keep a level HR adds from the job form for next time', async () => {
    const res = await hr('POST', '/jobs/template/choices', { list: 'levels', value: 'Phó Giám đốc' });

    expect(res.status).toBe(200);
    expect((await json<JobTemplateResponse>(res)).template.levels).toEqual([...LEVEL_OPTIONS, 'Phó Giám đốc']);
  });
});
