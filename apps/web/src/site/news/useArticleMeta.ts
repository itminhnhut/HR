import { absoluteUrl, blogPostingData, newsBreadcrumbData, vietnamIso, type NewsCardDto } from '@careers/shared';
import { useEffect } from 'react';
import { SITE } from '../../lib/site';

/** Sets a <meta property> and returns how to put the previous value back (or remove a tag it created). */
function setProperty(property: string, content: string): () => void {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  const created = !meta;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  const previous = meta.content;
  meta.content = content;
  const el = meta;
  return () => (created ? el.remove() : (el.content = previous));
}

function addJsonLd(data: Record<string, unknown>): () => void {
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.textContent = JSON.stringify(data);
  document.head.appendChild(el);
  return () => el.remove();
}

/**
 * Open Graph `article` tags and JSON-LD BlogPosting + BreadcrumbList for a post page, like JobPage does for
 * JobPosting. Crawlers get the same from the API's prerendered page; this covers Google running the SPA.
 */
export function useArticleMeta(post: NewsCardDto | undefined) {
  useEffect(() => {
    if (!post) return;
    const site = { url: SITE.url, companyName: SITE.company };
    const undo = [
      setProperty('og:type', 'article'),
      setProperty('article:published_time', vietnamIso(post.publishedAt)),
      setProperty('article:modified_time', vietnamIso(post.updatedAt)),
      setProperty('article:section', post.category.name),
      addJsonLd(blogPostingData(post, site)),
      addJsonLd(newsBreadcrumbData(post, site)),
    ];
    if (post.cover) {
      undo.push(
        setProperty('og:image', absoluteUrl(SITE.url, post.cover.url)),
        setProperty('og:image:width', String(post.cover.width)),
        setProperty('og:image:height', String(post.cover.height)),
        setProperty('og:image:alt', post.cover.alt),
      );
    }
    return () => undo.forEach((fn) => fn());
  }, [post]);
}
