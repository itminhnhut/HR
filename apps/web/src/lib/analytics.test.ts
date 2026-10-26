import { readFileSync } from 'node:fs';
import { act } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GA_ID, isUntrackedPath, trackedOrigins } from './analytics-config';
import { safeReferrer, startAnalytics } from './analytics';
import { fillSiteHtml } from './site-html';

const DISABLE_KEY = `ga-disable-${GA_ID}` as const;

describe('isUntrackedPath', () => {
  it.each(['/hr', '/hr/', '/hr/ho-so', '/ho-so-cua-toi', '/HR/ho-so', '/Ho-So-Cua-Toi'])(
    'should not track %s, where addresses can carry candidate names or phone numbers',
    (path) => {
      expect(isUntrackedPath(path)).toBe(true);
    },
  );

  it.each(['/', '/gioi-thieu', '/viec-lam/ke-toan', '/hrm-tin-tuc'])('should track public page %s', (path) => {
    expect(isUntrackedPath(path)).toBe(false);
  });
});

describe('trackedOrigins', () => {
  it('should count the live site with and without www', () => {
    expect(trackedOrigins({})).toEqual(['https://www.lee-hr.com', 'https://lee-hr.com']);
  });

  it('should also count the address set in VITE_SITE_URL', () => {
    expect(trackedOrigins({ VITE_SITE_URL: 'https://www.topflow.vn/' })).toContain('https://www.topflow.vn');
  });

  it('should ignore a placeholder VITE_SITE_URL', () => {
    expect(trackedOrigins({ VITE_SITE_URL: '[Địa chỉ trang]' })).toEqual([
      'https://www.lee-hr.com',
      'https://lee-hr.com',
    ]);
  });
});

describe('safeReferrer', () => {
  const origin = 'https://www.lee-hr.com';

  it('should cut an HR address down to the site itself', () => {
    expect(safeReferrer('https://www.lee-hr.com/hr/ho-so?q=0912345678', origin)).toBe('https://www.lee-hr.com/');
  });

  it('should keep a public page or another site as it is', () => {
    expect(safeReferrer('https://www.lee-hr.com/viec-lam/ke-toan', origin)).toBe(
      'https://www.lee-hr.com/viec-lam/ke-toan',
    );
    expect(safeReferrer('https://www.google.com/', origin)).toBe('https://www.google.com/');
  });
});

/** Runs the analytics script of index.html as the browser would, with this test page counted as the live site. */
function runPageShellScript() {
  const html = fillSiteHtml(readFileSync('index.html', 'utf8'), { VITE_SITE_URL: window.location.origin });
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1] ?? '')
    .find((code) => code.includes('ga-disable-'));
  if (!script) throw new Error('no analytics script in index.html');
  new Function(script)();
  return html;
}

describe('page shell (index.html)', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    document.head.querySelectorAll('script[src]').forEach((s) => s.remove());
    delete window[DISABLE_KEY];
    delete window.gtag;
    delete window.clarity;
  });

  it('should switch Google Analytics off on an HR address however it is reached, also by Back', () => {
    // Arrange
    runPageShellScript();

    // Act / Assert: GA reads the switch at every hit, after the address has changed.
    expect(window[DISABLE_KEY]).toBe(false);
    window.history.pushState(null, '', '/HR/ho-so?q=0912345678');
    expect(window[DISABLE_KEY]).toBe(true);
    window.history.pushState(null, '', '/');
    expect(window[DISABLE_KEY]).toBe(false);
    window.history.back();
    window.history.replaceState(null, '', '/hr/ho-so');
    expect(window[DISABLE_KEY]).toBe(true);
  });

  it('should not download the Google tag off the live site', () => {
    // Arrange
    const html = fillSiteHtml(readFileSync('index.html', 'utf8'), {});

    // Assert: no tag in the page itself; the script only adds it on the live site (not this test page).
    expect(html).not.toMatch(/<script[^>]+googletagmanager/);
  });
});

describe('startAnalytics', () => {
  const gtag = vi.fn();
  const clarity = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    gtag.mockReset();
    clarity.mockReset();
    window.gtag = gtag;
    window.clarity = clarity;
    // As on the live site: the shell's switch says "on" for public pages.
    window[DISABLE_KEY] = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.gtag;
    delete window.clarity;
    delete window[DISABLE_KEY];
  });

  const pageViews = () => gtag.mock.calls.filter((c) => c[0] === 'event' && c[1] === 'page_view').map((c) => c[2]);

  function start(path: string) {
    const router = createMemoryRouter([{ path: '*', element: null }], { initialEntries: [path] });
    const stop = startAnalytics(router, 'https://www.lee-hr.com', '');
    return { router, stop };
  }

  it('should count each public page once it is shown', async () => {
    // Arrange
    const { router, stop } = start('/');
    vi.runAllTimers();

    // Act
    await act(() => router.navigate('/viec-lam/ke-toan'));
    vi.runAllTimers();

    // Assert
    expect(pageViews().map((p) => p.page_location)).toEqual([
      'https://www.lee-hr.com/',
      'https://www.lee-hr.com/viec-lam/ke-toan',
    ]);
    expect(pageViews()[1]?.page_referrer).toBe('https://www.lee-hr.com/');
    stop();
  });

  it('should stop screen recording before an HR or account page is drawn, whatever the letter case', async () => {
    // Arrange
    const { router, stop } = start('/');

    // Act: the check runs when the address changes, before React draws the new page.
    await act(() => router.navigate('/HR/ho-so?q=0912345678'));

    // Assert
    expect(clarity).toHaveBeenCalledWith('stop');
    vi.runAllTimers();
    expect(pageViews().some((p) => String(p.page_location).toLowerCase().includes('/hr'))).toBe(false);
    stop();
  });

  it('should never send an HR address, not even as the previous page of the next public page', async () => {
    // Arrange: a visit that starts on an HR screen, then goes to the public site.
    const { router, stop } = start('/hr/ho-so?q=0912345678');
    vi.runAllTimers();

    // Act
    await act(() => router.navigate('/'));
    vi.runAllTimers();

    // Assert
    const sent = JSON.stringify(gtag.mock.calls);
    expect(sent).not.toContain('0912345678');
    expect(sent).not.toContain('/hr');
    expect(pageViews()).toHaveLength(1);
    stop();
  });

  it('should send nothing off the live site', async () => {
    // Arrange: on localhost and previews the shell keeps the switch "off".
    window[DISABLE_KEY] = true;

    // Act
    const { stop } = start('/');
    vi.runAllTimers();

    // Assert
    expect(gtag).not.toHaveBeenCalled();
    stop();
  });
});
