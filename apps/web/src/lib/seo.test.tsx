import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useNoIndex, useNotFoundMeta, usePageMeta } from './hooks';
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

describe('usePageMeta titles and list pages', () => {
  const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');

  it('should keep ?trang= in the canonical address of page 2 and later', () => {
    window.history.replaceState(null, '', '/tin-tuc?trang=2&utm_source=zalo');

    renderHook(() => usePageMeta('Tin tức – trang 2'));

    expect(canonical()).toBe(`${window.location.origin}/tin-tuc?trang=2`);
  });

  it('should drop ?trang=1 and any value that is not a page number', () => {
    window.history.replaceState(null, '', '/tin-tuc?trang=1');
    const view = renderHook(() => usePageMeta('Tin tức'));
    expect(canonical()).toBe(`${window.location.origin}/tin-tuc`);
    view.unmount();

    window.history.replaceState(null, '', '/tin-tuc?trang=abc');
    renderHook(() => usePageMeta('Tin tức'));
    expect(canonical()).toBe(`${window.location.origin}/tin-tuc`);
  });

  it('should not repeat the brand when the title already names it', () => {
    window.history.replaceState(null, '', '/tin-tuc/mot-ngay');

    renderHook(() => usePageMeta('Một ngày làm việc tại TOP FLOW'));

    expect(document.title).toBe('Một ngày làm việc tại TOP FLOW');
  });
});

describe('useNotFoundMeta', () => {
  it('should keep a not-found screen out of search results, without a canonical address', () => {
    // Arrange
    window.history.replaceState(null, '', '/khong-co-trang-nay');
    const page = renderHook(() => usePageMeta('Việc làm'));
    page.unmount();

    // Act
    const view = renderHook(() => useNotFoundMeta('Không tìm thấy trang'));

    // Assert
    expect(document.title).toBe('Không tìm thấy trang · TOP FLOW');
    expect(meta('meta[name="robots"]')).toBe('noindex');
    expect(meta('meta[name="description"]')).toMatch(/không tồn tại/);
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
    view.unmount();
    expect(meta('meta[name="robots"]')).toBeUndefined();
  });

  it('should do nothing while the page is not a not-found state', () => {
    window.history.replaceState(null, '', '/tin-tuc');
    renderHook(() => usePageMeta('Tin tức'));

    renderHook(() => useNotFoundMeta('Không tìm thấy chuyên mục', false));

    expect(meta('meta[name="robots"]')).toBeUndefined();
    expect(document.head.querySelector('link[rel="canonical"]')).not.toBeNull();
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
