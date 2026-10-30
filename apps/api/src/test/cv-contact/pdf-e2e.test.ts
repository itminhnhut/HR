import { readdirSync, readFileSync } from 'node:fs';
import { parseCvContact } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { pdfText } from '../../lib/pdf-text.js';
import { loadCorpus } from './load-corpus.js';

const corpus = loadCorpus(new URL('./', import.meta.url)).cases;
const pdfIds = readdirSync(new URL('./pdfs/', import.meta.url))
  .filter((name) => name.endsWith('.pdf'))
  .map((name) => name.slice(0, -'.pdf'.length));
const cases = corpus.filter((cv) => pdfIds.includes(cv.id));

const readPdf = (id: string) => new Uint8Array(readFileSync(new URL(`./pdfs/${id}.pdf`, import.meta.url)));
const readFixture = (id: string) => readFileSync(new URL(`./fixtures/${id}.txt`, import.meta.url), 'utf8');

describe('CV PDF → pdfText → parseCvContact', () => {
  it('should keep about ten representative PDFs, each listed in expected.json', () => {
    expect(cases.length).toBe(pdfIds.length);
    expect(cases.length).toBeGreaterThanOrEqual(8);
  });

  it.each(cases)('$id [$layout] should extract the same text as its fixture', async ({ id }) => {
    const text = await pdfText(readPdf(id));

    expect(text).toBe(readFixture(id));
  });

  it.each(cases)('$id [$layout] should read name, phone and email from the PDF', async (cv) => {
    const text = await pdfText(readPdf(cv.id));

    const result = parseCvContact(text);

    expect(result).toEqual({ fullName: cv.fullName, phone: cv.phone, email: cv.email });
  });
});
