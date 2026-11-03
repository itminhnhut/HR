import { CV_MAX_BYTES, type ParsedCvDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import type { CvStore } from '../../../lib/cv-store.js';
import { googleToken, pdfFile } from '../../fakes.js';
import { cookiesFrom, json } from '../../fixtures.js';
import {
  add,
  addedId,
  detail,
  errorsOf,
  form,
  postForm,
  realPdf,
  replace,
  row,
  rows,
  useFlow,
  validFields,
} from './helpers.js';

const flow = useFlow();
const LINK = 'https://example.com/cv.pdf';

const ADD_PATH = '/api/hr/applications';
const PARSE_PATH = '/api/hr/applications/parse-cv';

const pdfOfSize = (bytes: number, name = 'CV.pdf') =>
  new File(
    [new TextEncoder().encode('%PDF-1.7\n'), new Uint8Array(bytes - 16), new TextEncoder().encode('\n%%EOF\n')],
    name,
    {
      type: 'application/pdf',
    },
  );

describe('Not logged in', () => {
  const noCookie = (path: string, body: FormData, method = 'POST') =>
    flow.t.request(path, { method, body, headers: { 'x-requested-with': 'careers-web' } });

  it('should refuse "Thêm hồ sơ" and store nothing', async () => {
    // Act
    const res = await noCookie(ADD_PATH, form(validFields(flow, { cvLink: LINK }), pdfFile()));

    // Assert
    expect(res.status).toBe(401);
    expect(await rows(flow)).toEqual([]);
    expect(flow.t.cvStore.files.size).toBe(0);
  });

  it('should refuse reading a CV', async () => {
    // Act
    const res = await noCookie(PARSE_PATH, form({}, pdfFile()));

    // Assert
    expect(res.status).toBe(401);
  });

  it('should refuse replacing a CV and keep the old one', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));

    // Act
    const res = await noCookie(`${ADD_PATH}/${id}/cv`, form({ cvLink: 'https://example.com/khac.pdf' }), 'PUT');

    // Assert
    expect(res.status).toBe(401);
    expect((await detail(flow, id)).cvLink).toBe(LINK);
  });

  it('should refuse showing the stored link', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));

    // Act
    const res = await flow.t.request(`${ADD_PATH}/${id}`);

    // Assert
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain(LINK);
  });

  it('should refuse a made-up session cookie', async () => {
    // Act
    const res = await flow.t.request(ADD_PATH, {
      method: 'POST',
      body: form(validFields(flow)),
      headers: { cookie: 'hr_session=gia-mao', 'x-requested-with': 'careers-web' },
    });

    // Assert
    expect(res.status).toBe(401);
    expect(await rows(flow)).toEqual([]);
  });

  it('should refuse a candidate signed in with Google', async () => {
    // Arrange
    const signedIn = await flow.t.send('POST', '/api/candidate/google', { idToken: googleToken('ai.do@example.com') });

    // Act
    const res = await flow.t.request(ADD_PATH, {
      method: 'POST',
      body: form(validFields(flow)),
      headers: { cookie: cookiesFrom(signedIn), 'x-requested-with': 'careers-web' },
    });

    // Assert
    expect(res.status).toBe(401);
    expect(await rows(flow)).toEqual([]);
  });
});

describe('The CSRF header', () => {
  const withHeaders = (path: string, body: FormData, headers: Record<string, string>, method = 'POST') =>
    flow.t.request(path, { method, body, headers: { cookie: flow.cookie, ...headers } });

  it('should refuse "Thêm hồ sơ" without it, even with a valid session', async () => {
    // Act
    const res = await withHeaders(ADD_PATH, form(validFields(flow)), {});

    // Assert
    expect(res.status).toBe(403);
    expect(await rows(flow)).toEqual([]);
  });

  it('should refuse a wrong value', async () => {
    // Act
    const res = await withHeaders(ADD_PATH, form(validFields(flow)), { 'x-requested-with': 'XMLHttpRequest' });

    // Assert
    expect(res.status).toBe(403);
    expect(await rows(flow)).toEqual([]);
  });

  it('should refuse reading a CV without it', async () => {
    // Act
    const res = await withHeaders(PARSE_PATH, form({}, pdfFile()), {});

    // Assert
    expect(res.status).toBe(403);
  });

  it('should refuse replacing a CV without it', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: LINK }));

    // Act
    const res = await withHeaders(`${ADD_PATH}/${id}/cv`, form({ cvLink: 'https://example.com/khac.pdf' }), {}, 'PUT');

    // Assert
    expect(res.status).toBe(403);
    expect((await detail(flow, id)).cvLink).toBe(LINK);
  });
});

