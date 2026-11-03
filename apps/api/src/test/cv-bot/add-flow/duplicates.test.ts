import type { ApplicationDetailDto, DuplicateApplicationDto } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { applications } from '../../../db/schema.js';
import type { CvStore } from '../../../lib/cv-store.js';
import { pdfFile } from '../../fakes.js';
import { insertJob, json } from '../../fixtures.js';
import { add, addedId, detail, form, hrSend, list, PHONE, replace, row, rows, useFlow, type Flow } from './helpers.js';

const flow = useFlow();

const fromWebsite = (f: Flow, over: Record<string, string> = {}, file = pdfFile('CV web.pdf')) =>
  f.t.request('/api/applications', {
    method: 'POST',
    body: form(
      {
        jobId: f.job.id,
        fullName: 'Trần Minh Khoa',
        phone: PHONE,
        email: 'khoa.tran@example.com',
        consent: 'true',
        formOpenedAt: String(f.t.clock.now.getTime() - 60_000),
        ...over,
      },
      file,
    ),
    headers: { 'x-requested-with': 'careers-web' },
  });

const later = (f: Flow, minutes: number) => {
  f.t.clock.now = new Date(f.t.clock.now.getTime() + minutes * 60_000);
};

/** Vercel Blob takes a moment: two uploads wait for each other here, so both requests are mid-flight together. */
function uploadsThatOverlap(inner: CvStore): CvStore {
  let started = 0;
  let release: () => void = () => undefined;
  const bothStarted = new Promise<void>((resolve) => {
    release = resolve;
  });
  const giveUp = new Promise<void>((resolve) => setTimeout(resolve, 3_000));
  return {
    put: async (folder, file) => {
      started += 1;
      if (started === 2) release();
      await Promise.race([bothStarted, giveUp]);
      return inner.put(folder, file);
    },
    get: (pathname) => inner.get(pathname),
    delete: (pathnames) => inner.delete(pathnames),
  };
}

const duplicateOf = async (res: Response) => json<{ code: string; existing: DuplicateApplicationDto }>(res);

