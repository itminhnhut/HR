import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import type { ParsedCvDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../../db/schema.js';
import { insertJob, json, loginHr } from '../../fixtures.js';
import { createTestContext, type TestContext } from '../../harness.js';
import { badFile, pdfBytes } from './cases.js';

const MB4 = 4 * 1024 * 1024;
const GOOD_ID = 'la-topcv-01';
const NOT_PDF = 'CV cần là file PDF.';
const BROKEN = 'File PDF bị lỗi hoặc chưa tải hết. Lưu lại file rồi thử lại, hoặc dán link CV.';
const TOO_BIG = 'File lớn hơn 4 MB. Nén lại hoặc dán link CV.';
const CHOOSE = 'Chọn file CV (PDF).';
const EMPTY = 'File CV rỗng (0 byte). Chọn lại file khác hoặc dán link CV.';
const LOCKED =
  'CV có đặt mật khẩu nên không đọc được, nhập tay giúp. Cần xem nội dung thì nhờ ứng viên gửi bản không khoá.';
const CORRUPT =
  'File PDF bị hỏng nên không đọc được, nhập tay giúp. Cần xem nội dung thì nhờ ứng viên gửi lại file khác.';
const NOTHING: ParsedCvDto = { fullName: null, phone: null, email: null, readable: false };
const PAST_PAGE_LIMIT = { id: 'zz-long-02', phone: '0987205364', email: 'hoaivu.le.kt@gmail.com', name: 'Lê Hoài Vũ' };

const good = () => pdfBytes(GOOD_ID);
const pad = (size: number, fill = 0x20) => Buffer.alloc(size, fill);
const file = (bytes: Uint8Array | string, name = 'cv.pdf', type = 'application/pdf') =>
  new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], name, { type });

/** Bytes of a valid PDF with a stretch in the middle overwritten, so header and %%EOF stay. */
function gutted() {
  const bytes = Buffer.from(good());
  bytes.fill(0x7a, 1024, bytes.length - 1024);
  return bytes;
}

const refused = [
  { label: 'plain text renamed .pdf', make: () => file('Họ tên: Cù Hoàng Phi\nSĐT: 0396 118 420'), message: NOT_PDF },
  {
    label: 'PNG image renamed .pdf',
    make: () => file(Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')),
    message: NOT_PDF,
  },
  { label: 'JPEG photo renamed .pdf', make: () => file(Buffer.from('ffd8ffe000104a464946', 'hex')), message: NOT_PDF },
  {
    label: 'Word .docx renamed .pdf',
    make: () => file(Buffer.concat([Buffer.from('PK\u0003\u0004'), pad(200)])),
    message: NOT_PDF,
  },
  { label: 'HTML page renamed .pdf', make: () => file('<!doctype html><title>CV</title>'), message: NOT_PDF },
  {
    label: 'Windows program renamed .pdf',
    make: () => file(Buffer.concat([Buffer.from('MZ'), pad(200, 0)])),
    message: NOT_PDF,
  },
  { label: 'PDF cut off half way', make: () => file(good().subarray(0, good().length >> 1)), message: BROKEN },
  {
    label: 'PDF cut off half way, then padded',
    make: () => file(Buffer.concat([good().subarray(0, good().length >> 1), pad(2048, 0)])),
    message: BROKEN,
  },
  { label: 'only the PDF header', make: () => file('%PDF-1.7\n'), message: BROKEN },
  { label: 'over 4 MB', make: () => file(Buffer.concat([good(), pad(MB4)])), message: TOO_BIG },
  {
    label: 'one byte over 4 MB',
    make: () => file(Buffer.concat([good(), pad(MB4 - good().length + 1)])),
    message: TOO_BIG,
  },
  { label: 'empty file (0 bytes)', make: () => file(''), message: EMPTY },
];

/**
 * pdf.js cannot read these or there is no text; the route answers "not readable" instead of an error.
 * Locked and broken files also say why, which tells them from a scan; a file with no text has nothing to explain.
 */
const unreadable = [
  {
    label: 'password-protected PDF',
    make: () => file(badFile('encrypted-user-password.pdf')),
    answer: { ...NOTHING, problem: LOCKED },
  },
  {
    label: 'PDF with a header and %%EOF but garbage inside',
    make: () => file(`%PDF-1.7\n${'x'.repeat(4000)}\n%%EOF\n`),
    answer: { ...NOTHING, problem: CORRUPT },
  },
  { label: 'PDF with its body overwritten', make: () => file(gutted()), answer: { ...NOTHING, problem: CORRUPT } },
  { label: 'PDF with no pages', make: () => file(badFile('zero-pages.pdf')), answer: NOTHING },
  { label: 'PDF with one blank page', make: () => file(badFile('blank-page.pdf')), answer: NOTHING },
];

let t: TestContext;
let cookie: string;

const parseCv = (form: FormData) =>
  t.request('/api/hr/applications/parse-cv', {
    method: 'POST',
    body: form,
    headers: { cookie, 'x-requested-with': 'careers-web' },
  });

const formOf = (f: File) => {
  const form = new FormData();
  form.append('cv', f);
  return form;
};

/** Row count of every table, so anything written while reading a file shows up, not only applications. */
async function rowCounts(): Promise<Record<string, number>> {
  const tables = Object.values(schema).filter((v) => is(v, PgTable));
  const counts = await Promise.all(
    tables.map(async (table) => {
      const name = getTableName(table);
      const result = (await t.db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${name}"`))) as {
        rows: { n: number }[];
      };
      return [name, result.rows[0]?.n ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts);
}

beforeAll(async () => {
  t = await createTestContext();
}, 120_000);

beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
});

describe('parse-cv refuses a bad file with a clear message', () => {
  it.each(refused)('should answer 422 with the reason for: $label', async ({ make, message }) => {
    // Act
    const res = await parseCv(formOf(make()));

    // Assert
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.cv).toBe(message);
  });

  it.each(refused)('should keep nothing after: $label', async ({ make }) => {
    // Arrange
    const before = await rowCounts();

    // Act
    await parseCv(formOf(make()));

    // Assert
    expect(t.cvStore.files.size).toBe(0);
    expect(t.imageStore.files.size).toBe(0);
    expect(await rowCounts()).toEqual(before);
  });

  it('should answer 422 when the form has no cv field', async () => {
    // Act
    const res = await parseCv(new FormData());

    // Assert
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.cv).toBe(CHOOSE);
  });

  it('should ask for a file when a browser sends the empty unnamed part of an unused picker', async () => {
    // Arrange
    const form = new FormData();
    form.append('cv', new File([], ''));

    // Act
    const res = await parseCv(form);

    // Assert
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.cv).toBe(CHOOSE);
  });

  it('should answer 422 when cv is a text field, not a file', async () => {
    // Arrange
    const form = new FormData();
    form.append('cv', 'Cù Hoàng Phi 0396 118 420');

    // Act
    const res = await parseCv(form);

    // Assert
    expect(res.status).toBe(422);
  });

  it('should refuse a request without an HR session and read nothing', async () => {
    // Arrange
    const form = formOf(file(good()));

    // Act
    const res = await t.request('/api/hr/applications/parse-cv', {
      method: 'POST',
      body: form,
      headers: { 'x-requested-with': 'careers-web' },
    });

    // Assert
    expect(res.status).toBe(401);
  });
});

