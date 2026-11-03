import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HERE, fixtureText, loadCases } from './cases.js';
import { classify, nameErrorKind } from './scoring.js';

const cases = loadCases();
const tuned = ['../../cv-contact/expected.json', '../../cv-contact/holdout/expected.json'].flatMap(
  (path) =>
    JSON.parse(readFileSync(new URL(path, HERE), 'utf8')) as {
      fullName: string | null;
      phone: string | null;
      email: string | null;
    }[],
);
const MOBILE = /^0(3[2-9]|5[689]|7[06-9]|8[1-9]|9\d)\d{7}$/;
const PDF_LIMIT = 150_000;

describe('the evaluation set', () => {
  it('should hold at least 150 CVs as real PDFs', () => {
    expect(cases.filter((cv) => cv.path === 'pdf').length).toBeGreaterThanOrEqual(150);
  });

  it('should share no name, phone or email with the data the parser was tuned on', () => {
    // Arrange
    const seen = new Set(tuned.flatMap((e) => [e.fullName, e.phone, e.email]).filter((v) => v !== null));

    // Act
    const shared = cases.flatMap((cv) => [cv.fullName, cv.phone, cv.email]).filter((v) => v !== null && seen.has(v));

    // Assert
    expect(shared).toEqual([]);
  });

  it('should give every CV its own id and a text fixture', () => {
    const ids = cases.map((cv) => cv.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(typeof fixtureText(id)).toBe('string');
  });

  it('should only expect phones shaped like a current Vietnamese mobile', () => {
    const odd = cases.map((cv) => cv.phone).filter((p) => p !== null && !MOBILE.test(p));

    expect(odd).toEqual([]);
  });

  it('should only expect lowercase emails without mailto', () => {
    const odd = cases
      .map((cv) => cv.email)
      .filter((e) => e !== null && (e !== e.toLowerCase() || e.startsWith('mailto:') || !e.includes('@')));

    expect(odd).toEqual([]);
  });

  it('should keep candidate and company addresses on free-mail or reserved domains', () => {
    // Arrange
    const allowed =
      /(@|\.)(gmail\.com|yahoo\.com|yahoo\.com\.vn|outlook\.com|hotmail\.com|icloud\.com|[a-z.]*example)$/;

    // Act
    const odd = cases.map((cv) => cv.email).filter((e) => e !== null && !allowed.test(e));

    // Assert
    expect(odd).toEqual([]);
  });

  it('should keep every PDF small', () => {
    // Arrange
    const dir = new URL('pdfs/', HERE);

    // Act
    const big = readdirSync(dir).filter((f) => statSync(new URL(f, dir)).size > PDF_LIMIT);

    // Assert
    expect(big).toEqual([]);
  });
});

describe('scoring', () => {
  it('should split a wrong value from a missing one and from a false fill', () => {
    expect(classify('0912000001', '0912000001')).toBe('correct');
    expect(classify('0912000001', '0912000002')).toBe('wrong');
    expect(classify('0912000001', null)).toBe('missing');
    expect(classify(null, '0912000002')).toBe('false_fill');
    expect(classify(null, null)).toBe('correct_empty');
  });

  it('should count a value declared acceptable with the label as correct', () => {
    expect(classify('0362418903', '01662418903', ['01662418903'])).toBe('correct');
  });

  it('should tell a casing slip from part of the name and from other text', () => {
    expect(nameErrorKind('Thao-Vy Dang', 'Thao-vy Dang')).toBe('case/spacing only');
    expect(nameErrorKind('Nguyễn Văn An', 'Nguyễn Văn')).toBe('part of the right name');
    expect(nameErrorKind('Nguyễn Văn An', 'Phòng Nhân Sự')).toBe('other text');
  });
});
