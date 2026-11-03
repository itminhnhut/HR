/**
 * Outlook on the web pastes in "merge format" by default: it resets the font, size and colour of every piece of text
 * but leaves the content of some inline tags alone. So the copy holds one such tag per line of text, carrying the
 * final look, and no text style on any parent: a parent's style makes the editor add a block inside the tag, which
 * breaks the line. Found by running the mail through RoosterJS, Outlook's open-source editor, and confirmed in Outlook.
 */
const CARRIER = 'abbr';
const NESTED_BLOCKS = new Set(['TABLE', 'DIV', 'P', 'IMG']);
const TEXT_BLOCKS = new Set(['P', 'DIV', 'TD']);
const PARENT_TEXT_STYLES = [
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
];
/** A longer line must wrap as one text, so a change of look inside it is given up. */
const SHORT_LINE = 60;
const BOLD_FROM = 600;

interface Look {
  color: string;
  family: string;
  size: string;
  weight: number;
  spacing: string;
  lineHeight: string;
  decoration: string;
}

interface Piece {
  text: string;
  look: Look;
  href: string | null;
}

type Line = Piece[];

/** The lines of one block, placed before the nested block that follows them (null: at the end). */
interface Stretch {
  before: ChildNode | null;
  lines: Line[];
}

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;
const hasVisibleText = (text: string) => /[^\s]| /.test(text);
const isBlank = (piece: Piece) => piece.text.trim() === '' && !piece.text.includes(' ');

function lookOf(view: Window, element: Element): Look {
  const style = view.getComputedStyle(element);
  return {
    color: style.color,
    family: style.fontFamily.replaceAll('"', "'"),
    size: style.fontSize,
    weight: style.fontWeight === 'bold' ? BOLD_FROM : Number(style.fontWeight) || 400,
    spacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    decoration: style.textDecorationLine,
  };
}

function trimmed(line: Line): Line {
  const start = line.findIndex((piece) => !isBlank(piece));
  if (start < 0) return [];
  const end = line.findLastIndex((piece) => !isBlank(piece));
  return line.slice(start, end + 1);
}

/** Read before anything changes, as the look comes from the styles about to be removed. */
function stretchesOf(view: Window, block: Element): Stretch[] {
  const stretches: Stretch[] = [];
  let lines: Line[] = [[]];
  const flush = (before: ChildNode | null) => {
    const kept = lines.map(trimmed).filter((line) => line.length > 0);
    if (kept.length > 0) stretches.push({ before, lines: kept });
    lines = [[]];
  };
  const walk = (parent: Node) => {
    for (const child of parent.childNodes) {
      if (isElement(child)) {
        if (child.tagName === 'BR') lines.push([]);
        else if (NESTED_BLOCKS.has(child.tagName)) flush(child);
        else walk(child);
        continue;
      }
      const owner = child.parentElement;
      if (child.nodeType !== Node.TEXT_NODE || !owner) continue;
      const text = (child.textContent ?? '').replace(/[ \t\r\n]+/g, ' ');
      const href = owner.closest('a')?.getAttribute('href') ?? null;
      lines[lines.length - 1]?.push({ text, look: lookOf(view, owner), href });
    }
  };
  walk(block);
  flush(null);
  return stretches;
}

function carrierOf(doc: Document, pieces: Line): HTMLElement {
  const carrier = doc.createElement(CARRIER);
  const look = (pieces.find((piece) => !piece.href) ?? pieces[0])?.look;
  if (look) {
    carrier.setAttribute(
      'style',
      `color:${look.color};font-family:${look.family};font-size:${look.size};letter-spacing:${look.spacing};line-height:${look.lineHeight};`,
    );
  }
  for (const piece of pieces) {
    let host: HTMLElement = carrier;
    if (piece.look.weight >= BOLD_FROM) host = host.appendChild(doc.createElement('b'));
    if (piece.href) {
      const link = doc.createElement('a');
      link.setAttribute('href', piece.href);
      link.setAttribute('style', `color:${piece.look.color};text-decoration:${piece.look.decoration};`);
      host = host.appendChild(link);
    }
    host.appendChild(doc.createTextNode(piece.text));
  }
  return carrier;
}

const lookKey = (piece: Piece) => [piece.look.color, piece.look.size, piece.look.family, piece.look.spacing].join('|');

/** Pieces in a row with the same look. A link keeps its own colour inside a carrier, so it never starts a new group. */
function groupsOf(line: Line): Line[] {
  const groups: Line[] = [];
  for (const piece of line) {
    const group = groups[groups.length - 1];
    const previous = group?.[0];
    if (group && previous && (piece.href || isBlank(piece) || lookKey(previous) === lookKey(piece))) group.push(piece);
    else groups.push([piece]);
  }
  return groups;
}

