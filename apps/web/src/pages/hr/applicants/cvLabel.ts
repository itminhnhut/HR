/** "ntd.vieclam24h.vn" for a link: a job site's CV address can be hundreds of characters. Not a link: null. */
export const linkSite = (text: string): string | null => text.match(/^https?:\/\/(?:www\.)?([^/?#\s:]+)/i)?.[1] ?? null;
