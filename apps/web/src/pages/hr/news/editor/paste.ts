import { ClipboardDOMImportExtension } from '@lexical/clipboard';
import { $isCodeNode } from '@lexical/code-core';
import {
  defineImportRule,
  defineOverlayRules,
  DOMImportExtension,
  ImportOverlays,
  sel,
  type DOMPreprocessFn,
} from '@lexical/html';
import { WordListImportExtension } from '@lexical/list';
import {
  $findMatchingParent,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  configExtension,
  defineExtension,
  PASTE_COMMAND,
  type BaseSelection,
  type LexicalNode,
  type PasteCommandType,
} from 'lexical';
import { mergeTextStyles, nestListsByAriaLevel, pastedTextStyle } from './pasteRules';

/**
 * Pasting: plain text only inside a code block; Word lists (mso-list paragraphs) and Google Docs nested lists
 * become real lists; the inline styles the site can show (palette colours, preset sizes, the serif font) are
 * kept from pasted spans. Everything pasted still goes through the transforms (transforms.ts).
 */

/** Text typed or pasted as plain lines: "\n" becomes a line break, "\t" a tab. */
export function $insertPlainText(selection: BaseSelection, text: string): void {
  if ($isRangeSelection(selection)) selection.insertRawText(text.replace(/\r\n?/g, '\n'));
}

function plainTextOf(event: PasteCommandType): string {
  if ('clipboardData' in event && event.clipboardData) return event.clipboardData.getData('text/plain');
  if ('dataTransfer' in event && event.dataTransfer) return event.dataTransfer.getData('text/plain');
  return '';
}

/** A paste into a code block keeps the words only (headings, bold… have no place in code). */
function $pasteIntoCode(event: PasteCommandType): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !$findMatchingParent(selection.anchor.getNode(), $isCodeNode)) return false;
  const text = plainTextOf(event);
  if (!text) return false;
  event.preventDefault();
  $insertPlainText(selection, text);
  return true;
}

function $applyStyle(node: LexicalNode, style: string) {
  if ($isTextNode(node)) node.setStyle(mergeTextStyles(node.getStyle(), style));
  else if ($isElementNode(node)) for (const child of node.getChildren()) $applyStyle(child, style);
}

/** <span style="…">: the words keep what the site can show of the span's colour, size and font. */
const SpanStyleRule = defineImportRule({
  name: '@careers/news/span-style',
  match: sel.tag('span'),
  $import: (_ctx, el, $next) => {
    const nodes = $next();
    const style = pastedTextStyle(el.getAttribute('style') ?? '');
    if (style) for (const node of nodes) $applyStyle(node, style);
    return nodes;
  },
});

const ArticlePasteOverlay = defineOverlayRules([SpanStyleRule]);

/** Before the import walk: Docs' flat lists are nested again, and the span rule is put on top. */
const $preparePaste: DOMPreprocessFn = (dom, ctx, $next) => {
  nestListsByAriaLevel(dom);
  ctx.session.update(ImportOverlays, (overlays) => [...overlays, ArticlePasteOverlay]);
  $next();
};

export const ArticlePasteExtension = defineExtension({
  name: '@careers/news/article-paste',
  dependencies: [
    ClipboardDOMImportExtension,
    WordListImportExtension,
    configExtension(DOMImportExtension, { preprocess: [$preparePaste] }),
  ],
  register: (editor) => editor.registerCommand(PASTE_COMMAND, $pasteIntoCode, COMMAND_PRIORITY_HIGH),
});