describe('The same phone for the same job', () => {
  it('should answer 409 pointing at the existing profile, without touching it', async () => {
    // Arrange
    const firstId = await addedId(await add(flow, { note: 'Ghi chú đầu tiên' }));

    // Act
    const res = await add(flow, { fullName: 'Người Khác', email: 'nguoi.khac@example.com', note: 'Ghi đè?' });

    // Assert
    expect(res.status).toBe(409);
    const body = await duplicateOf(res);
    expect(body.code).toBe('duplicate');
    expect(body.existing).toMatchObject({ id: firstId, fullName: 'Trần Minh Khoa', status: 'seen' });
    expect(await detail(flow, firstId)).toMatchObject({
      fullName: 'Trần Minh Khoa',
      email: 'khoa.tran@example.com',
      note: 'Ghi chú đầu tiên',
    });
    expect(await rows(flow)).toHaveLength(1);
  });

  it.each(['0912 345 678', '+84 912 345 678', '84912345678', '0912.345.678'])(
    'should see the same number written %s',
    async (phone) => {
      // Arrange
      await addedId(await add(flow));

      // Act
      const res = await add(flow, { phone });

      // Assert
      expect(res.status).toBe(409);
    },
  );

  it('should store no file for the refused duplicate', async () => {
    // Arrange
    await addedId(await add(flow, {}, pdfFile('Lan 1.pdf')));

    // Act
    const res = await add(flow, {}, pdfFile('Lan 2.pdf'));

    // Assert
    expect(res.status).toBe(409);
    expect(flow.t.cvStore.files.size).toBe(1);
  });

  it('should let HR add the link to the existing profile through "Cập nhật CV"', async () => {
    // Arrange
    const firstId = await addedId(await add(flow, {}, pdfFile('Cu.pdf')));
    const { existing } = await duplicateOf(await add(flow, { cvLink: 'https://example.com/moi.pdf' }));

    // Act
    const res = await replace(flow, existing.id, { cvLink: 'https://example.com/moi.pdf' });

    // Assert
    expect(res.status).toBe(200);
    const app = await json<ApplicationDetailDto>(res);
    expect(app).toMatchObject({ id: firstId, cvLink: 'https://example.com/moi.pdf', cvFileName: null });
    expect(flow.t.cvStore.files.size).toBe(0);
  });

  it('should create exactly one profile when the same form is sent twice during a slow upload', async () => {
    // Arrange
    flow.t.deps.cvStore = uploadsThatOverlap(flow.t.cvStore);

    // Act
    const replies = await Promise.all([add(flow, {}, pdfFile('Lan 1.pdf')), add(flow, {}, pdfFile('Lan 2.pdf'))]);

    // Assert
    expect(replies.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await rows(flow)).toHaveLength(1);
  });

  it('should leave no orphan file when the overlapping form is refused', async () => {
    // Arrange
    flow.t.deps.cvStore = uploadsThatOverlap(flow.t.cvStore);

    // Act
    await Promise.all([add(flow, {}, pdfFile('Lan 1.pdf')), add(flow, {}, pdfFile('Lan 2.pdf'))]);

    // Assert
    const [saved] = await rows(flow);
    expect([...flow.t.cvStore.files.keys()]).toEqual([saved.cvPathname]);
  });

  it('should upload outside the lock, so one slow upload does not hold up the other form', async () => {
    // Arrange
    const inner = flow.t.cvStore;
    let uploading = 0;
    let most = 0;
    flow.t.deps.cvStore = {
      put: async (folder, file) => {
        uploading += 1;
        most = Math.max(most, uploading);
        await new Promise((resolve) => setTimeout(resolve, 50));
        uploading -= 1;
        return inner.put(folder, file);
      },
      get: (pathname) => inner.get(pathname),
      delete: (pathnames) => inner.delete(pathnames),
    };

    // Act
    await Promise.all([add(flow, {}, pdfFile('Lan 1.pdf')), add(flow, {}, pdfFile('Lan 2.pdf'))]);

    // Assert
    expect(most).toBe(2);
  });

  it('should also refuse a second form while the website form of this phone is being saved', async () => {
    // Arrange
    expect((await fromWebsite(flow)).status).toBe(200);
    flow.t.deps.cvStore = uploadsThatOverlap(flow.t.cvStore);

    // Act
    const res = await add(flow, {}, pdfFile('Lan 1.pdf'));

    // Assert
    expect(res.status).toBe(409);
    expect(flow.t.cvStore.files.size).toBe(1);
  });

  it('should be free again after the first profile is deleted', async () => {
    // Arrange
    const firstId = await addedId(await add(flow));
    await hrSend(flow, 'DELETE', `/applications/${firstId}`);

    // Act
    const res = await add(flow);

    // Assert
    expect(res.status).toBe(201);
  });
});

describe('The same phone for another job', () => {
  it('should create a separate profile and link the two for HR', async () => {
    // Arrange
    const firstId = await addedId(await add(flow));
    const other = await insertJob(flow.t, { title: 'Kế toán' });

    // Act
    const secondId = await addedId(await add(flow, { jobId: other.id }));

    // Assert
    expect(secondId).not.toBe(firstId);
    const second = await detail(flow, secondId);
    expect(second.otherApplications).toEqual([expect.objectContaining({ id: firstId })]);
    expect(await rows(flow)).toHaveLength(2);
  });
});

describe('The same email with another phone', () => {
  it('should not merge them: both profiles keep their own phone', async () => {
    // Arrange
    const firstId = await addedId(await add(flow));

    // Act
    const secondId = await addedId(await add(flow, { phone: '0987654321' }));

    // Assert
    expect(secondId).not.toBe(firstId);
    expect((await detail(flow, firstId)).phone).toBe(PHONE);
    expect((await detail(flow, secondId)).phone).toBe('0987654321');
  });

  it('should allow it without any warning, because only the phone is compared', async () => {
    // Arrange
    await addedId(await add(flow));

    // Act
    const res = await add(flow, { phone: '0987654321', email: 'KHOA.TRAN@example.com' });

    // Assert
    expect(res.status).toBe(201);
    expect(await json<Record<string, unknown>>(res)).toEqual({ id: expect.any(String) });
  });

  it('should not list the first profile as another application of the second', async () => {
    // Arrange
    await addedId(await add(flow));

    // Act
    const secondId = await addedId(await add(flow, { phone: '0987654321' }));

    // Assert
    expect((await detail(flow, secondId)).otherApplications).toEqual([]);
  });
});

