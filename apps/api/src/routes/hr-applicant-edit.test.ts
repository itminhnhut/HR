import type { ApplicationDetailDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, type Job } from '../db/schema.js';
import { insertJob, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

/** HR fixes the name, phone, email and gender of any application, each change logged (spec-sua-ho-so.md). */

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

/** One the candidate sent on the website. */
async function sentByCandidate(over: Partial<typeof applications.$inferInsert> = {}) {
  const [row] = await t.db
    .insert(applications)
    .values({ jobId: job.id, fullName: 'Nguyen Van An', phone: '0987654321', email: 'an@mail.vn', consentAt: t.clock.now, policyVersion: 'v', ...over })
    .returning();
  if (!row) throw new Error('No application');
  return row;
}

const edit = async (id: string, body: unknown) => {
  const res = await hr('PATCH', `/applications/${id}/contact`, body);
  return { status: res.status, body: (await res.json()) as ApplicationDetailDto & { code?: string; fieldErrors?: Record<string, string> } };
};
const changes = (app: ApplicationDetailDto) => app.activity.filter((a) => a.kind === 'contact').map((a) => [a.detail, a.from, a.to]);

describe('fixing what an application says', () => {
  it('TC-SH-01: should fix the name and phone of one the candidate sent, logging old and new', async () => {
    // Arrange
    const app = await sentByCandidate();

    // Act
    const answer = await edit(app.id, { fullName: 'Nguyễn Văn An', phone: '0912 000 333', email: 'an@mail.vn' });

    // Assert
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ fullName: 'Nguyễn Văn An', phone: '0912000333' });
    expect(changes(answer.body)).toEqual(expect.arrayContaining([['fullName', 'Nguyen Van An', 'Nguyễn Văn An'], ['phone', '0987654321', '0912000333']]));
    expect(changes(answer.body)).toHaveLength(2);
  });

  it('TC-SH-02: should refuse a phone another application for the same job already has', async () => {
    // Arrange
    await sentByCandidate({ phone: '0912000444', fullName: 'Người khác' });
    const app = await sentByCandidate();

    // Act
    const answer = await edit(app.id, { fullName: 'Nguyen Van An', phone: '0912000444', email: 'an@mail.vn' });

    // Assert
    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('duplicate');
  });

  it('TC-SH-03: should keep HR\'s gender over the CV\'s, and go back to the CV\'s when HR clears it', async () => {
    // Arrange
    const app = await sentByCandidate();

    // Act
    const set = await edit(app.id, { fullName: 'Nguyen Van An', phone: '0987654321', email: 'an@mail.vn', gender: 'female' });
    const cleared = await edit(app.id, { fullName: 'Nguyen Van An', phone: '0987654321', email: 'an@mail.vn', gender: null });

    // Assert
    expect(set.body.hrGender).toBe('female');
    expect(cleared.body.hrGender).toBeNull();
    expect(changes(cleared.body)).toEqual(expect.arrayContaining([['gender', null, 'female'], ['gender', 'female', null]]));
  });

  it('TC-SH-04: should not change the source of one the candidate sent', async () => {
    // Arrange
    const app = await sentByCandidate();

    // Act
    const answer = await edit(app.id, { fullName: 'Nguyen Van An', phone: '0987654321', email: 'an@mail.vn', source: 'zalo' });

    // Assert
    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('candidate_sent');
  });

  it('TC-SH-05: should log nothing when nothing changed', async () => {
    // Arrange
    const app = await sentByCandidate();

    // Act
    const answer = await edit(app.id, { fullName: 'Nguyen Van An', phone: '0987654321', email: 'an@mail.vn' });

    // Assert
    expect(changes(answer.body)).toEqual([]);
  });

  it('TC-SH-06: should say which field is wrong', async () => {
    // Arrange
    const app = await sentByCandidate();

    // Act
    const answer = await edit(app.id, { fullName: '  ', phone: '0987654321', email: 'khong-phai-email' });

    // Assert
    expect(answer.status).toBe(422);
    expect(Object.keys(answer.body.fieldErrors ?? {}).sort()).toEqual(['email', 'fullName']);
  });
});
