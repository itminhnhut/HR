/** Finds the candidate's own email address in CV lines. */
import { KNOWN_TLDS, repairEmailText } from './email-repair.js';
import { isCompanyLine, ownerOf, type Owner } from './context.js';
import { fold, wordList, type ContactLine } from './text.js';

const EMAIL = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const EMAIL_LABEL = /(?:^|[^a-z])(?:e-?mail|gmail|mail|thu dien tu)\b/;
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

interface EmailHit {
  email: string;
  line: ContactLine;
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

function ownerBefore(repaired: string, at: number): Owner {
  const before = fold(repaired.slice(0, at));
  const label = [...before.matchAll(EMAIL_LABEL_G)].pop();
  return label ? ownerOf(before.slice(label.index ?? 0)) : 'unknown';
}

function hitsInText(text: string, line: ContactLine, isLabelled: boolean): EmailHit[] {
  const repaired = repairEmailText(text, isLabelled);
  const hits: EmailHit[] = [];
  for (const match of repaired.matchAll(EMAIL)) {
    const email = cleanEmail(match[0]);
    const owner = ownerBefore(repaired, match.index ?? 0);
    if (email) hits.push({ email, line, isLabelled, owner });
  }
  const username = hits.length === 0 ? GMAIL_USERNAME.exec(repaired) : null;
  if (username?.[1]) hits.push({ email: `${username[1].toLowerCase()}@gmail.com`, line, isLabelled, owner: 'unknown' });
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

function hitsInLine(lines: readonly ContactLine[], i: number, line: ContactLine): EmailHit[] {
  const isLabelled = EMAIL_LABEL.test(line.folded);
  const hits = hitsInText(line.text, line, isLabelled);
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
 * Lower is better; null = never the candidate's (noreply, tuyendung…). "Email cá nhân" > labelled > unlabelled;
 * work history, employer lines, "Email công việc" and role mailboxes (hr@, info@…) rank low.
 */
function rank(hit: EmailHit): number | null {
  const role = roleWord(localPart(hit.email));
  if (NEVER_LOCALS.has(role)) return null;
  const label = hit.owner === 'personal' ? 0 : hit.isLabelled ? 1 : 2;
  const isRole = ROLE_LOCALS.has(role) ? 6 : 0;
  const isCompany = hit.owner === 'company' || isCompanyLine(hit.line.folded) ? 3 : 0;
  return label + isRole + isCompany + (hit.line.section === 'work' ? 3 : 0);
}

/** The candidate's email (lowercase), or null. Ignores reference sections and company role mailboxes when possible. */
export function findEmail(lines: readonly ContactLine[]): string | null {
  let best: { hit: EmailHit; rank: number } | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.section === 'reference') continue;
    for (const hit of hitsInLine(lines, i, line)) {
      const r = rank(hit);
      if (r !== null && (!best || r < best.rank)) best = { hit, rank: r };
    }
  }
  return best ? best.hit.email : null;
}