function cellOf(doc: Document, group: Line, isFirst: boolean): HTMLElement {
  const cell = doc.createElement('td');
  cell.setAttribute('valign', 'baseline');
  if (!isFirst) cell.style.paddingLeft = '6px';
  const pieces = group.map((piece, i) => {
    const start = i === 0 ? piece.text.replace(/^[\s ]+/, '') : piece.text;
    return { ...piece, text: i === group.length - 1 ? start.replace(/[\s ]+$/, '') : start };
  });
  // Text directly in a table cell loses its carrier; inside a div it keeps it.
  cell.appendChild(doc.createElement('div')).appendChild(carrierOf(doc, pieces));
  return cell;
}

function lineElement(doc: Document, line: Line, align: string): HTMLElement {
  const box = doc.createElement('div');
  const isCentered = align.includes('center'); // align="center" computes to -webkit-center.
  if (isCentered) box.style.textAlign = 'center';
  else if (align === 'right') box.style.textAlign = 'right';
  // Outlook drops a tel: link, and its text would take the look of what is before it.
  const pieces = line.map((piece) => (piece.href?.startsWith('tel:') ? { ...piece, href: null } : piece));
  const groups = groupsOf(pieces);
  const isShort = pieces.map((piece) => piece.text).join('').length < SHORT_LINE;
  if (groups.length === 1 || !isShort) {
    box.appendChild(carrierOf(doc, pieces));
    return box;
  }
  const table = doc.createElement('table');
  table.setAttribute('role', 'presentation');
  table.setAttribute('cellpadding', '0');
  table.setAttribute('cellspacing', '0');
  if (isCentered) table.setAttribute('align', 'center');
  const row = table.appendChild(doc.createElement('tbody')).appendChild(doc.createElement('tr'));
  groups.forEach((group, i) => row.appendChild(cellOf(doc, group, i === 0)));
  box.appendChild(table);
  return box;
}

function textBlocksOf(view: Window, body: HTMLElement): Element[] {
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const blocks = new Set<Element>();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!hasVisibleText(node.textContent ?? '')) continue;
    let block = node.parentElement;
    while (block && !TEXT_BLOCKS.has(block.tagName)) block = block.parentElement;
    if (block && view.getComputedStyle(block).display !== 'none') blocks.add(block);
  }
  return [...blocks];
}

/** A paste drops padding from a link, so a button's padding moves to its coloured cell. */
function moveButtonPadding(body: HTMLElement) {
  for (const link of body.querySelectorAll<HTMLElement>('a')) {
    const cell = link.parentElement;
    if (cell?.tagName === 'TD' && cell.getAttribute('bgcolor') && link.style.padding) {
      cell.style.padding = link.style.padding;
    }
  }
}

function clearParentStyles(doc: Document, body: HTMLElement) {
  for (const element of body.querySelectorAll<HTMLElement>('*')) {
    if (element.closest(CARRIER)) continue;
    for (const style of PARENT_TEXT_STYLES) element.style.removeProperty(style);
  }
  for (const paragraph of [...body.querySelectorAll<HTMLElement>('p')]) {
    const block = doc.createElement('div');
    block.style.marginBottom = paragraph.style.marginBottom || '0';
    block.append(...paragraph.childNodes);
    paragraph.replaceWith(block);
  }
  for (const hidden of body.querySelectorAll('[style*="display:none"], [style*="display: none"]')) hidden.remove();
}

function rewrite(doc: Document, view: Window): string {
  const body = doc.body;
  moveButtonPadding(body);
  const plans = textBlocksOf(view, body).map((block) => ({
    block,
    stretches: stretchesOf(view, block),
    align: view.getComputedStyle(block).textAlign,
  }));
  for (const { block, stretches, align } of plans) {
    for (const { before, lines } of stretches) {
      for (const line of lines) block.insertBefore(lineElement(doc, line, align), before);
    }
    for (const child of [...block.childNodes]) {
      if (!isElement(child) || !NESTED_BLOCKS.has(child.tagName)) child.remove();
    }
  }
  clearParentStyles(doc, body);
  return body.innerHTML;
}

/** The mail as it should go on the clipboard. Falls back to the mail as it is: a plain paste beats no paste. */
export function flattenForPaste(html: string): string {
  const frame = document.createElement('iframe');
  // Same origin to read the styles; no scripts, though the mail holds none.
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:640px;height:800px;border:0;';
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    if (!doc || !view) return html;
    doc.open();
    doc.write(html);
    doc.close();
    return rewrite(doc, view);
  } catch {
    return html;
  } finally {
    frame.remove();
  }
}
