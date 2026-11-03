import { flattenForPaste } from './flattenForPaste';

export type CopyMailResult = 'copied' | 'unsupported' | 'failed';

/**
 * Puts the mail on the clipboard twice: as HTML for Outlook, as plain text for anything that takes no formatting.
 * The caller reports the failure to HR, which is why the error itself is not kept.
 */
export async function copyRichMail(html: string, text: string): Promise<CopyMailResult> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return 'unsupported';
  try {
    const item = new ClipboardItem({
      'text/html': new Blob([flattenForPaste(html)], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    return 'copied';
  } catch {
    return 'failed';
  }
}
