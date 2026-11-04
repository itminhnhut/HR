import { getDocumentProxy } from 'unpdf';

/** CVs are a few pages; the middle of a longer file would not change the result much. */
const MAX_PAGES = 6;

/** Why a PDF has no text although a viewer should show something; a scan or a blank page is not a problem. */
export type PdfProblem = 'password' | 'corrupt';

export interface PdfReading {
  /** Text layer with Vietnamese diacritics kept; empty for a scan, a blank page or a file that cannot be read. */
  text: string;
  problem: PdfProblem | null;
}

/** A piece of text as pdf.js places it on the page. */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL: boolean;
}

/** Gaps, in text heights: below a word gap the pieces are one word; from a column gap on they are apart on the page. */
const WORD_GAP = 0.15;
const COLUMN_GAP = 2;
/** A blank piece this wide is a gap set on purpose: "Điện thoại: 0397   Email: …", "L Ê   M I N H". */
const WIDE_BLANK = 0.8;

function gapBetween(last: PdfTextItem, next: PdfTextItem): string {
  if (last.hasEOL) return '\n';
  const height = Math.max(last.height, next.height);
  if (Math.abs(next.y - last.y) > height / 2) return ' ';
  const gap = (next.x - (last.x + last.width)) / (height || 1);
  if (gap < -1) return ' ';
  if (gap <= WORD_GAP) return '';
  return gap >= COLUMN_GAP ? '   ' : ' ';
}

/**
 * Joins the pieces by where they sit on the page. A font without an accented letter splits a word around it ("ch", "ứ",
 * "ng t", "ừ"), so a space between every piece reads "ch ứ ng t ừ" and the CV's words can no longer be found.
 */
export function joinPdfItems(items: readonly PdfTextItem[]): string {
  return items.reduce((text, item, i) => {
    const last = items[i - 1];
    if (!last) return item.str;
    const isWideBlank = item.str.trim() === '' && item.str !== '' && item.width >= WIDE_BLANK * last.height;
    return text + gapBetween(last, item) + (isWideBlank ? '   ' : item.str);
  }, '');
}

const toItem = (item: { str: string; transform: number[]; width: number; height: number; hasEOL: boolean }) => ({
  str: item.str,
  x: item.transform[4] ?? 0,
  y: item.transform[5] ?? 0,
  width: item.width,
  height: item.height,
  hasEOL: item.hasEOL,
});

/** The first pages, plus the last one of a longer file: some CVs close with the contact details. */
export function pagesToRead(pageCount: number): number[] {
  const first = Array.from({ length: Math.min(pageCount, MAX_PAGES) }, (_, i) => i + 1);
  return pageCount > MAX_PAGES ? [...first, pageCount] : first;
}

function problemOf(error: unknown): PdfProblem {
  return error instanceof Error && error.name === 'PasswordException' ? 'password' : 'corrupt';
}

/** Reads a PDF's text layer and never throws: a file pdf.js cannot open comes back with the reason. */
export async function readPdf(bytes: Uint8Array): Promise<PdfReading> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const texts: string[] = [];
    for (const number of pagesToRead(pdf.numPages)) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      texts.push(joinPdfItems(content.items.flatMap((item) => ('str' in item ? [toItem(item)] : []))));
    }
    const text = texts
      .join('\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
    return { text, problem: null };
  } catch (error) {
    console.warn('Could not read PDF text', error instanceof Error ? error.message : error);
    return { text: '', problem: problemOf(error) };
  }
}

/** Text only: empty for scanned CVs (images only) or files pdf.js cannot open. */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  return (await readPdf(bytes)).text;
}
