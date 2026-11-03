import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loginHr } from '../../fixtures.js';
import { createTestContext, type TestContext } from '../../harness.js';
import { labelSchema, renderReport, scoreCv, type CvResult, type Label } from './score.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PDF_DIR = join(HERE, 'pdfs');
const REPORT_DIR = join(HERE, 'report');

// The PDFs are git-ignored: without them (a fresh checkout, CI) there is nothing to measure, so the suite is skipped.
const hasPdfs = existsSync(PDF_DIR);

async function askParseCv(t: TestContext, cookie: string, label: Label): Promise<CvResult> {
  const bytes = await readFile(join(PDF_DIR, label.file));
  const form = new FormData();
  // A neutral file name for every CV: only the document's text may supply the answer.
  form.append('cv', new File([bytes], 'cv.pdf', { type: 'application/pdf' }));
  const res = await t.request('/api/hr/applications/parse-cv', {
    method: 'POST',
    headers: { cookie, 'x-requested-with': 'careers-web' },
    body: form,
  });
  const text = await res.text();
  return scoreCv(label, res.status, parseBody(text));
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    return { unparsedBody: text, parseError: String(error) };
  }
}

describe.skipIf(!hasPdfs)('parse-cv on the fresh blind CV set', () => {
  let t: TestContext;
  let cookie: string;

  beforeAll(async () => {
    t = await createTestContext();
    await t.reset();
    cookie = await loginHr(t);
  });

  it('should write a per-field report covering every labelled CV', async () => {
    // Arrange
    const labelsText = await readFile(join(HERE, 'labels.json'), 'utf8');
    const labels = z.array(labelSchema).parse(JSON.parse(labelsText));
    const checksum = createHash('sha256').update(labelsText).digest('hex');
    const frozen = await readFile(join(HERE, 'labels.sha256'), 'utf8');
    const frozenAt = (await readFile(join(HERE, 'frozen-at.txt'), 'utf8')).trim();

    // Act
    const results: CvResult[] = [];
    for (const label of labels) results.push(await askParseCv(t, cookie, label));
    const report = renderReport(results, {
      labelsChecksum: checksum,
      labelsChecksumMatches: frozen.startsWith(checksum),
      frozenAt,
    });
    await mkdir(REPORT_DIR, { recursive: true });
    await writeFile(join(REPORT_DIR, 'report.md'), report);
    await writeFile(join(REPORT_DIR, 'results.json'), `${JSON.stringify(results, null, 1)}\n`);

    // Assert: only that the report exists; accuracy never fails this test.
    expect(results).toHaveLength(labels.length);
    expect(existsSync(join(REPORT_DIR, 'report.md'))).toBe(true);
  });
});
