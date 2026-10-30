/**
 * Some PDF text layers isolate every accented letter between spaces: "NGUY Ễ N TH Ị   HUY Ề N TRANG",
 * "Đi ệ n tho ạ i". This glues such letters back to their syllable. A line is only touched when the pattern
 * is frequent, so a real one-letter word ("ở", "ý") in ordinary text stays as it is.
 */

const LETTERS = /^\p{L}+$/u;
const TAIL = /^(?:[aeiouy]{0,2}(?:ng|nh|ch|c|m|n|p|t)?)$/i;
const MIN_ISOLATED = 2;
const MIN_RATIO = 0.15;
const MIN_LONGER = 0.3;

interface Piece {
  word: string;
  gapBefore: string;
}

function piecesOf(line: string): Piece[] {
  return [...line.matchAll(/(\s*)(\S+)/g)].map((m) => ({ gapBefore: m[1] ?? '', word: m[2] ?? '' }));
}

function isIsolatedAccent(word: string): boolean {
  return word.length === 1 && word.charCodeAt(0) > 127 && LETTERS.test(word);
}

function needsRepair(pieces: readonly Piece[]): boolean {
  const isolated = pieces.filter((p) => isIsolatedAccent(p.word)).length;
  // Letter-spaced headers ("T R Ầ N  V Ă N") are all one-letter tokens; this pattern keeps longer pieces.
  const longer = pieces.filter((p) => [...p.word].length > 1).length;
  return isolated >= MIN_ISOLATED && isolated / pieces.length >= MIN_RATIO && longer / pieces.length >= MIN_LONGER;
}

/** Glues each isolated accented letter to the letters on its left and to a short syllable tail on its right. */
function glue(pieces: readonly Piece[]): Piece[] {
  const out: Piece[] = [];
  let tailOpen = false;
  for (const piece of pieces) {
    const prev = out[out.length - 1];
    const isSingleGap = piece.gapBefore === ' ';
    const isAccent = isIsolatedAccent(piece.word);
    if (prev && isSingleGap && isAccent && LETTERS.test(prev.word)) {
      out[out.length - 1] = { ...prev, word: prev.word + piece.word };
      tailOpen = true;
    } else if (prev && isSingleGap && tailOpen && piece.word.length > 0 && TAIL.test(piece.word)) {
      out[out.length - 1] = { ...prev, word: prev.word + piece.word };
      tailOpen = false;
    } else {
      out.push(piece);
      tailOpen = isAccent;
    }
  }
  return out;
}

/** Repairs one line; lines without the isolated-accent pattern come back unchanged. */
export function repairIsolatedAccents(line: string): string {
  const pieces = piecesOf(line);
  if (!needsRepair(pieces)) return line;
  return glue(pieces)
    .map((p) => p.gapBefore + p.word)
    .join('');
}