describe('parse-cv survives a file it cannot read', () => {
  it.each(unreadable)('should answer readable:false with no details for: $label', async ({ make, answer }) => {
    // Act
    const res = await parseCv(formOf(make()));

    // Assert
    expect(res.status).toBe(200);
    expect(await json<ParsedCvDto>(res)).toEqual(answer);
  });

  it.each(unreadable)('should keep nothing after: $label', async ({ make }) => {
    // Arrange
    const before = await rowCounts();

    // Act
    await parseCv(formOf(make()));

    // Assert
    expect(t.cvStore.files.size).toBe(0);
    expect(t.imageStore.files.size).toBe(0);
    expect(await rowCounts()).toEqual(before);
  });

  it.each(unreadable)('should log no CV content when reading fails for: $label', async ({ make }) => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    // Act
    await parseCv(formOf(make()));
    const logged = JSON.stringify(warn.mock.calls);
    warn.mockRestore();

    // Assert
    expect(logged).not.toContain('0396');
    expect(logged).not.toContain('@gmail');
  });

  it('should read the next good CV after every kind of bad file', async () => {
    // Arrange
    for (const { make } of [...refused, ...unreadable]) await parseCv(formOf(make()));

    // Act
    const res = await parseCv(formOf(file(good())));

    // Assert
    expect(res.status).toBe(200);
    expect((await json<ParsedCvDto>(res)).phone).toBe('0387216540');
  });
});

describe('a PDF with more pages than are read', () => {
  it('should find contact details printed on the last page', async () => {
    // Act
    const res = await parseCv(formOf(file(pdfBytes(PAST_PAGE_LIMIT.id))));
    const read = await json<ParsedCvDto>(res);

    // Assert
    expect(res.status).toBe(200);
    expect(read).toEqual({
      fullName: PAST_PAGE_LIMIT.name,
      phone: PAST_PAGE_LIMIT.phone,
      email: PAST_PAGE_LIMIT.email,
      readable: true,
    });
  });

  it('should keep nothing after reading it', async () => {
    // Arrange
    const before = await rowCounts();

    // Act
    await parseCv(formOf(file(pdfBytes(PAST_PAGE_LIMIT.id))));

    // Assert
    expect(t.cvStore.files.size).toBe(0);
    expect(await rowCounts()).toEqual(before);
  });
});

