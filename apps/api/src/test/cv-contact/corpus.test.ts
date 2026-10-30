import { existsSync } from 'node:fs';
import { parseCvContact } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { loadCorpus } from './load-corpus.js';

const { cases: corpus, rows, fixture, fixtureUrl } = loadCorpus(new URL('./', import.meta.url));

describe('cv-contact corpus data', () => {
  it('should have at least 80 CVs with unique ids', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(80);
    expect(new Set(corpus.map((cv) => cv.id)).size).toBe(corpus.length);
  });

  it.each(corpus)('$id should have a fixture and well-formed expected values', (cv) => {
    expect(existsSync(fixtureUrl(cv.id))).toBe(true);
    if (cv.phone !== null) expect(cv.phone).toMatch(/^0[35789]\d{8}$/);
    if (cv.email !== null) expect(cv.email).toBe(cv.email.toLowerCase());
    if (cv.fullName !== null) expect(cv.fullName).toBe(cv.fullName.normalize('NFC'));
  });
});

describe('parseCvContact on the CV corpus', () => {
  it.each(rows)('$id [$layout] reads $field', ({ id, field, want }) => {
    const result = parseCvContact(fixture(id));

    expect(result[field]).toBe(want);
  });
});
