import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { cvChanges, cvScores } from '../../../db/schema.js';
import { pdfFile } from '../../fakes.js';
import { json } from '../../fixtures.js';
import {
  add,
  addedId,
  addWithout,
  detail,
  errorsOf,
  hrSend,
  list,
  postForm,
  realPdf,
  replace,
  row,
  score,
  useFlow,
} from './helpers.js';

/** Requirements the fixture PDF can answer, so a real percent is possible. */
const flow = useFlow({ requirements: 'Biết Excel\nTOEIC 700\nCó bằng lái xe' });
const LINK = 'https://drive.google.com/file/d/1AbCdEf/view?usp=sharing';

const scoreRow = async (id: string) => flow.t.db.query.cvScores.findFirst({ where: eq(cvScores.applicationId, id) });

describe('A link is not scanned', () => {
  it('should still ask for the name and phone: nothing is read from the link', async () => {
    // Act
    const res = await addWithout(flow, ['fullName', 'phone'], { cvLink: LINK });

    // Assert
    expect(res.status).toBe(422);
    const errors = await errorsOf(res);
    expect(Object.keys(errors).sort()).toEqual(['fullName', 'phone']);
    expect(flow.network()).toEqual([]);
  });

  it('should refuse to read the contact details from a link given to parse-cv', async () => {
    // Act
    const res = await postForm(flow, { cvLink: LINK }, undefined, '/api/hr/applications/parse-cv');

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).cv).toBe('Chọn file CV (PDF).');
    expect(flow.network()).toEqual([]);
  });

  it('should store nothing about the CV content at save time', async () => {
    // Act
    const id = await addedId(await add(flow, { cvLink: LINK }));

    // Assert
    expect(await scoreRow(id)).toBeUndefined();
    expect((await list(flow)).applications[0].matchPercent).toBeNull();
  });

  it('should leave a link out of the background scorer, without contacting it', async () => {
    // Arrange
    await addedId(await add(flow, { cvLink: LINK }));

    // Act
    const res = await hrSend(flow, 'POST', '/applications/score-pending');

    // Assert
    expect(await json<{ scored: number; remaining: number }>(res)).toEqual({ scored: 0, remaining: 0 });
    expect(flow.network()).toEqual([]);
  });

  it('should not serve a file for a link, so HR is not sent anywhere by the API', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));

    // Act
    const res = await hrSend(flow, 'GET', `/applications/${id}/cv`);

    // Assert
    expect(res.status).toBe(404);
    expect(res.headers.get('location')).toBeNull();
    expect(flow.network()).toEqual([]);
  });
});

describe('The match percent of a link', () => {
  it('should be unknown, never 0%, after pressing "Chấm CV"', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));

    // Act
    const app = await score(flow, id);

    // Assert
    expect(app.cvScore?.percent).toBeNull();
    expect(flow.network()).toEqual([]);
  });

  it('should say plainly that the link was not read', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));

    // Act
    const app = await score(flow, id);

    // Assert
    expect(app.cvScore?.note).toBe('CV là link, không đọc được tự động: HR mở link để xem.');
  });

  it('should mark every requirement "unknown", none as not met', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));

    // Act
    const app = await score(flow, id);

    // Assert
    const verdicts = (app.cvScore?.items ?? []).map((item) => item.verdict);
    expect(verdicts).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('should keep the list percent empty rather than 0 after scoring', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));
    await score(flow, id);

    // Act
    const { applications } = await list(flow);

    // Assert
    expect(applications.find((a) => a.id === id)?.matchPercent).toBeNull();
  });

  it('should give the same honest answer when scored twice', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));
    await score(flow, id);

    // Act
    const app = await score(flow, id);

    // Assert
    expect(app.cvScore?.percent).toBeNull();
    expect(app.cvScore?.note).toContain('CV là link');
  });

  it('should say there is no CV, not "link", when HR gave neither', async () => {
    // Arrange
    const id = await addedId(await add(flow));

    // Act
    const app = await score(flow, id);

    // Assert
    expect(app.cvScore?.percent).toBeNull();
    expect(app.cvScore?.note).toBe('Hồ sơ không có CV.');
  });

  it('should give a real percent for a PDF with text, as the control case', async () => {
    // Arrange
    const id = await addedId(await add(flow, {}, realPdf('cv-simple-vi.pdf')));

    // Act
    const app = await score(flow, id);

    // Assert
    expect(typeof app.cvScore?.percent).toBe('number');
    expect(app.cvScore?.note).toBeNull();
  });

  it('should be unknown for a scanned PDF too, and say why', async () => {
    // Arrange
    const id = await addedId(await add(flow, {}, realPdf('cv-scanned-image.pdf')));

    // Act
    const app = await score(flow, id);

    // Assert
    expect(app.cvScore?.percent).toBeNull();
    expect(app.cvScore?.note).toBe('CV là ảnh scan hoặc không có chữ, HR xem trực tiếp.');
  });
});

