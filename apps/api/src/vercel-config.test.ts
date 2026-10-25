import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8')) as {
  headers: HeaderRule[];
};

/** Vercel `source` patterns used here: literal paths with "(.*)" wildcards. */
const matches = (source: string, path: string) =>
  new RegExp(
    `^${source
      .split('(.*)')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
  ).test(path);

const robotsHeader = (path: string) =>
  config.headers
    .filter((rule) => matches(rule.source, path))
    .flatMap((rule) => rule.headers)
    .find((h) => h.key.toLowerCase() === 'x-robots-tag')?.value;

describe('vercel.json', () => {
  it.each(['/hr', '/hr/dang-nhap', '/hr/ho-so', '/ho-so-cua-toi', '/dang-nhap', '/tra-cuu-ho-so', '/api/jobs'])(
    'should tell search engines not to index %s',
    (path) => {
      expect(robotsHeader(path)).toMatch(/noindex/);
    },
  );

  it.each(['/', '/gioi-thieu', '/viec-lam/nhan-vien-kinh-doanh', '/hrm-khong-lien-quan'])(
    'should leave public page %s indexable',
    (path) => {
      expect(robotsHeader(path)).toBeUndefined();
    },
  );
});
