import type { MouseEvent } from 'react';

/**
 * Links to a heading inside an article ("Mục lục" placed by HR, renderArticle's `<a href="#id">`). The
 * preview build uses #/ routes, where a bare #id would change the page, so these clicks scroll by hand.
 */

/** HR placed a "Mục lục" block in the text (renderArticle writes it as `<nav class="toc"`). */
export const hasTocBlock = (html: string): boolean => html.includes('<nav class="toc"');

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/** Click handler for an element holding article HTML: a click on an `#id` link scrolls smoothly to it. */
export function scrollToInPageLink(event: MouseEvent<HTMLElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const target = event.target;
  const link = target instanceof Element ? target.closest('.article-prose a[href^="#"]') : null;
  if (!link || !event.currentTarget.contains(link)) return;
  const id = decodeURIComponent(link.getAttribute('href')?.slice(1) ?? '');
  const heading = id ? document.getElementById(id) : null;
  if (!heading) return;
  event.preventDefault();
  heading.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  // Keyboard and screen reader users continue from the heading they jumped to.
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}
