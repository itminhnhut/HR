import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GA_ID, isUntrackedPath, useNoAnalytics } from './analytics';
import { CLARITY_ID, TRACKED_ORIGIN } from './analytics-config';
import { fillSiteHtml } from './site-html';

const disabled = () => (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`];

describe('isUntrackedPath', () => {
  it.each(['/hr', '/hr/', '/hr/ho-so', '/ho-so-cua-toi'])(
    'should not track %s, where addresses can carry candidate names or phone numbers',
    (path) => {
      expect(isUntrackedPath(path)).toBe(true);
    },
  );

  it.each(['/', '/gioi-thieu', '/viec-lam/ke-toan', '/hrm-tin-tuc'])('should track public page %s', (path) => {
    expect(isUntrackedPath(path)).toBe(false);
  });
});

describe('useNoAnalytics', () => {
  it('should switch Google Analytics off while an HR or account page is open', () => {
    const view = renderHook(() => useNoAnalytics());

    expect(disabled()).toBe(true);
    view.unmount();
    // Tests run on localhost, which is never tracked.
    expect(disabled()).toBe(window.location.origin !== TRACKED_ORIGIN);
  });

  it('should stop Clarity screen recording when an HR or account page opens', () => {
    const clarity = vi.fn();
    (window as unknown as { clarity?: unknown }).clarity = clarity;

    renderHook(() => useNoAnalytics());

    expect(clarity).toHaveBeenCalledWith('stop');
    delete (window as unknown as { clarity?: unknown }).clarity;
  });

  it('should only count visits on the live site', () => {
    expect(TRACKED_ORIGIN).toBe('https://www.lee-hr.com');
    expect(window.location.origin).not.toBe(TRACKED_ORIGIN);
  });
});

describe('fillSiteHtml', () => {
  it('should fill the Analytics ID and the untracked paths into the page shell', () => {
    const html = fillSiteHtml("gtag('config', '%GA_ID%'); %UNTRACKED_PATHS%.test(location.pathname)", {});

    expect(html).toBe(`gtag('config', '${GA_ID}'); ${String(/^\/(hr|ho-so-cua-toi)(\/|$)/)}.test(location.pathname)`);
  });
});

describe('fillSiteHtml with Clarity', () => {
  it('should fill the Clarity project ID into the page shell', () => {
    expect(fillSiteHtml('"%CLARITY_ID%"', {})).toBe(`"${CLARITY_ID}"`);
    expect(CLARITY_ID).toBe('z3be4ov8ok');
  });
});
