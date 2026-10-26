import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

interface RewriteRule {
  source: string;
  destination: string;
  has?: { type: string; key: string; value: string }[];
}

const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8')) as {
  headers: HeaderRule[];
  rewrites: RewriteRule[];
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

/** A "(...)" group starting at `from`, nested groups and escapes included. */
function groupAt(source: string, from: number): string {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    if (source[i] === '\\') i++;
    else if (source[i] === '(') depth++;
    else if (source[i] === ')' && --depth === 0) return source.slice(from, i + 1);
  }
  throw new Error(`Unbalanced group in ${source}`);
}

/** Vercel (path-to-regexp) source → RegExp, for the forms vercel.json uses: ":name", ":name(re)" and "(re)". */
function sourceRegExp(source: string): RegExp {
  let out = '';
  for (let i = 0; i < source.length;) {
    const name = source[i] === ':' ? (/^:\w+/.exec(source.slice(i))?.[0] ?? '') : '';
    i += name.length;
    if (source[i] === '(') {
      const group = groupAt(source, i);
      out += group;
      i += group.length;
    } else if (name) {
      out += '([^/]+)';
    } else {
      out += source[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i++;
    }
  }
  return new RegExp(`^${out}$`);
}

/** Vercel header conditions use "(?i)" for case-insensitive, which JavaScript spells as a flag. */
const headerMatches = (value: string, actual: string) =>
  value.startsWith('(?i)')
    ? new RegExp(`^${value.slice(4)}$`, 'i').test(actual)
    : new RegExp(`^${value}$`).test(actual);

/** Where Vercel sends a request that matches no file: the first rewrite whose source and conditions match. */
const rewriteOf = (path: string, userAgent: string) =>
  config.rewrites.find(
    (rule) =>
      sourceRegExp(rule.source).test(path) &&
      (rule.has ?? []).every((h) => h.key !== 'user-agent' || headerMatches(h.value, userAgent)),
  )?.destination;

const BOTS = {
  google: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  coccoc: 'Mozilla/5.0 (compatible; coccocbot-web/1.0; +http://help.coccoc.com/searchengine)',
  apple: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Applebot/0.1',
  duckduckgo: 'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
  bing: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  zalo: 'Mozilla/5.0 (compatible; Zalo/1.0)',
  facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
};
const PERSON = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari';
const BOT_PAGES = [
  '/viec-lam/ke-toan',
  '/tin-tuc',
  '/tin-tuc/mot-ngay-o-cong-ty',
  '/tin-tuc/chuyen-muc/doi-song',
  '/tin-tuc/the/tuyen-dung',
  '/gioi-thieu',
  '/chinh-sach-du-lieu',
];

describe('vercel.json rewrites', () => {
  it.each(Object.entries(BOTS))('should send %s to the server-rendered pages', (_name, userAgent) => {
    for (const path of BOT_PAGES) expect(rewriteOf(path, userAgent), path).toBe('/api');
  });

  it('should give people the app for the same pages', () => {
    for (const path of BOT_PAGES) expect(rewriteOf(path, PERSON), path).toBe('/index.html');
  });

  it('should give bots the app for paths the API does not render', () => {
    expect(rewriteOf('/tin-tuc/a/b/c', BOTS.google)).toBe('/index.html');
    expect(rewriteOf('/tra-cuu-ho-so', BOTS.google)).toBe('/index.html');
    expect(rewriteOf('/gioi-thieu/them', BOTS.google)).toBe('/index.html');
  });

  it('should use one crawler pattern for every server-rendered page', () => {
    const patterns = new Set(
      config.rewrites.flatMap((rule) => (rule.has ?? []).filter((h) => h.key === 'user-agent').map((h) => h.value)),
    );

    expect(patterns.size).toBe(1);
  });

  it('should send the IndexNow key file, robots.txt and the sitemap to the API', () => {
    expect(rewriteOf('/0f1e2d3c-4b5a-6978-abcd-ef0123456789.txt', PERSON)).toBe('/api');
    expect(rewriteOf('/robots.txt', PERSON)).toBe('/api');
    expect(rewriteOf('/sitemap.xml', PERSON)).toBe('/api');
  });

  it('should not send other text files or built assets to the API', () => {
    expect(rewriteOf('/a.txt', PERSON)).toBe('/index.html');
    expect(rewriteOf('/thu-muc/0f1e2d3c-4b5a.txt', PERSON)).toBe('/index.html');
    expect(rewriteOf('/assets/index-abc.js', PERSON)).toBeUndefined();
  });
});
