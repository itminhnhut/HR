/**
 * Undoes what PDF extraction and anti-spam habits do to an email address inside one line:
 * "mailto:", spaces around @ and dots, "[at]" / "(dot)", " at gmail dot com", "gm ail.com", a local part split by spaces.
 */
import { wordList } from './text.js';

export const KNOWN_TLDS = new Set(
  wordList(`
  com vn net org edu gov io info me co biz dev app ai tech xyz us uk jp kr au ca de fr sg online site store
  asia ac name pro
`),
);

const PROVIDERS = wordList(`
  gmail.com yahoo.com.vn yahoo.com outlook.com.vn outlook.com hotmail.com icloud.com live.com ymail.com
  protonmail.com proton.me msn.com
`);

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "@ g m ail . com" → "@gmail.com" for the big free-mail providers. */
const PROVIDER_PATTERNS = PROVIDERS.map((domain) => ({
  domain,
  pattern: new RegExp(`@\\s*${domain.split('').map(escapeRegex).join('\\s*')}(?![a-z0-9])`, 'gi'),
}));

const LOCAL = '[a-z0-9._%+-]+';
const SPOKEN_DOMAIN = '[a-z0-9-]+(?:(?:\\s*\\.\\s*|\\s+dot\\s+)[a-z0-9-]+)+';
const SPOKEN_AT = new RegExp(`(${LOCAL})\\s+at\\s+(${SPOKEN_DOMAIN})`, 'gi');
const LABELLED_SPLIT_LOCAL = new RegExp(
  `((?:^|[^\\p{L}])(?:e-?mail|gmail)\\s*:?\\s*)((?:${LOCAL} ){1,3}${LOCAL}@)`,
  'giu',
);
const DOMAIN_CHAIN = /@([a-z0-9-]+)((?:\s*\.\s*[a-z0-9-]+)*)/gi;

export function isProviderDomain(domain: string): boolean {
  return PROVIDERS.includes(domain.toLowerCase());
}

function lastLabelIsTld(domain: string): boolean {
  const labels = domain.split('.');
  return labels.length > 1 && KNOWN_TLDS.has((labels[labels.length - 1] ?? '').toLowerCase());
}

/** "an at gmail dot com" → "an@gmail.com", only when it clearly is an address (labelled line or a free-mail domain). */
function replaceSpokenAt(line: string, isLabelled: boolean): string {
  return line.replace(SPOKEN_AT, (whole: string, local: string, spokenDomain: string) => {
    const domain = spokenDomain.replace(/\s+dot\s+/gi, '.').replace(/\s*\.\s*/g, '.');
    if (!lastLabelIsTld(domain)) return whole;
    if (!isLabelled && !isProviderDomain(domain)) return whole;
    return `${local}@${domain}`;
  });
}

/** Joins "gmail . com" / "fpt . edu . vn" after an @, stopping before an unrelated sentence ("gmail.com . Phone"). */
function joinDomainChain(line: string): string {
  return line.replace(DOMAIN_CHAIN, (whole: string, first: string, rest: string) => {
    const pairs = [...rest.matchAll(/(\s*\.\s*)([a-z0-9-]+)/gi)];
    let keep = -1;
    let tight = true;
    pairs.forEach((pair, i) => {
      const sep = pair[1] ?? '';
      const label = (pair[2] ?? '').toLowerCase();
      tight = tight && !/\s/.test(sep);
      if (tight || KNOWN_TLDS.has(label)) keep = i;
    });
    const joined = pairs.slice(0, keep + 1).map((p) => `.${p[2] ?? ''}`);
    const tail = pairs
      .slice(keep + 1)
      .map((p) => p[0])
      .join('');
    return `@${first}${joined.join('')}${tail}`;
  });
}

/** Rewrites one line so a plain email regex can find the address. */
export function repairEmailText(line: string, isLabelled: boolean): string {
  let out = line
    .replace(/mailto:/gi, ' ')
    .replace(/\s*[[({]\s*at\s*[\])}]\s*/gi, '@')
    .replace(/\s*[[({]\s*dot\s*[\])}]\s*/gi, '.');
  out = replaceSpokenAt(out, isLabelled);
  out = out.replace(/\s*@\s*/g, '@');
  for (const { domain, pattern } of PROVIDER_PATTERNS) out = out.replace(pattern, `@${domain}`);
  out = joinDomainChain(out);
  if (isLabelled) {
    out = out.replace(
      LABELLED_SPLIT_LOCAL,
      (_w: string, label: string, local: string) => label + local.replace(/ /g, ''),
    );
  }
  return out;
}
