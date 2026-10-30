import { readFileSync } from 'node:fs';
import type { ParsedCvDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications } from '../db/schema.js';
import { json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let hrCookie: string;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  hrCookie = await loginHr(t);
});

const samplePdf = (name: string) =>
  new File([readFileSync(new URL(`../test/cv-pdfs/${name}`, import.meta.url))], name, { type: 'application/pdf' });

const parseCv = (file: File, cookie = hrCookie) => {
  const form = new FormData();
  form.append('cv', file);
  return t.request('/api/hr/applications/parse-cv', {
    method: 'POST',
    body: form,
    headers: { cookie, 'x-requested-with': 'careers-web' },
  });
};

/** The parser may keep the CV's capitals and spacing; what matters is the person and the number. */
const comparable = (cv: ParsedCvDto) => ({
  fullName: cv.fullName?.toLocaleLowerCase('vi'),
  phone: cv.phone?.replace(/\D/g, ''),
  email: cv.email?.toLowerCase(),
  readable: cv.readable,
});

describe('HR reads the contact details of a CV to pre-fill "Thêm hồ sơ"', () => {
  it('should return the name, phone and email of a one-column Vietnamese CV', async () => {
    // Act
    const res = await parseCv(samplePdf('cv-simple-vi.pdf'));

    // Assert
    expect(res.status).toBe(200);
    expect(comparable(await json<ParsedCvDto>(res))).toEqual({
      fullName: 'nguyễn thị mai anh',
      phone: '0903456789',
      email: 'maianh.nguyen@example.com',
      readable: true,
    });
  });

  it('should return the contact details kept in the sidebar of a two-column CV', async () => {
    // Act
    const res = await parseCv(samplePdf('cv-two-column.pdf'));

    // Assert
    expect(res.status).toBe(200);
    expect(comparable(await json<ParsedCvDto>(res))).toEqual({
      fullName: 'trần văn hùng',
      phone: '0938111222',
      email: 'hung.tran@example.com',
      readable: true,
    });
  });

  it('should say a scanned CV is not readable and return no details', async () => {
    // Act
    const res = await parseCv(samplePdf('cv-scanned-image.pdf'));

    // Assert
    expect(res.status).toBe(200);
    expect(await json<ParsedCvDto>(res)).toEqual({ fullName: null, phone: null, email: null, readable: false });
  });

  it('should refuse a file that is not a PDF with an error on the CV field', async () => {
    // Arrange
    const notPdf = new File(['Họ tên: Trần Khoa'], 'cv.pdf', { type: 'application/pdf' });

    // Act
    const res = await parseCv(notPdf);

    // Assert
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.cv).toBe('CV cần là file PDF.');
  });

  it('should refuse a request without an HR session', async () => {
    // Act
    const res = await parseCv(samplePdf('cv-simple-vi.pdf'), '');

    // Assert
    expect(res.status).toBe(401);
  });

  it('should not store the file or create an application', async () => {
    // Act
    await parseCv(samplePdf('cv-simple-vi.pdf'));
    await parseCv(samplePdf('cv-scanned-image.pdf'));

    // Assert
    expect(t.cvStore.files.size).toBe(0);
    expect(await t.db.select().from(applications)).toEqual([]);
  });
});
