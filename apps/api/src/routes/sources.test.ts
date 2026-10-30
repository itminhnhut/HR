import type { ApplicationDetailDto, ApplicationsResponse, DashboardDto, SourceDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Job } from '../db/schema.js';
import { insertJob, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let cookie: string;
let job: Job;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
  job = await insertJob(t, { title: 'Kế toán' });
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });
const sources = async () => json<SourceDto[]>(await hr('GET', '/sources'));
const addSource = (name: string) => hr('POST', '/sources', { name });

let n = 0;
async function addApplication(source: string) {
  n += 1;
  const form = new FormData();
  const fields = {
    jobId: job.id,
    fullName: `Ứng viên ${n}`,
    phone: `09140000${String(n).padStart(2, '0')}`,
    source,
    consent: 'true',
  };
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return t.request('/api/hr/applications', {
    method: 'POST',
    body: form,
    headers: { cookie, 'x-requested-with': 'careers-web' },
  });
}

describe('HR adds a source', () => {
  it('should add it to the list for every HR, with a key made from its name', async () => {
    // Act
    const res = await addSource('Hội chợ việc làm ĐH Bách Khoa');

    // Assert
    expect(res.status).toBe(201);
    expect(await json<SourceDto>(res)).toMatchObject({
      key: 'hoi-cho-viec-lam-dh-bach-khoa',
      kind: 'custom',
      hidden: false,
    });
    expect((await sources()).map((s) => s.name)).toContain('Hội chợ việc làm ĐH Bách Khoa');
  });

  it('should refuse a name that already exists, whatever the case or tones', async () => {
    await addSource('LinkedIn');
    const twin = await addSource('LÍNKEDIN');
    expect(twin.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(twin)).fieldErrors.name).toBe('Đã có nguồn LinkedIn.');
    expect((await addSource('zalo')).status).toBe(422);
  });

  it('should stop at 50 sources', async () => {
    for (let i = (await sources()).length; i < 50; i += 1) expect((await addSource(`Nguồn số ${i}`)).status).toBe(201);
    expect((await addSource('Một nguồn nữa')).status).toBe(422);
  });
});

describe('HR uses sources on applications', () => {
  it('should take a new source, count it on the dashboard and filter by it', async () => {
    // Arrange
    const { key } = await json<SourceDto>(await addSource('LinkedIn'));

    // Act
    const res = await addApplication(key);

    // Assert
    expect(res.status).toBe(201);
    const list = await json<ApplicationsResponse>(await hr('GET', `/applications?source=${key}`));
    expect(list.applications.map((a) => a.source)).toEqual([key]);
    const dash = await json<DashboardDto>(await hr('GET', '/dashboard'));
    expect(dash.bySource).toContainEqual({ source: key, count: 1 });
  });

  it('should refuse "Website", an unknown source and a hidden one for a new application', async () => {
    await hr('PATCH', '/sources/topcv', { hidden: true });
    expect((await addApplication('website')).status).toBe(422);
    expect((await addApplication('khong-co')).status).toBe(422);
    expect((await addApplication('topcv')).status).toBe(422);
  });

  it('should let an older application keep a source hidden since', async () => {
    // Arrange
    const { id } = await json<{ id: string }>(await addApplication('topcv'));
    await hr('PATCH', '/sources/topcv', { hidden: true });

    // Act
    const res = await hr('PATCH', `/applications/${id}/contact`, { phone: '0914999999', source: 'topcv' });

    // Assert
    expect(res.status).toBe(200);
    expect((await json<ApplicationDetailDto>(res)).source).toBe('topcv');
  });
});

describe('HR manages sources', () => {
  it('should rename a source without moving its applications', async () => {
    // Arrange
    await addApplication('zalo');

    // Act
    const list = await json<SourceDto[]>(await hr('PATCH', '/sources/zalo', { name: 'Zalo cá nhân' }));

    // Assert
    expect(list.find((s) => s.key === 'zalo')).toMatchObject({ name: 'Zalo cá nhân', applications: 1 });
  });

  it('should hide and show a source again', async () => {
    await hr('PATCH', '/sources/facebook', { hidden: true });
    expect((await sources()).find((s) => s.key === 'facebook')?.hidden).toBe(true);
    await hr('PATCH', '/sources/facebook', { hidden: false });
    expect((await sources()).find((s) => s.key === 'facebook')?.hidden).toBe(false);
  });

  it('should never change "Website" nor hide "Khác"', async () => {
    expect((await hr('PATCH', '/sources/website', { name: 'Web' })).status).toBe(409);
    expect((await hr('PATCH', '/sources/other', { hidden: true })).status).toBe(409);
  });

  it('should delete only a source HR added that no application uses', async () => {
    // Arrange
    const { key: unused } = await json<SourceDto>(await addSource('Nhóm Zalo kế toán'));
    const { key: used } = await json<SourceDto>(await addSource('LinkedIn'));
    await addApplication(used);

    // Act / Assert
    expect((await hr('DELETE', `/sources/${unused}`)).status).toBe(200);
    expect((await hr('DELETE', `/sources/${used}`)).status).toBe(409);
    expect((await hr('DELETE', '/sources/email')).status).toBe(409);
    expect((await sources()).map((s) => s.key)).not.toContain(unused);
  });

  it('should need an HR session', async () => {
    expect((await t.send('GET', '/api/hr/sources')).status).toBe(401);
  });
});