describe('The PDF', () => {
  it('should store a PDF under a private random path, whatever its name says', async () => {
    // Act
    const id = await addedId(await add(flow, {}, pdfFile('../../etc/passwd.pdf')));

    // Assert
    const stored = await row(flow, id);
    expect(stored?.cvPathname).toMatch(new RegExp(`^cv/${flow.job.id}/[0-9a-f-]{36}\\.pdf$`));
    expect(stored?.cvFileName).toBe('../../etc/passwd.pdf');
  });

  it('should cut a very long file name', async () => {
    // Act
    const id = await addedId(await add(flow, {}, pdfFile(`${'a'.repeat(400)}.pdf`)));

    // Assert
    expect((await row(flow, id))?.cvFileName).toHaveLength(200);
  });

  it('should refuse a renamed non-PDF on the CV box', async () => {
    // Arrange
    const fake = new File(['<html></html>'], 'CV.pdf', { type: 'application/pdf' });

    // Act
    const res = await add(flow, {}, fake);

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).cv).toBe('CV cần là file PDF.');
    expect(await rows(flow)).toEqual([]);
  });

  it('should refuse a PDF cut off during upload', async () => {
    // Arrange
    const cut = new File(['%PDF-1.7\nno end marker'], 'CV.pdf', { type: 'application/pdf' });

    // Act
    const res = await add(flow, {}, cut);

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).cv).toContain('File PDF bị lỗi');
  });

  it('should accept exactly 4 MB and refuse one byte more', async () => {
    // Act
    const exact = await add(flow, {}, pdfOfSize(CV_MAX_BYTES));
    const over = await add(flow, { phone: '0987654321' }, pdfOfSize(CV_MAX_BYTES + 1));

    // Assert
    expect(exact.status).toBe(201);
    expect(over.status).toBe(422);
    expect((await errorsOf(over)).cv).toContain('4 MB');
  });

  it('should refuse an empty file rather than save a profile with no CV', async () => {
    // Arrange
    const empty = new File([], 'CV.pdf', { type: 'application/pdf' });

    // Act
    const res = await add(flow, {}, empty);

    // Assert
    expect(res.status).toBe(422);
    expect(await rows(flow)).toEqual([]);
  });

  it('should say on the CV box that the file is empty', async () => {
    // Act
    const res = await add(flow, {}, new File([], 'CV.pdf', { type: 'application/pdf' }));

    // Assert
    expect((await errorsOf(res)).cv).toContain('File CV trống');
  });

  it('should refuse an empty file when replacing a CV and keep the old one', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: 'https://example.com/cu.pdf' }));

    // Act
    const res = await replace(flow, id, {}, new File([], 'CV.pdf', { type: 'application/pdf' }));

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).cv).toContain('File CV trống');
    expect((await detail(flow, id)).cvLink).toBe('https://example.com/cu.pdf');
  });

  it('should treat a file field with no name and no bytes as no file, as a browser sends an empty box', async () => {
    // Act
    const id = await addedId(await add(flow, {}, new File([], '')));

    // Assert
    expect((await detail(flow, id)).hasCv).toBe(false);
  });

  it('should show both the field errors and the file problem at once, storing nothing', async () => {
    // Arrange
    const fake = new File(['not a pdf'], 'CV.pdf', { type: 'application/pdf' });

    // Act
    const res = await add(flow, { fullName: '', phone: '123' }, fake);

    // Assert
    expect(res.status).toBe(422);
    expect(Object.keys(await errorsOf(res)).sort()).toEqual(['cv', 'fullName', 'phone']);
    expect(flow.t.cvStore.files.size).toBe(0);
  });

  it('should answer a server error and keep no profile when storage is down', async () => {
    // Arrange
    const broken: CvStore = {
      put: async () => {
        throw new Error('blob store is down');
      },
      get: async () => null,
      delete: async () => undefined,
    };
    flow.t.deps.cvStore = broken;

    // Act
    const res = await add(flow, {}, pdfFile());

    // Assert
    expect(res.status).toBe(500);
    expect(await rows(flow)).toEqual([]);
  });
});

describe('Reading a PDF to pre-fill the form', () => {
  it('should read the details of a PDF with text and store nothing', async () => {
    // Act
    const res = await postForm(flow, {}, realPdf('cv-simple-vi.pdf'), PARSE_PATH);

    // Assert
    expect(res.status).toBe(200);
    const parsed = await json<ParsedCvDto>(res);
    expect(parsed.readable).toBe(true);
    expect(parsed.fullName?.toLocaleLowerCase('vi')).toContain('nguyễn thị mai anh');
    expect(flow.t.cvStore.files.size).toBe(0);
    expect(await rows(flow)).toEqual([]);
  });

  it('should say a scan has no text, without failing', async () => {
    // Act
    const res = await postForm(flow, {}, realPdf('cv-scanned-image.pdf'), PARSE_PATH);

    // Assert
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ fullName: null, phone: null, email: null, readable: false });
  });

  it('should refuse a file that is not a PDF', async () => {
    // Arrange
    const fake = new File(['hello'], 'CV.pdf', { type: 'application/pdf' });

    // Act
    const res = await postForm(flow, {}, fake, PARSE_PATH);

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).cv).toBe('CV cần là file PDF.');
  });
});
