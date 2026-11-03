/**
 * Parses one requirement line, as HR wrote it, into measurable atoms (experience, education, language, licence,
 * skill keywords) or a reason why it cannot be judged from a CV. Each clause of a line (split on ";") is read on its
 * own, so a bonus in one clause does not decide a mandatory part in another.
 */
import type { Atom, KeywordAtom, ParsedRequirement } from './atoms.js';
import { parseEducationRequirement } from './education.js';
import { parseExperienceRequirement } from './experience-req.js';
import { findGroupHits, groupById, subsumedBy } from './keywords.js';
import { languageTerms, parseLanguageRequirements } from './language.js';
import { parseLicenseRequirement } from './license.js';
import { cleanLine, foldClean } from './normalize.js';
import { parseAvailabilityRequirement } from './availability.js';
import { parseLiteralRequirement } from './literal.js';
import {
  bonusPart,
  isPersonalCondition,
  isPreference,
  mandatoryPart,
  softWords,
  withoutPreferenceWords,
} from './soft.js';
import { originalOf } from './text-match.js';

type Label = 'experience' | 'education' | 'other' | null;

const LABEL_RE =
  /^(yeu cau|kinh nghiem(?: lam viec)?|kn|hoc van|trinh do(?: hoc van)?|bang cap|ky nang|ngoai ngu|gioi tinh|do tuoi|tuoi|requirements?|experience|education)\s*:\s*/;
const DECOR_RE = /^\s*(?:[-*+>]+|\d{1,2}[.)](?=\s))\s*/;

function labelOf(folded: string): { label: Label; length: number } {
  const m = LABEL_RE.exec(folded);
  if (!m) return { label: null, length: 0 };
  const name = m[1];
  const label: Label = /^(kinh nghiem|experience|kn)/.test(name)
    ? 'experience'
    : /^(hoc van|trinh do|bang cap|education)/.test(name)
      ? 'education'
      : name.startsWith('yeu cau') || name.startsWith('requirement')
        ? null
        : 'other';
  return { label, length: m[0].length };
}

/** "Sắp xếp" in a line is no request for SAP, nor "nhà cung cấp nước ngoài" for water supply. */
const NOT_A_TOOL = /\bsap (?:xep|dat)\b|\bcap nuoc ngoai\b/g;

function keywordAtom(text: string, atoms: readonly Atom[]): KeywordAtom | null {
  const hasLicense = atoms.some((a) => a.kind === 'license');
  const clean = text.replace(NOT_A_TOOL, (m) => ' '.repeat(m.length));
  let ids = [...new Set(findGroupHits(clean, 'req').map((h) => h.groupId))];
  if (hasLicense) ids = ids.filter((id) => id !== 'vehicle');
  const dropped = new Set(
    ids.flatMap((id) => {
      const group = groupById(id);
      return group ? subsumedBy(group) : [];
    }),
  );
  ids = ids.filter((id) => !dropped.has(id));
  if (ids.length === 0) return null;
  const mode = /\b(hoac|or|mot trong|either|bat ky)\b/.test(text) ? 'any' : 'all';
  const level = /\b(nang cao|advanced|chuyen sau)\b/.test(text)
    ? 'advanced'
    : /\b(thanh thao|proficient|expert|su dung tot)\b/.test(text)
      ? 'proficient'
      : null;
  return { kind: 'keywords', groupIds: ids, mode, ...(level ? { level } : {}) };
}

/** Trade words naming a major or describing what is read in a language are not asked for as skills. */
function withoutTradeTerms(atom: KeywordAtom | null): KeywordAtom | null {
  if (!atom) return null;
  const groupIds = atom.groupIds.filter((id) => groupById(id)?.kind !== 'trade');
  return groupIds.length > 0 ? { ...atom, groupIds } : null;
}

function measurableAtoms(text: string, label: Label): { atoms: Atom[]; trivial: string | null } {
  const atoms: Atom[] = [...parseLanguageRequirements(text)];
  const license = parseLicenseRequirement(text);
  if (license) atoms.push(license);
  const isLanguageLine = atoms.some((a) => a.kind === 'language' || a.kind === 'any-language');
  const named = keywordAtom(text, atoms);
  const keywords = isLanguageLine ? withoutTradeTerms(named) : named;
  const experience = parseExperienceRequirement(text, label === 'experience', keywords !== null);
  if (experience?.kind === 'atom') atoms.push(experience.atom);
  const educationAllowed = experience?.kind !== 'atom' || /\b(tot nghiep|bang|hoc van|trinh do|degree)\b/.test(text);
  const education = educationAllowed ? parseEducationRequirement(text, label === 'education') : null;
  if (education?.kind === 'atom') atoms.push(education.atom);
  // The field of an experience line already covers the terms it names.
  const namesMajors = education?.kind === 'atom' && education.atom.majors.length > 0;
  const asked = namesMajors ? withoutTradeTerms(keywords) : keywords;
  if (asked && experience?.kind !== 'atom') atoms.push(asked);
  const trivial =
    experience?.kind === 'none' ? experience.reason : education?.kind === 'none' ? education.reason : null;
  return { atoms, trivial: atoms.length === 0 ? trivial : null };
}

function softNote(text: string, atoms: readonly Atom[]): string | null {
  let rest = text;
  for (const atom of atoms) {
    const options = atom.kind === 'language' ? [atom] : atom.kind === 'any-language' ? atom.options : [];
    for (const option of options) {
      for (const t of languageTerms(option.language)) rest = rest.replaceAll(t, ' ');
      rest = rest.replace(/\bgiao tiep\b/g, ' ');
    }
  }
  const words = softWords(rest);
  return words.length > 0 ? 'Phần kỹ năng mềm trong yêu cầu HR tự đánh giá khi phỏng vấn' : null;
}

