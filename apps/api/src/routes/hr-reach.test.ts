import type { RecruitmentLogPageDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, type Job } from '../db/schema.js';
import { insertJob, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

/** "Gọi" and "Zalo" only open the phone's apps; pressing them is written to the log (spec-nhat-ky-ho-so.md, Liên hệ). */

let t: TestContext;
let cookie: string;
let job: Job;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
  job = await insertJob(t);
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });

async function application() {
  const [row] = await t.db
    .insert(applications)
    .values({ jobId: job.id, fullName: 'Ứng viên Thử', phone: '0912000555', consentAt: t.clock.now, policyVersion: 'v' })
    .returning();
  if (!row) throw new Error('No application');
  return row;
}

describe('pressing Gọi or Zalo', () => {
  it('TC-LH-01: should log a call and a Zalo message under "Liên hệ", with who pressed it', async () => {
    // Arrange
    const app = await application();

    // Act
    const call = await hr('POST', `/applications/${app.id}/reach`, { via: 'call' });
    const zalo = await hr('POST', `/applications/${app.id}/reach`, { via: 'zalo' });
    const log = await json<RecruitmentLogPageDto>(await hr('GET', '/recruitment-log?nhom=lien-he'));

    // Assert
    expect([call.status, zalo.status]).toEqual([204, 204]);
    expect(log.lines.map((l) => [l.action, l.candidateName, l.detail]).sort()).toEqual([
      ['Gọi điện', 'Ứng viên Thử', '0912000555'],
      ['Nhắn Zalo', 'Ứng viên Thử', '0912000555'],
    ]);
  });

  it('TC-LH-02: should refuse another way of reaching, and an application that is not there', async () => {
    // Arrange
    const app = await application();

    // Act
    const wrong = await hr('POST', `/applications/${app.id}/reach`, { via: 'fax' });
    const missing = await hr('POST', '/applications/00000000-0000-0000-0000-000000000000/reach', { via: 'call' });

    // Assert
    expect([wrong.status, missing.status]).toEqual([422, 404]);
  });
});