describe('a file that is unusual but fine is still read', () => {
  it('should read a valid PDF sent with a wrong type and no extension', async () => {
    // Act
    const res = await parseCv(formOf(file(good(), 'cv-moi', 'application/octet-stream')));

    // Assert
    expect(res.status).toBe(200);
    expect((await json<ParsedCvDto>(res)).email).toBe('kimoanh.dao96@gmail.com');
  });

  it('should accept a PDF of exactly 4 MB', async () => {
    // Arrange: padding after the last %%EOF, then a closing marker so the tail check still passes
    const tail = Buffer.from('\n%%EOF\n');
    const bytes = Buffer.concat([good(), pad(MB4 - good().length - tail.length), tail]);

    // Act
    const res = await parseCv(formOf(file(bytes)));

    // Assert
    expect(res.status).toBe(200);
    expect((await json<ParsedCvDto>(res)).phone).toBe('0387216540');
  });

  it('should read a valid PDF with more than a kilobyte of padding after %%EOF', async () => {
    // Arrange: some writers and mail gateways leave trailing bytes; the file opens fine in any viewer
    const bytes = Buffer.concat([good(), pad(2048, 0)]);

    // Act
    const res = await parseCv(formOf(file(bytes)));

    // Assert
    expect(res.status).toBe(200);
  });
});

describe('HR can tell what went wrong from the answer', () => {
  const statusAndBody = async (f: File) => {
    const res = await parseCv(formOf(f));
    return { status: res.status, body: await json<unknown>(res) };
  };
  const scan = () => file(pdfBytes('zz-scan-01'));

  it('should tell a password-protected PDF apart from a scan', async () => {
    // Act
    const locked = await statusAndBody(file(badFile('encrypted-user-password.pdf')));
    const scanned = await statusAndBody(scan());

    // Assert
    expect(locked).not.toEqual(scanned);
    expect(locked.body).toMatchObject({ problem: LOCKED });
    expect(scanned.body).toEqual(NOTHING);
  });

  it('should tell a corrupt PDF apart from a scan', async () => {
    // Act
    const corrupt = await statusAndBody(file(`%PDF-1.7\n${'x'.repeat(4000)}\n%%EOF\n`));
    const scanned = await statusAndBody(scan());

    // Assert
    expect(corrupt).not.toEqual(scanned);
    expect(corrupt.body).toMatchObject({ problem: CORRUPT });
  });

  it('should tell an empty upload apart from no file chosen', async () => {
    // Act
    const empty = await statusAndBody(file(''));
    const noFile = await parseCv(new FormData());

    // Assert
    expect(empty.body).not.toEqual(await json<unknown>(noFile));
  });

  it('should give the same reason when reading and when saving a file the server refuses', async () => {
    // Arrange: the note for such a file must not promise that saving still works, see useCvAutofill
    const job = await insertJob(t);
    const renamed = () => file('Họ tên: Cù Hoàng Phi');
    const read = await parseCv(formOf(renamed()));
    const form = formOf(renamed());
    const fields = { jobId: job.id, fullName: 'Cù Hoàng Phi', phone: '0396118420', source: 'zalo', consent: 'true' };
    for (const [key, value] of Object.entries(fields)) form.append(key, value);

    // Act
    const saved = await t.request('/api/hr/applications', {
      method: 'POST',
      body: form,
      headers: { cookie, 'x-requested-with': 'careers-web' },
    });

    // Assert
    const reason = async (res: Response) => (await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.cv;
    expect(read.status).toBe(422);
    expect(saved.status).toBe(422);
    expect(await reason(saved)).toBe(await reason(read));
    expect(t.cvStore.files.size).toBe(0);
  });

  it('should keep saving possible for a locked PDF, which only cannot be read', async () => {
    // Arrange
    const job = await insertJob(t);
    const locked = () => file(badFile('encrypted-user-password.pdf'));
    const form = formOf(locked());
    const fields = { jobId: job.id, fullName: 'Cù Hoàng Phi', phone: '0396118420', source: 'zalo', consent: 'true' };
    for (const [key, value] of Object.entries(fields)) form.append(key, value);

    // Act
    const read = await parseCv(formOf(locked()));
    const saved = await t.request('/api/hr/applications', {
      method: 'POST',
      body: form,
      headers: { cookie, 'x-requested-with': 'careers-web' },
    });

    // Assert
    expect((await json<ParsedCvDto>(read)).problem).toBe(LOCKED);
    expect(saved.status).toBe(201);
  });
});
