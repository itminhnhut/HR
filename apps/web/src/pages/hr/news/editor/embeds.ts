import { safeLinkUrl, YOUTUBE_ID } from '@careers/shared';
import { normalizeLinkInput } from './rules';

/**
 * The 11-character video id from any YouTube address HR pastes: watch?v=, youtu.be/, /shorts/, /embed/,
 * /live/ (with or without www., m., or the nocookie domain). Anything else gives null.
 */
export function youtubeId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, kind, value] = url.pathname.split('/');
    id =
      kind === 'watch'
        ? url.searchParams.get('v')
        : ['shorts', 'embed', 'live'].includes(kind ?? '')
          ? (value ?? null)
          : null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Where a call-to-action button goes: an open job (/viec-lam/<slug>) or a link that passes safeLinkUrl. */
export function ctaUrl(target: { jobSlug: string } | { link: string }): string | null {
  if ('jobSlug' in target) return target.jobSlug ? safeLinkUrl(`/viec-lam/${target.jobSlug}`) : null;
  return normalizeLinkInput(target.link);
}

/** "/viec-lam/ke-toan" → "ke-toan", to preselect the job when editing a button. */
export const jobSlugFromUrl = (url: string): string | null => url.match(/^\/viec-lam\/([^/?#]+)$/)?.[1] ?? null;
