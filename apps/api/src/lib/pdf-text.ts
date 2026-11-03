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
      texts.push(
        content.items
          .map((item) => ('str' in item ? item.str : '') + ('hasEOL' in item && item.hasEOL ? '\n' : ' '))
          .join(''),
      );
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
