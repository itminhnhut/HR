/** Addresses that look valid but must never fill the form: template placeholders and misread provider domains. */
import { isProviderDomain } from './email-repair.js';
import { wordList } from './text.js';

/** What CV templates leave in the email box; compared without dots, dashes and underscores. */
const PLACEHOLDER_LOCALS = new Set(
  wordList(`
  yourname youremail yourmail myemail username abcde abc123 tenban tencuaban emailcuaban hoten hovaten hotencuaban
  tenemail diachiemail nguyenvana
`),
);
/** The same, but a person with their own domain can really use these: "mail@nguyenan.dev". */
const PLACEHOLDER_ON_FREE_MAIL = new Set(wordList('email mail name user abc abcd xyz test demo sample example'));
const PLACEHOLDER_DOMAINS = new Set(wordList('domain.com yourdomain.com tenmien.com'));

const PROVIDER_NAMES = wordList('gmail yahoo hotmail outlook icloud');
/** Real domains one letter away from a provider name. */
const REAL_NEIGHBOURS = new Set(wordList('mail ymail gmx email cloud'));

/** One letter changed, added, dropped, or two neighbours swapped ("gmial"). */
function isOneSlipAway(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  let i = 0;
  while (i < a.length && a.charAt(i) === b.charAt(i)) i += 1;
  const [restA, restB] = [a.slice(i), b.slice(i)];
  const isSwap = restA.length > 1 && restA.charAt(0) === restB.charAt(1) && restA.charAt(1) === restB.charAt(0);
  if (isSwap && restA.slice(2) === restB.slice(2)) return true;
  return restA.slice(1) === restB.slice(1) || restA === restB.slice(1) || restA.slice(1) === restB;
}

export function isPlaceholderEmail(email: string): boolean {
  const [local = '', domain = ''] = email.split('@');
  const bare = local.replace(/[._-]/g, '');
  if (PLACEHOLDER_LOCALS.has(bare) || PLACEHOLDER_DOMAINS.has(domain)) return true;
  return PLACEHOLDER_ON_FREE_MAIL.has(bare) && isProviderDomain(domain);
}

/** "gmai1.com", "gmial.com", "gmail.con": an OCR slip or a typo, so the mail would go nowhere or to a stranger. */
export function isMisreadProvider(domain: string): boolean {
  const [name = '', ...rest] = domain.split('.');
  if (name === 'gmail') return rest.join('.') !== 'com';
  if (REAL_NEIGHBOURS.has(name)) return false;
  return PROVIDER_NAMES.some((p) => isOneSlipAway(name, p));
}
