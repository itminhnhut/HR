/** Finds the candidate's own mobile number in CV lines. */
import { isCompanyLine, ownerOf, type Owner } from './context.js';
import { scanPhones, type PhoneMatch } from './phone-scan.js';
import { fold, type ContactLine } from './text.js';

/** Labels (folded) that introduce a phone. Icons stay as written. */
const PHONE_LABEL =
  /(?:^|[^a-z])(?:so dien thoai|dien thoai|so dt|sdt|dtdd|dt|di dong|didong|mobile|mob|cell|phone|telephone|tel|zalo|hotline|lien he|contact|hp)(?![a-z])|[☎✆📞📱☏]/g;
/** Labels whose number is not a phone: ID card, tax code, bank account, salary, postal code, fax… */
const OTHER_LABEL =
  /(?:^|[^a-z])(?:cccd|cmnd|cmt|can cuoc|chung minh|mst|ma so thue|tax|stk|so tai khoan|tai khoan|account|bank|ngan hang|passport|ho chieu|mssv|ma sinh vien|student id|bhxh|bao hiem|ma nv|ma nhan vien|fax|luong|salary|thu nhap|zip|postal|ma buu chinh)(?![a-z])/g;
const MONEY_AFTER = /^\s*(?:d|vnd|dong|usd|\$|tr|trieu|k|m)(?![a-z])/;
const EMAIL_OR_URL = /\S+@\S+|(?:https?:\/\/|www\.)\S+/gi;
const LABEL_REACH = 25;

interface PhoneHit {
  phone: string;
  line: ContactLine;
  isLabelled: boolean;
  owner: Owner;
}

interface Context {
  kind: 'phone' | 'other' | 'none';
  owner: Owner;
}

function lastMatch(text: string, pattern: RegExp): { start: number; end: number } | null {
  let last: { start: number; end: number } | null = null;
  for (const m of text.matchAll(pattern)) last = { start: m.index ?? 0, end: (m.index ?? 0) + m[0].length };
  return last;
}

/** Which label, if any, owns the number: the closest one before it on the same line. */
function contextBefore(prefix: string): Context {
  const folded = fold(prefix);
  const phone = lastMatch(folded, PHONE_LABEL);
  const other = lastMatch(folded, OTHER_LABEL);
  if (other && (!phone || other.end > phone.end)) return { kind: 'other', owner: 'unknown' };
  if (!phone || folded.length - phone.end > LABEL_REACH) return { kind: 'none', owner: 'unknown' };
  return { kind: 'phone', owner: ownerOf(prefix.slice(phone.start)) };
}

/** "Điện thoại" / "Phone:" alone on the line above (sidebars put the label above the value). */
function isLabelLine(line: ContactLine | undefined): boolean {
  if (!line) return false;
  const bare = line.folded.replace(/[\s:.\-]+$/, '').trim();
  return bare.length <= 20 && lastMatch(bare, PHONE_LABEL)?.end === bare.length;
}

/** Text to scan: emails/URLs blanked; "Điện thoại: 0346" + next line "718 520" glued back together. */
function scanText(line: ContactLine, next: ContactLine | undefined): string {
  const endsWithPhone = scanPhones(line.text).some((m) => m.end === line.text.length);
  const wrapped = next && /\d$/.test(line.text) && !endsWithPhone ? /^[\d .-]+/.exec(next.text) : null;
  const text = wrapped ? `${line.text} ${wrapped[0]}` : line.text;
  return text.replace(EMAIL_OR_URL, (m) => ' '.repeat(m.length));
}

function hitsInLine(lines: readonly ContactLine[], i: number, line: ContactLine): PhoneHit[] {
  const text = scanText(line, lines[i + 1]);
  return scanPhones(text).flatMap((m: PhoneMatch): PhoneHit[] => {
    if (MONEY_AFTER.test(fold(text.slice(m.end)))) return [];
    const context = contextBefore(text.slice(0, m.start));
    if (context.kind === 'other') return [];
    const startsLine = text.slice(0, m.start).trim().length === 0;
    const isLabelled = context.kind === 'phone' || (startsLine && isLabelLine(lines[i - 1]));
    return [{ phone: m.phone, line, isLabelled, owner: context.owner }];
  });
}

/**
 * Lower is better; null = not the candidate's. "ĐT cá nhân" > labelled > unlabelled; work history and lines about
 * an employer rank low; a company number ("ĐT công ty", "Hotline") never counts in work history or employer lines.
 */
function rank(hit: PhoneHit): number | null {
  const isWork = hit.line.section === 'work';
  const isEmployerLine = isCompanyLine(hit.line.folded);
  if (hit.owner === 'company' && (isWork || isEmployerLine || !hit.isLabelled)) return null;
  const label = hit.owner === 'personal' ? 0 : hit.isLabelled && hit.owner === 'unknown' ? 1 : 2;
  return label + (isWork ? 3 : 0) + (isEmployerLine ? 3 : 0);
}

/** The candidate's mobile as 0xxxxxxxxx, or null. Numbers in reference sections belong to someone else. */
export function findPhone(lines: readonly ContactLine[]): string | null {
  let best: { hit: PhoneHit; rank: number } | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.section === 'reference') continue;
    for (const hit of hitsInLine(lines, i, line)) {
      const r = rank(hit);
      if (r !== null && (!best || r < best.rank)) best = { hit, rank: r };
    }
  }
  return best ? best.hit.phone : null;
}
