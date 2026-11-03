import { mkdirSync, writeFileSync } from 'node:fs';
import { parseCvContact, type ParsedCvDto } from '@careers/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pdfText } from '../../../lib/pdf-text.js';
import { json, loginHr } from '../../fixtures.js';
import { createTestContext, type TestContext } from '../../harness.js';
import { CONTACT_FIELDS, HERE, fixtureText, loadCases, pdfBytes, type ContactField } from './cases.js';
import { dangerousContactCvs, renderReport, rowsOf, tally, tallyLine, type Contact, type Row } from './scoring.js';

/**
 * The gate on this set. Reached values, with a little room on what a CV may leave empty; wrong and false fill are
 * ceilings, because those are the outcomes that send HR to a stranger. Raise the floors when the parser improves.
 * Every remaining miss is listed per CV in report/last-run.txt, rewritten by each run.
 */
const GATE: Record<ContactField, { correct: number; wrong: number; falseFill: number }> = {
  fullName: { correct: 289, wrong: 0, falseFill: 0 },
  phone: { correct: 259, wrong: 0, falseFill: 0 },
  email: { correct: 278, wrong: 0, falseFill: 0 },
};
const MAX_CVS_WITH_WRONG_PHONE_OR_EMAIL = 0;

const cases = loadCases();
const pdfCases = cases.filter((cv) => cv.path === 'pdf');
const textCases = cases.filter((cv) => cv.path === 'text');

const readings = new Map<string, ParsedCvDto>();
const statuses = new Map<string, number>();

/** What was read for this CV; a request that did not answer 200 counts as nothing read. */
const reading = (id: string): Contact => {
  const read = readings.get(id);
  return { fullName: read?.fullName ?? null, phone: read?.phone ?? null, email: read?.email ?? null };
};

let t: TestContext;
let filesKept = -1;
let rows: Row[] = [];

beforeAll(async () => {
  t = await createTestContext();
  await t.reset();
  const cookie = await loginHr(t);
  for (const cv of pdfCases) {
    const form = new FormData();
    form.append('cv', new File([pdfBytes(cv.id)], `${cv.id}.pdf`, { type: 'application/pdf' }));
    const res = await t.request('/api/hr/applications/parse-cv', {
      method: 'POST',
      body: form,
      headers: { cookie, 'x-requested-with': 'careers-web' },
    });
    statuses.set(cv.id, res.status);
    if (res.status === 200) readings.set(cv.id, await json<ParsedCvDto>(res));
  }
  filesKept = t.cvStore.files.size;
  for (const cv of textCases) {
    readings.set(cv.id, { ...parseCvContact(fixtureText(cv.id)), readable: true });
  }
  rows = cases.flatMap((cv) => rowsOf(cv, reading(cv.id)));
}, 600_000);

afterAll(() => {
  const summary = CONTACT_FIELDS.map((field) => tallyLine(field, tally(rows.filter((r) => r.field === field))));
  mkdirSync(new URL('report/', HERE), { recursive: true });
  writeFileSync(new URL('report/last-run.txt', HERE), renderReport(rows));
  writeFileSync(new URL('report/last-run.json', HERE), `${JSON.stringify(rows, null, 1)}\n`);
  process.stdout.write(`\ncv-bot/contact (details in report/last-run.txt)\n${summary.join('\n')}\n`);
});

describe('accuracy of "Thêm hồ sơ" on the fictional CV set', () => {
  it.each(CONTACT_FIELDS)('should read at least the agreed number of %s values correctly', (field) => {
    // Act
    const { correct } = tally(rows.filter((r) => r.field === field));

    // Assert
    expect(correct).toBeGreaterThanOrEqual(GATE[field].correct);
  });

  it.each(CONTACT_FIELDS)('should not exceed the agreed number of wrong %s values', (field) => {
    // Act
    const wrong = rows.filter((r) => r.field === field && r.outcome === 'wrong');

    // Assert
    expect(wrong.length, JSON.stringify(wrong)).toBeLessThanOrEqual(GATE[field].wrong);
  });

  it.each(CONTACT_FIELDS)('should not exceed the agreed number of %s false fills', (field) => {
    // Act
    const falseFills = rows.filter((r) => r.field === field && r.outcome === 'false_fill');

    // Assert
    expect(falseFills.length, JSON.stringify(falseFills)).toBeLessThanOrEqual(GATE[field].falseFill);
  });

  it('should not exceed the agreed number of CVs with a wrong or false phone or email', () => {
    // Act
    const dangerous = dangerousContactCvs(rows);

    // Assert
    expect(dangerous.length, dangerous.join(', ')).toBeLessThanOrEqual(MAX_CVS_WITH_WRONG_PHONE_OR_EMAIL);
  });
});

describe('"Thêm hồ sơ" reads every real PDF through POST parse-cv', () => {
  it('should answer 200 without a crash for every PDF', () => {
    // Act
    const failed = pdfCases.filter((cv) => statuses.get(cv.id) !== 200).map((cv) => cv.id);

    // Assert
    expect(failed).toEqual([]);
  });

  it('should say an image-only page has no readable text', () => {
    // Arrange
    const scans = pdfCases.filter((cv) => cv.readable === false);

    // Act
    const claimed = scans.filter((cv) => readings.get(cv.id)?.readable !== false).map((cv) => cv.id);

    // Assert
    expect(scans.length).toBeGreaterThan(0);
    expect(claimed).toEqual([]);
  });

  it('should say a page with a text layer is readable', () => {
    // Act
    const denied = pdfCases
      .filter((cv) => cv.readable !== false && readings.get(cv.id)?.readable !== true)
      .map((cv) => cv.id);

    // Assert
    expect(denied).toEqual([]);
  });

  it('should store no file while reading every CV', () => {
    expect(filesKept).toBe(0);
  });
});

describe('the route adds nothing to pdfText and parseCvContact', () => {
  it('should answer the same as running both directly on the same PDF', async () => {
    // Arrange: a few CVs from each template are enough, the route has no branch per layout
    const sample = pdfCases.filter((_, i) => i % 15 === 0);

    // Act
    const direct = await Promise.all(
      sample.map(async (cv) => parseCvContact(await pdfText(new Uint8Array(pdfBytes(cv.id))))),
    );

    // Assert
    expect(direct).toEqual(sample.map((cv) => reading(cv.id)));
  });

  it('should read the same text from each PDF as its stored fixture', async () => {
    // Arrange
    const sample = pdfCases.filter((_, i) => i % 15 === 0);

    // Act
    const texts = await Promise.all(sample.map((cv) => pdfText(new Uint8Array(pdfBytes(cv.id)))));

    // Assert
    expect(texts).toEqual(sample.map((cv) => fixtureText(cv.id)));
  });
});
