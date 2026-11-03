/** Finds the candidate's own email address in CV lines. */
import {
  fieldBefore,
  introducesEmployer,
  introducesSomeoneElse,
  isCompanyLine,
  namesSomeoneElse,
  ownerOf,
  type Owner,
} from './context.js';
import { isProviderDomain, KNOWN_TLDS, repairEmailText } from './email-repair.js';
import { isMisreadProvider, isPlaceholderEmail } from './email-rules.js';
import { fold, wordList, type ContactLine } from './text.js';

const EMAIL = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const EMAIL_LABEL = /(?:^|[^a-z])(?:e\s*-?\s*mail|gmail|mail|thu dien tu)\b/;
const EMAIL_LABEL_G = new RegExp(EMAIL_LABEL.source, 'g');
const GMAIL_USERNAME = /(?:^|[^a-z])gmail\s*:\s*([a-z0-9.]{6,30})\s*$/i;

/** Role mailboxes that belong to a company, not to a person. */
const ROLE_LOCALS = new Set(
  wordList(`
  hr info contact careers career tuyendung noreply no-reply no_reply admin support jobs job recruitment
  recruit hello office lienhe cskh nhansu hotro sales hcns
`),
);
const NEVER_LOCALS = new Set(
  wordList(`
  noreply no-reply no_reply tuyendung careers recruitment jobs
`),
);
/** What sits right before a real address, never inside one: "h***g@", "Nguyễn@" or "hoang . nam@" were cut short. */
const CUT_OFF_BEFORE = /\p{L}$|\p{L}[*•…#]+$|[a-z0-9]\s+[._]\s*$|(?:^|[:\s])[a-z][a-z0-9._-]*\.\s+$/u;
/** "nguyen van an@gmail.com": a lowercase word right before the address may be its first part, unless it is one of these. */
const WORD_BEFORE = /(?:^|[\s:])([a-z][a-z0-9._-]*) $/;
const WORDS_LEADING_TO_ADDRESS = new Set(
  wordList('email e-mail mail gmail contact la is qua tai at to me lien he address dia chi cua toi my'),
);
/** A narrow column wrapped the local part: the line above is its first half. */
const WRAP_HEAD = /^[a-z0-9][a-z0-9._-]{9,}$/;
/** Shorter than a column, or without a mark no heading has: could also be a handle or a site on its own line. */
const WRAP_HEAD_SURE = /^(?=.*[._\d]).{16,}$/;

interface EmailHit {
  email: string;
  line: ContactLine;
  /** The text of the field the address sits in, without the address. */
  field: string;
  isLabelled: boolean;
  owner: Owner;
}

/** "an@gmail.comPhone" / "an@gmail.com0912" → cut the last label back to a known TLD. */
function trimGluedTld(raw: string): string {
  const at = raw.lastIndexOf('.');
  const last = raw.slice(at + 1);
  if (KNOWN_TLDS.has(last.toLowerCase())) return raw;
  for (let len = Math.min(6, last.length - 1); len >= 2; len -= 1) {
    const head = last.slice(0, len);
    const next = last.charAt(len);
    if (KNOWN_TLDS.has(head.toLowerCase()) && /[A-Z0-9]/.test(next)) return raw.slice(0, at + 1) + head;
  }
  return raw;
}

function cleanEmail(raw: string): string | null {
  const email = trimGluedTld(raw)
    .replace(/[.\-_]+$/, '')
    .replace(/^[._%+-]+/, '')
    .toLowerCase();
  const [local = '', domain = ''] = email.split('@');
  if (local.length === 0 || local.length > 64 || local.includes('..')) return null;
  const labels = domain.split('.');
  const tld = labels[labels.length - 1] ?? '';
  if (labels.length < 2 || !/^[a-z]{2,24}$/.test(tld)) return null;
  if (labels.some((l) => l.length === 0 || l.startsWith('-') || l.endsWith('-'))) return null;
  return email;
}

function ownerBefore(field: string): Owner {
  const before = fold(field);
  const label = [...before.matchAll(EMAIL_LABEL_G)].pop();
  return label ? ownerOf(before.slice(label.index ?? 0)) : 'unknown';
}

function isCutOff(before: string): boolean {
  if (CUT_OFF_BEFORE.test(before)) return true;
  const word = WORD_BEFORE.exec(before)?.[1];
  return word !== undefined && !WORDS_LEADING_TO_ADDRESS.has(word);
}

function hitsInText(text: string, line: ContactLine, isLabelled: boolean): EmailHit[] {
  const repaired = repairEmailText(text, isLabelled);
  const hits: EmailHit[] = [];
  for (const match of repaired.matchAll(EMAIL)) {
    const start = match.index ?? 0;
    const email = cleanEmail(match[0]);
    if (!email || isCutOff(repaired.slice(0, start))) continue;
    const field = fieldBefore(repaired, start);
    hits.push({ email, line, field, isLabelled, owner: ownerBefore(field) });
  }
  const username = hits.length === 0 ? GMAIL_USERNAME.exec(repaired) : null;
  if (username?.[1]) {
    hits.push({ email: `${username[1].toLowerCase()}@gmail.com`, line, field: '', isLabelled, owner: 'unknown' });
  }
  return hits;
}

/** A long address that a narrow sidebar wrapped: "Email: nguyenthithanhhuon" / "g.ketoan2024@gmai" / "l.com". */
function wrappedText(lines: readonly ContactLine[], i: number, line: ContactLine, isLabelled: boolean): string | null {
  if (!isLabelled && !/@\S*$/.test(line.text)) return null;
  let text = line.text;
  for (let j = i + 1; j <= i + 2; j += 1) {
    const next = lines[j];
    if (!next || next.isHeading || /\s/.test(next.text)) break;
    text += next.text;
  }
  return text === line.text ? null : text;
}

type WrapHead = 'none' | 'join' | 'unsure';

/** Does the line above hold the first half of this line's address? A heading or a domain never does. */
function wrapHeadAbove(above: ContactLine | undefined, text: string): WrapHead {
  if (!above || above.isHeading || !WRAP_HEAD.test(above.text) || text.startsWith(above.text)) return 'none';
  const lastLabel = above.text.slice(above.text.lastIndexOf('.') + 1);
  if (KNOWN_TLDS.has(lastLabel)) return 'none';
  return WRAP_HEAD_SURE.test(above.text) || text.startsWith('@') ? 'join' : 'unsure';
}

function hitsInLine(lines: readonly ContactLine[], i: number, line: ContactLine): EmailHit[] {
  const isLabelled = EMAIL_LABEL.test(line.folded);
  const head = /^[a-z0-9._-]*@/i.test(line.text) ? wrapHeadAbove(lines[i - 1], line.text) : 'none';
  if (head === 'unsure') return [];
  const text = head === 'join' ? `${lines[i - 1]?.text ?? ''}${line.text}` : line.text;
  const hits = hitsInText(text, line, isLabelled);
  if (hits.length > 0) return hits;
  const wrapped = wrappedText(lines, i, line, isLabelled);
  return wrapped ? hitsInText(wrapped, line, isLabelled) : [];
}

function localPart(email: string): string {
  return email.slice(0, email.indexOf('@'));
}

/** "tuyendung.phugia" → "tuyendung": the role word a company mailbox starts with. */
function roleWord(local: string): string {
  return local.split(/[._\-+\d]/)[0] ?? local;
}

/**
 * Lower is better; null = never the candidate's: noreply and tuyendung, template placeholders, misread providers,
 * someone else's address, a company address in work history. "Email cá nhân" > labelled > unlabelled;
 * work history, employer lines, "Email công việc", school addresses and role mailboxes (hr@, info@…) rank low.
 */
function rank(hit: EmailHit, lines: readonly ContactLine[], i: number): number | null {
  const domain = hit.email.slice(hit.email.indexOf('@') + 1);
  const local = localPart(hit.email);
  const role = roleWord(local);
  if (local.length < 2 || NEVER_LOCALS.has(role)) return null;
  if (isPlaceholderEmail(hit.email) || isMisreadProvider(domain)) return null;
  if (namesSomeoneElse(hit.field) || introducesSomeoneElse(lines[i - 1]?.text)) return null;
  const isWork = hit.line.section === 'work';
  const isCompany = hit.owner === 'company' || isCompanyLine(fold(hit.field));
  if (ROLE_LOCALS.has(role) && (isWork || isCompany) && !isProviderDomain(domain)) return null;
  const isEmployerAddress = isWork || introducesEmployer(lines, i);
  if (isEmployerAddress && !isProviderDomain(domain) && hit.owner !== 'personal') return null;
  const label = hit.owner === 'personal' ? 0 : hit.isLabelled ? 1 : 2;
  const isSchool = hit.owner === 'school' || /(?:^|\.)edu(?:\.|$)/.test(domain) ? 4 : 0;
  return label + (ROLE_LOCALS.has(role) ? 6 : 0) + (isCompany ? 3 : 0) + (isWork ? 3 : 0) + isSchool;
}

/** The candidate's email (lowercase), or null. Ignores reference sections and company role mailboxes when possible. */
export function findEmail(lines: readonly ContactLine[]): string | null {
  let best: { hit: EmailHit; rank: number } | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.section === 'reference') continue;
    for (const hit of hitsInLine(lines, i, line)) {
      const r = rank(hit, lines, i);
      if (r !== null && (!best || r < best.rank)) best = { hit, rank: r };
    }
  }
  return best ? best.hit.email : null;
}
