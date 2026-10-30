import { existsSync } from 'node:fs';
import { parseCvContact } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { loadCorpus } from './load-corpus.js';

// Held-out CVs: never used to tune the parser. Keep it that way: when a case here fails, fix the parser against the
// main corpus (add a similar case there), not against this file. See README.md, "Held-out set".
const { cases, rows, fixture, fixtureUrl } = loadCorpus(new URL('./holdout/', import.meta.url));
const mainIds = new Set(loadCorpus(new URL('./', import.meta.url)).cases.map((cv) => cv.id));

describe('cv-contact held-out data', () => {
  it('should have 40 CVs with ids that are not in the main corpus', () => {
    expect(cases.length).toBe(40);
    expect(new Set(cases.map((cv) => cv.id)).size).toBe(cases.length);
    expect(cases.filter((cv) => mainIds.has(cv.id))).toEqual([]);
  });

  it.each(cases)('$id should have a fixture and well-formed expected values', (cv) => {
    expect(existsSync(fixtureUrl(cv.id))).toBe(true);
    if (cv.phone !== null) expect(cv.phone).toMatch(/^0[35789]\d{8}$/);
    if (cv.email !== null) expect(cv.email).toBe(cv.email.toLowerCase());
    if (cv.fullName !== null) expect(cv.fullName).toBe(cv.fullName.normalize('NFC'));
  });
});

describe('parseCvContact on held-out CVs', () => {
  it.each(rows)('$id [$layout] reads $field', ({ id, field, want }) => {
    const result = parseCvContact(fixture(id));

    expect(result[field]).toBe(want);
  });
});
