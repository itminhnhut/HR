import { useEffect, useState } from 'react';
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

/**
 * The page address on the official domain (lee-hr.com without www, or the vercel.app address, would be
 * duplicates), without query or hash: tracking parameters are not a different page.
 */
function canonicalUrl(): string {
  return `${SITE.url}${window.location.pathname}`;
}

/**
 * Sets <title>, description, canonical address and share preview tags (Open Graph) for the current screen.
 * Google reads them after running the page; Zalo/Facebook use the defaults in index.html.
 */
export function usePageMeta(title: string | undefined, description?: string) {
  // Read on every render: moving between two pages with the same title still updates the address.
  const path = window.location.pathname;
  useEffect(() => {
    if (!title) return;
    const full = `${title} · ${SITE.company}`;
    document.title = full;
    metaTag('property', 'og:title').content = full;
    if (description) {
      metaTag('name', 'description').content = description;
      metaTag('property', 'og:description').content = description;
    }
    const url = canonicalUrl();
    metaTag('property', 'og:url').content = url;
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }, [title, description, path]);
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