/** The reason of a line nothing could read, which is what the fallback in line-fallback.ts looks at. */
export const UNPARSED_REASON = 'Không tự chấm được yêu cầu này từ CV, HR xem trực tiếp';

function unknownReason(text: string): string {
  if (softWords(text).length > 0) return 'Yêu cầu về tính cách / kỹ năng mềm, HR tự đánh giá khi phỏng vấn';
  if (isPersonalCondition(text)) return 'Điều kiện cá nhân, HR xác nhận khi phỏng vấn';
  return UNPARSED_REASON;
}

/** Swaps folded field/major names for HR's own wording, used in reasons. */
function withOriginalLabels(atoms: Atom[], clean: string): Atom[] {
  return atoms.map((atom) => {
    if (atom.kind === 'experience' && atom.field !== null && atom.field !== 'related') {
      return { ...atom, field: { ...atom.field, label: originalOf(clean, atom.field.label) } };
    }
    if (atom.kind === 'education') return { ...atom, majorLabels: atom.majors.map((m) => originalOf(clean, m)) };
    return atom;
  });
}

const EMPTY: ParsedRequirement = {
  atoms: [],
  bonusAtoms: [],
  trivialReason: null,
  unknownReason: null,
  preference: false,
  softNote: null,
};

export const PREFERENCE_REASON = 'Là điểm cộng (ưu tiên), không bắt buộc nên không tính khi CV không thể hiện';

/** Last resort for lines nothing else understood: availability, or a tool/certificate named word for word. */
function fallbackAtoms(clean: string, text: string): Atom[] {
  const availability = parseAvailabilityRequirement(text);
  if (availability) return [availability];
  if (isPersonalCondition(text)) return [];
  const literal = parseLiteralRequirement(clean);
  return literal ? [literal] : [];
}

interface ClauseReading {
  atoms: Atom[];
  bonusAtoms: Atom[];
  trivial: string | null;
  isBonus: boolean;
  soft: string | null;
  folded: string;
}

function readBody(body: string, clean: string, label: Label): { atoms: Atom[]; trivial: string | null } {
  const text = label === 'experience' ? `kinh nghiem: ${body}` : body;
  const { atoms, trivial } = measurableAtoms(text, label);
  if (trivial) return { atoms: [], trivial };
  return { atoms: withOriginalLabels(atoms.length > 0 ? atoms : fallbackAtoms(clean, text), clean), trivial: null };
}

function readClause(clean: string, label: Label): ClauseReading {
  const folded = foldClean(clean);
  const isBonus = isPreference(folded);
  const body = isBonus ? withoutPreferenceWords(folded) : mandatoryPart(folded);
  const reading = readBody(body, clean, isBonus ? null : label);
  const extra = isBonus ? null : bonusPart(folded);
  const bonusAtoms = extra ? readBody(withoutPreferenceWords(extra), clean, null).atoms : [];
  return {
    atoms: reading.atoms,
    bonusAtoms,
    trivial: reading.trivial,
    isBonus,
    soft: reading.atoms.length > 0 ? softNote(body, reading.atoms) : null,
    folded,
  };
}

function splitClauses(clean: string): string[] {
  return clean
    .split(/;|(?<=\p{Ll})\.\s+(?=\p{Lu})/u)
    .map((c) => c.trim())
    .filter((c) => /[\p{L}\d]/u.test(c));
}

function combineClauses(readings: readonly ClauseReading[], folded: string): ParsedRequirement {
  const mandatory = readings.filter((r) => !r.isBonus);
  const atoms = mandatory.flatMap((r) => r.atoms);
  const bonus = readings.filter((r) => r.isBonus).flatMap((r) => r.atoms);
  const extras = [...mandatory.flatMap((r) => r.bonusAtoms), ...bonus];
  const soft = readings.map((r) => r.soft).find((s) => s !== null) ?? null;
  const softElsewhere =
    readings.length > 1 && readings.some((r) => r.atoms.length === 0 && softWords(r.folded).length > 0);
  const note = soft ?? (softElsewhere ? 'Phần kỹ năng mềm trong yêu cầu HR tự đánh giá khi phỏng vấn' : null);
  if (atoms.length > 0) return { ...EMPTY, atoms, bonusAtoms: extras, softNote: note };
  if (bonus.length > 0) return { ...EMPTY, atoms: bonus, preference: true, softNote: note };
  const trivial = readings.map((r) => r.trivial).find((t) => t !== null);
  if (trivial && readings.every((r) => !r.isBonus)) return { ...EMPTY, trivialReason: trivial };
  const reason = readings.some((r) => r.isBonus) ? PREFERENCE_REASON : unknownReason(folded);
  return { ...EMPTY, unknownReason: reason };
}

/** Parses one requirement line. */
export function parseRequirement(line: string): ParsedRequirement {
  const clean = cleanLine(line);
  const fullFolded = foldClean(clean);
  const decor = DECOR_RE.exec(fullFolded)?.[0].length ?? 0;
  const { label, length } = labelOf(fullFolded.slice(decor));
  const restClean = clean.slice(decor + length);
  const rest = fullFolded.slice(decor + length);
  if (!/[a-z0-9]/.test(rest)) return { ...EMPTY, unknownReason: 'Dòng yêu cầu trống' };
  if (label !== null && /^(khong yeu cau|khong can|khong bat buoc|khong)\b/.test(rest)) {
    const what = label === 'experience' ? 'kinh nghiệm' : label === 'education' ? 'bằng cấp' : 'mục này';
    return { ...EMPTY, trivialReason: `Tin không yêu cầu ${what}` };
  }
  return combineClauses(
    splitClauses(restClean).map((c) => readClause(c, label)),
    fullFolded.slice(decor),
  );
}
