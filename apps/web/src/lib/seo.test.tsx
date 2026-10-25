import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useNoIndex, usePageMeta } from './hooks';
import { fillSiteHtml } from './site-html';

const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');

afterEach(() => {
  document.head.innerHTML = '';
});

describe('usePageMeta', () => {
  it('should give each page its own canonical address and share preview text', () => {
    window.history.replaceState(null, '', '/viec-lam/ke-toan?utm_source=zalo');

    renderHook(() => usePageMeta('Kế toán tổng hợp', 'Lương 12–15 triệu, Gò Vấp'));

    expect(document.title).toBe('Kế toán tổng hợp · TOP FLOW');
    expect(meta('meta[name="description"]')).toBe('Lương 12–15 triệu, Gò Vấp');
    expect(meta('meta[property="og:title"]')).toBe('Kế toán tổng hợp · TOP FLOW');
    expect(meta('meta[property="og:description"]')).toBe('Lương 12–15 triệu, Gò Vấp');
    // Tracking parameters are not part of the page address.
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${window.location.origin}/viec-lam/ke-toan`,
    );
    expect(meta('meta[property="og:url"]')).toBe(`${window.location.origin}/viec-lam/ke-toan`);
  });
});

describe('useNoIndex', () => {
  it('should keep a private page out of search results while it is open', () => {
    const view = renderHook(() => useNoIndex());

    expect(meta('meta[name="robots"]')).toBe('noindex, nofollow');
    view.unmount();
    expect(meta('meta[name="robots"]')).toBeUndefined();
  });
});

describe('fillSiteHtml', () => {
  it('should fill the site address and company name into the page shell', () => {
    const html = fillSiteHtml('<meta property="og:image" content="%SITE_URL%/og.jpg"><title>%COMPANY%</title>', {
      VITE_SITE_URL: 'https://www.lee-hr.com/',
      VITE_COMPANY_NAME: '[Tên công ty]',
    });

    expect(html).toBe('<meta property="og:image" content="https://www.lee-hr.com/og.jpg"><title>TOP FLOW</title>');
  });

  it('should fall back to the live address when none is set', () => {
    expect(fillSiteHtml('%SITE_URL%', {})).toBe('https://www.lee-hr.com');
  });
});
