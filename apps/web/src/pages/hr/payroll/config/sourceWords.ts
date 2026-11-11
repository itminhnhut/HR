/**
 * The source line of a setting as HR reads it. The defaults carry notes for the builders ("spec 5.9", "câu 7",
 * "D13", "R6", "(17.3)", "file T10"); none of them means anything to HR, so they never reach the screen: the law
 * citation stays, HR's October file is named in words, and a source with nothing else is the company's own rule.
 */

export const COMPANY_RULE = 'Quy chế công ty';
export const HR_FILE = 'Theo file lương của HR';

const INTERNAL = [
  // "spec Lương" with no section: the builders' own document, so the company's rule.
  /\bspec\s+Lương\b/giu,
  /\bspec\s+\d+(?:\.\d+)*/gi,
  /(?<![\p{L}\d])câu\s+\d+(?:\s*,\s*\d+)*(?![\p{L}\d])/giu,
  /\(\s*\d+(?:\.\d+)+\s*\)/g,
  /\(\s*[DR]\d{1,2}\s*\)/g,
  /(?<![\p{L}\d./])[DR]\d{1,2}(?![\p{L}\d./])/gu,
];
const FILE = /(?<![\p{L}\d])file\s+T\d{1,2}(?![\p{L}\d])/giu;
const EDGE = /^[\s,·/:–-]+|[\s,·/:–-]+$/g;

function cleanPart(part: string): string {
  const bare = INTERNAL.reduce((text, pattern) => text.replace(pattern, ''), part);
  return bare
    .replace(FILE, HR_FILE)
    .replace(/(?:\s*,)+\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(EDGE, '');
}

export function shownSource(source: string): string {
  if (!source.trim()) return '';
  const parts = source.split(';').map(cleanPart).filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : COMPANY_RULE;
}

/** " · NĐ 253/2026 Đ.50 k2" after a value's words; nothing when the setting has no source. */
export const sourceTail = (source: string | null | undefined): string => {
  const words = shownSource(source ?? '');
  return words ? ` · ${words}` : '';
};
