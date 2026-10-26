import { useEffect, useState, type RefObject } from 'react';
import { pageTitle } from '@careers/shared';
import { SITE } from './site';

/** The <meta> with this name/property, created when missing. */
function metaTag(attr: 'name' | 'property', key: string): HTMLMetaElement {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }
  return meta;
}

/** The only query parameter that makes a different page: the page number of a news list (?trang=2). */
const PAGE_PARAM = 'trang';

/**
 * The page address on the official domain (lee-hr.com without www, or the vercel.app address, would be
 * duplicates), without hash or tracking parameters. Page 2+ of a list keeps ?trang=N: it is its own page.
 */
function canonicalUrl(): string {
  const page = Number(new URLSearchParams(window.location.search).get(PAGE_PARAM));
  const query = Number.isInteger(page) && page > 1 ? `?${PAGE_PARAM}=${page}` : '';
  return `${SITE.url}${window.location.pathname}${query}`;
}

function setTitle(title: string) {
  const full = pageTitle(title, SITE.company);
  document.title = full;
  metaTag('property', 'og:title').content = full;
}

function setDescription(description: string) {
  metaTag('name', 'description').content = description;
  metaTag('property', 'og:description').content = description;
}

/**
 * Sets <title>, description, canonical address and share preview tags (Open Graph) for the current screen.
 * Google reads them after running the page; Zalo/Facebook get the server pages (routes/share*.ts in the API).
 */
export function usePageMeta(title: string | undefined, description?: string) {
  // Read on every render: moving between two pages with the same title still updates the address.
  const address = window.location.pathname + window.location.search;
  useEffect(() => {
    if (!title) return;
    setTitle(title);
    if (description) setDescription(description);
    const url = canonicalUrl();
    metaTag('property', 'og:url').content = url;
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }, [title, description, address]);
}

const NOT_FOUND_DESCRIPTION = 'Trang này không tồn tại hoặc đã bị gỡ. Xem các vị trí đang tuyển và tin tức mới.';

/**
 * A "not found" screen (unknown address, removed job or post): the SPA answers 200, so tell search engines
 * not to index it (no soft 404) and give it no canonical address. `enabled` lets a page call it always.
 */
export function useNotFoundMeta(title: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    setTitle(title);
    setDescription(NOT_FOUND_DESCRIPTION);
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.head.querySelector('meta[property="og:url"]')?.remove();
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, [title, enabled]);
}

/** A schema.org block in <head> while the page is open (Google reads it after running the page). */
export function useJsonLd(data: Record<string, unknown> | null) {
  const text = data ? JSON.stringify(data) : null;
  useEffect(() => {
    if (!text) return;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = text;
    document.head.appendChild(el);
    return () => el.remove();
  }, [text]);
}

/** Keeps a private page (HR, candidate account, lookup) out of search results while it is open. */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

/** Flips back to false after `ms`, for "Đã chép" style confirmations. */
export function useFlash(ms = 1800): [boolean, () => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return [on, () => setOn(true)];
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / insecure contexts.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/**
 * True once `target` has scrolled up out of view (not before it was ever reached). Without
 * IntersectionObserver (old browsers, tests) it answers `fallback`.
 */
export function useScrolledPast(target: RefObject<HTMLElement | null>, fallback = false): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setPast(fallback);
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry) setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [target, fallback]);
  return past;
}