describe('PDF and link together', () => {
  it('should keep the file and drop the link', async () => {
    // Act
    const id = await addedId(await add(flow, { cvLink: LINK }, pdfFile('CV Khoa.pdf')));

    // Assert
    const app = await detail(flow, id);
    expect(app.cvFileName).toBe('CV Khoa.pdf');
    expect(app.cvLink).toBeNull();
    expect((await row(flow, id))?.cvPathname).toBeTruthy();
  });

  it('should score the file, not fall back to the link note', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }, realPdf('cv-simple-vi.pdf')));

    // Act
    const app = await score(flow, id);

    // Assert
    expect(typeof app.cvScore?.percent).toBe('number');
    expect(flow.network()).toEqual([]);
  });

  it('should still validate the link given next to a file', async () => {
    // Act
    const res = await add(flow, { cvLink: 'javascript:alert(1)' }, pdfFile());

    // Assert
    expect(res.status).toBe(422);
    expect(flow.t.cvStore.files.size).toBe(0);
  });

  it('should take the file when a replacement sends both', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: 'https://example.com/cu.pdf' }));

    // Act
    const res = await replace(flow, id, { cvLink: LINK }, pdfFile('Moi.pdf'));

    // Assert
    expect(res.status).toBe(200);
    const app = await detail(flow, id);
    expect(app.cvFileName).toBe('Moi.pdf');
    expect(app.cvLink).toBeNull();
  });
});

describe('Replacing a CV', () => {
  it('should turn a link into a file, record the old link and score the file', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));
    await score(flow, id);

    // Act
    await replace(flow, id, {}, realPdf('cv-simple-vi.pdf'));

    // Assert
    const app = await detail(flow, id);
    expect(app.cvLink).toBeNull();
    expect(app.cvHistory[0]).toMatchObject({ previous: LINK, by: 'Phòng Nhân sự' });
    expect(app.cvScore).toBeNull();
    expect(typeof (await score(flow, id)).cvScore?.percent).toBe('number');
  });

  it('should turn a file into a link, delete the old file and drop its percent', async () => {
    // Arrange
    const id = await addedId(await add(flow, {}, realPdf('cv-simple-vi.pdf')));
    await score(flow, id);
    const oldPath = (await row(flow, id))?.cvPathname ?? '';

    // Act
    const res = await replace(flow, id, { cvLink: LINK });

    // Assert
    expect(res.status).toBe(200);
    expect(flow.t.cvStore.files.has(oldPath)).toBe(false);
    const { applications } = await list(flow);
    expect(applications.find((a) => a.id === id)?.matchPercent).toBeNull();
    expect((await detail(flow, id)).cvHistory[0].previous).toBe('cv-simple-vi.pdf');
  });

  it('should not carry the old percent over to the new link when scored again', async () => {
    // Arrange
    const id = await addedId(await add(flow, {}, realPdf('cv-simple-vi.pdf')));
    await score(flow, id);
    await replace(flow, id, { cvLink: LINK });

    // Act
    const app = await score(flow, id);

    // Assert
    expect(app.cvScore?.percent).toBeNull();
    expect(app.cvScore?.note).toContain('CV là link');
  });

  it('should note each change when one link replaces another', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: 'https://example.com/lan-1.pdf' }));

    // Act
    await replace(flow, id, { cvLink: 'https://example.com/lan-2.pdf' });
    await replace(flow, id, { cvLink: 'https://example.com/lan-3.pdf' });

    // Assert
    const changes = await flow.t.db.select().from(cvChanges).where(eq(cvChanges.applicationId, id));
    expect(changes.map((c) => c.previous).sort()).toEqual([
      'https://example.com/lan-1.pdf',
      'https://example.com/lan-2.pdf',
    ]);
    expect((await detail(flow, id)).cvLink).toBe('https://example.com/lan-3.pdf');
  });

  it('should refuse an empty replacement and keep the old CV', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));

    // Act
    const res = await replace(flow, id, { cvLink: '' });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).cv).toBeTruthy();
    expect((await detail(flow, id)).cvLink).toBe(LINK);
  });

  it('should answer not found for an application that does not exist', async () => {
    // Act
    const res = await replace(flow, '11111111-1111-4111-8111-111111111111', { cvLink: LINK });

    // Assert
    expect(res.status).toBe(404);
  });
});

describe('What the reviewer sees for a link', () => {
  it('should show the link and no percent on the reviewer page', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));
    const batchRes = await hrSend(flow, 'POST', '/reviews', {
      title: 'Duyệt ứng viên',
      senderName: 'Phòng Nhân sự',
      reviewerName: 'anh Minh',
      message: 'Anh xem giúp em.',
      respondBy: '2026-10-22T10:00:00.000Z',
      items: [{ applicationId: id, hrPick: 'yes', hrComment: 'Được' }],
    });
    const { token } = await json<{ token: string }>(batchRes);

    // Act
    const page = await flow.t.send('GET', `/api/review/${token}`);

    // Assert
    const { items } = await json<{ items: { cv: string; cvLink: string; matchPercent: number | null }[] }>(page);
    expect(items[0]).toMatchObject({ cv: 'link', cvLink: LINK, matchPercent: null });
  });
});
