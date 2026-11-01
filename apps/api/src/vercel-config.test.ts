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

interface RedirectRule {
  source: string;
  destination: string;
  permanent?: boolean;
}

const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8')) as {
  headers: HeaderRule[];
  rewrites: RewriteRule[];
  redirects?: RedirectRule[];
  trailingSlash?: boolean;
  buildCommand: string;
  outputDirectory: string;
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
  // Vercel serves a file that exists before it looks at rewrites, so a built "index.html" answers "/" for
  // everyone and the crawler rule for "/" never runs. The SPA shell ships under another name instead.
  it('should ship no index.html, so crawlers on the home page reach the server-rendered page', () => {
    expect(config.buildCommand).toMatch(
      new RegExp(`mv ${config.outputDirectory}/index\\.html ${config.outputDirectory}/app\\.html`),
    );
    expect(config.rewrites.at(-1)).toEqual({ source: '/((?!assets/).*)', destination: '/app.html' });
    expect(config.rewrites.some((rule) => rule.destination === '/index.html')).toBe(false);
  });

  it.each([
    '/hr',
    '/hr/dang-nhap',
    '/hr/ho-so',
    '/ho-so-cua-toi',
    '/dang-nhap',
    '/tra-cuu-ho-so',
    '/api/jobs',
    '/api/news',
  ])('should tell search engines not to index %s', (path) => {
    expect(robotsHeader(path)).toMatch(/noindex/);
  });

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
  googleInspection:
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0;)',
  googleOther: 'Mozilla/5.0 (compatible; GoogleOther)',
};
const PERSON = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari';
const BOT_PAGES = [
  '/',
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
    for (const path of BOT_PAGES) expect(rewriteOf(path, PERSON), path).toBe('/app.html');
  });

  it('should give bots the app for paths the API does not render', () => {
    expect(rewriteOf('/tin-tuc/a/b/c', BOTS.google)).toBe('/app.html');
    expect(rewriteOf('/tra-cuu-ho-so', BOTS.google)).toBe('/app.html');
    expect(rewriteOf('/gioi-thieu/them', BOTS.google)).toBe('/app.html');
  });

  it('should use one crawler pattern for every server-rendered page', () => {
    const patterns = new Set(
      config.rewrites.flatMap((rule) => (rule.has ?? []).filter((h) => h.key === 'user-agent').map((h) => h.value)),
    );

    expect(patterns.size).toBe(1);
  });

  it('should send API calls to the API for people and crawlers alike', () => {
    for (const userAgent of [PERSON, BOTS.google, BOTS.googleInspection]) {
      expect(rewriteOf('/api/jobs', userAgent)).toBe('/api');
      expect(rewriteOf('/api/news/mot-bai', userAgent)).toBe('/api');
    }
  });

  it('should send the IndexNow key file, robots.txt and the sitemap to the API', () => {
    expect(rewriteOf('/0f1e2d3c-4b5a-6978-abcd-ef0123456789.txt', PERSON)).toBe('/api');
    expect(rewriteOf('/robots.txt', PERSON)).toBe('/api');
    expect(rewriteOf('/sitemap.xml', PERSON)).toBe('/api');
  });

  it('should not send other text files or built assets to the API', () => {
    expect(rewriteOf('/a.txt', PERSON)).toBe('/app.html');
    expect(rewriteOf('/thu-muc/0f1e2d3c-4b5a.txt', PERSON)).toBe('/app.html');
    expect(rewriteOf('/assets/index-abc.js', PERSON)).toBeUndefined();
  });
});

describe('vercel.json duplicate addresses', () => {
  it('should move addresses ending in a slash to the address without it', () => {
    // Act
    const trailingSlash = config.trailingSlash;

    // Assert
    expect(trailingSlash).toBe(false);
  });

  it('should send /viec-lam without a job to the home page for good', () => {
    // Act
    const redirect = (config.redirects ?? []).find((rule) => rule.source === '/viec-lam');

    // Assert
    expect(redirect).toMatchObject({ destination: '/', permanent: true });
  });
});