describe('The same candidate applying twice', () => {
  it('should stop HR when the candidate already applied on the website', async () => {
    // Arrange
    expect((await fromWebsite(flow)).status).toBe(200);

    // Act
    const res = await add(flow, { fullName: 'Khoa' });

    // Assert
    expect(res.status).toBe(409);
    expect((await duplicateOf(res)).existing).toMatchObject({ fullName: 'Trần Minh Khoa', status: 'new' });
  });

  it('should not change the HR profile when the candidate then applies on the website', async () => {
    // Arrange
    const hrId = await addedId(await add(flow, { note: 'HR ghi' }, pdfFile('HR gui.pdf')));
    later(flow, 30);

    // Act
    const res = await fromWebsite(flow);

    // Assert
    expect(res.status).toBe(200);
    expect(await detail(flow, hrId)).toMatchObject({ note: 'HR ghi', cvFileName: 'HR gui.pdf', source: 'zalo' });
    expect(await rows(flow)).toHaveLength(2);
  });

  it('should keep the CV the candidate sends right after HR added them', async () => {
    // Arrange
    await addedId(await add(flow));

    // Act
    const res = await fromWebsite(flow, {}, pdfFile('CV ung vien gui.pdf'));

    // Assert
    expect(res.status).toBe(200);
    const stored = await rows(flow);
    expect(stored.map((a) => a.cvFileName)).toContain('CV ung vien gui.pdf');
  });

  it('should still treat a double click on the website as one form after HR added them', async () => {
    // Arrange
    await addedId(await add(flow));

    // Act
    const first = await fromWebsite(flow, {}, pdfFile('Lan 1.pdf'));
    const second = await fromWebsite(flow, {}, pdfFile('Lan 2.pdf'));

    // Assert
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await rows(flow)).toHaveLength(2);
    expect(flow.t.cvStore.files.size).toBe(1);
  });

  it('should point HR at the newest profile when several exist for this phone and job', async () => {
    // Arrange
    await fromWebsite(flow, { fullName: 'Lần Đầu' });
    later(flow, 30);
    await fromWebsite(flow, { fullName: 'Lần Sau' });

    // Act
    const res = await add(flow);

    // Assert
    expect(res.status).toBe(409);
    expect((await duplicateOf(res)).existing.fullName).toBe('Lần Sau');
  });
});

describe('Correcting the contact of a profile HR added', () => {
  it('should refuse a phone already used for the same job', async () => {
    // Arrange
    await addedId(await add(flow));
    const secondId = await addedId(await add(flow, { phone: '0987654321' }));

    // Act
    const res = await hrSend(flow, 'PATCH', `/applications/${secondId}/contact`, { phone: PHONE, source: 'email' });

    // Assert
    expect(res.status).toBe(409);
    expect((await duplicateOf(res)).code).toBe('duplicate');
    expect((await detail(flow, secondId)).phone).toBe('0987654321');
  });

  it('should allow keeping the same phone while changing the source', async () => {
    // Arrange
    const id = await addedId(await add(flow));

    // Act
    const res = await hrSend(flow, 'PATCH', `/applications/${id}/contact`, { phone: PHONE, source: 'email' });

    // Assert
    expect(res.status).toBe(200);
    expect((await detail(flow, id)).source).toBe('email');
  });

  it('should refuse to change a profile the candidate sent', async () => {
    // Arrange
    await fromWebsite(flow);
    const [own] = await flow.t.db.select().from(applications).where(eq(applications.phone, PHONE));

    // Act
    const res = await hrSend(flow, 'PATCH', `/applications/${own.id}/contact`, {
      phone: '0987654321',
      source: 'email',
    });

    // Assert
    expect(res.status).toBe(409);
    expect((await row(flow, own.id))?.phone).toBe(PHONE);
  });

  it('should show each profile once in the list', async () => {
    // Arrange
    await addedId(await add(flow));
    await addedId(await add(flow, { phone: '0987654321' }));

    // Act
    const { applications: found, counts } = await list(flow);

    // Assert
    expect(found).toHaveLength(2);
    expect(counts.seen).toBe(2);
  });
});
