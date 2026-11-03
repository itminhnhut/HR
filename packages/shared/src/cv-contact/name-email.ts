/** How far a candidate name agrees with the name people put in their own email address. */
import { fold } from './text.js';

/** Middle names an address usually leaves out: "huonggiang.vu" for Vũ Thị Hương Giang. */
const SKIPPABLE = new Set(['thi', 'van']);
const MIN_LETTERS = 5;

export interface NameAgreement {
  /** At least two words are in the address, and so is every other word of the name but a skippable middle one. */
  isFull: boolean;
  /** How many words of the name are in the address. */
  count: number;
}

const NONE: NameAgreement = { isFull: false, count: 0 };

/** "lamthietke" → ["lam", "thiet", "ke"]: splits a token exactly into name words, each used once; null if it cannot. */
function splitToken(token: string, words: readonly string[]): string[] | null {
  if (token.length === 0) return [];
  for (const word of words) {
    if (!word || !token.startsWith(word)) continue;
    const rest = splitToken(
      token.slice(word.length),
      words.filter((w) => w !== word),
    );
    if (rest) return [word, ...rest];
  }
  return null;
}

/** Whole tokens only: "thanh.le" does not hold the name "Lê An", though "thanh" contains "an". */
export function agreementWith(email: string | null, words: readonly string[]): NameAgreement {
  if (!email) return NONE;
  const folded = words.map((w) => fold(w).replace(/['’-]/g, ''));
  const local = email.slice(0, email.indexOf('@')).replace(/\d+/g, '');
  const tokens = local.split(/[._+-]+/).filter(Boolean);
  const found = tokens.flatMap((token) => splitToken(token, folded) ?? []);
  const unique = new Set(found);
  const letters = [...unique].join('').length;
  if (unique.size === 0 || letters < MIN_LETTERS) return NONE;
  const isFull = unique.size >= 2 && folded.every((w) => unique.has(w) || SKIPPABLE.has(w));
  return { isFull, count: unique.size };
}
