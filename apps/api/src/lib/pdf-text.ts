import { getDocumentProxy } from 'unpdf';

/** CVs are a few pages; anything longer is cut, it would not change the result much. */
const MAX_PAGES = 6;

/**
 * Text layer of a PDF (Vietnamese diacritics kept). Empty for scanned CVs (images only) or files pdf.js
 * cannot open; the caller treats empty as "not readable" rather than an error.
 */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    const texts: string[] = [];
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      texts.push(
        content.items
          .map((item) => ('str' in item ? item.str : '') + ('hasEOL' in item && item.hasEOL ? '\n' : ' '))
          .join(''),
      );
    }
    return texts
      .join('\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  } catch (error) {
    console.warn('Could not read PDF text', error instanceof Error ? error.message : error);
    return '';
  }
}
