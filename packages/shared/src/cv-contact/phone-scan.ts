/**
 * Finds Vietnamese mobile numbers inside one line of text. A number is a run of digit groups joined by spaces,
 * dots, dashes or brackets; only whole groups are combined, so a 12-digit ID card number never yields a phone.
 */
import { normalizeVietnamPhone } from '../phone.js';

export interface PhoneMatch {
  phone: string;
  start: number;
  end: number;
}

interface DigitGroup {
  digits: string;
  start: number;
  end: number;
  hasPlus: boolean;
}

const RUN = /[+(]*\d[\d\s.\-()+]*/g;
const MAX_GAP = 3;

function groupsOf(run: string, offset: number): DigitGroup[] {
  const groups: DigitGroup[] = [];
  for (const m of run.matchAll(/\d+/g)) {
    const start = offset + (m.index ?? 0);
    const before = run.slice(0, m.index ?? 0);
    groups.push({ digits: m[0], start, end: start + m[0].length, hasPlus: /\+[\s(]*$/.test(before) });
  }
  return groups;
}

/** +84 / 84 / 0084 / "+84 (0)" prefixes → normalizeVietnamPhone. */
export function toMobile(digits: string, hasPlus: boolean): string | null {
  let d = digits.replace(/^0084/, '84');
  if (d.startsWith('840') && d.length === 12) d = `84${d.slice(3)}`;
  if (d.startsWith('84') && d.length === 11) return normalizeVietnamPhone(`+${d}`);
  if (hasPlus) return null;
  return normalizeVietnamPhone(d);
}

function windowAt(groups: DigitGroup[], from: number, text: string): { phone: string; last: number } | null {
  let digits = '';
  for (let j = from; j < groups.length; j += 1) {
    const group = groups[j];
    const prev = groups[j - 1];
    if (!group) break;
    if (j > from && prev && group.start - prev.end > MAX_GAP) break;
    if (j > from && prev && /\s-\s/.test(text.slice(prev.end, group.start))) break;
    digits += group.digits;
    if (digits.length > 12) break;
    const phone = digits.length >= 10 ? toMobile(digits, groups[from]?.hasPlus ?? false) : null;
    if (phone) return { phone, last: j };
  }
  return null;
}

/** "0711 000 123 456": a short group glued after the window means it is part of a longer number (bank account). */
function continuesNumber(last: DigitGroup, next: DigitGroup | undefined): boolean {
  return next !== undefined && next.digits.length <= 3 && next.start - last.end <= 1;
}

/** Every mobile number in the text, left to right, with its character span. */
export function scanPhones(text: string): PhoneMatch[] {
  const found: PhoneMatch[] = [];
  for (const run of text.matchAll(RUN)) {
    const groups = groupsOf(run[0], run.index ?? 0);
    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i];
      const hit = group ? windowAt(groups, i, text) : null;
      const lastGroup = hit ? groups[hit.last] : undefined;
      if (!group || !hit || !lastGroup) continue;
      i = hit.last;
      if (continuesNumber(lastGroup, groups[hit.last + 1])) continue;
      found.push({ phone: hit.phone, start: group.start, end: lastGroup.end });
    }
  }
  return found;
}
