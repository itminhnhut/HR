/** Only http(s) links may become a clickable href: a stored "javascript:" or "data:" link must never run. */
export const isWebLink = (link: string) => /^https?:\/\//i.test(link);
