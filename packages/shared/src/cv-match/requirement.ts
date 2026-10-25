/**
 * Parses one requirement line, as HR wrote it, into measurable atoms (experience, education, language, licence,
 * skill keywords) or a reason why it cannot be judged from a CV.
 */
import type { Atom, KeywordAtom, ParsedRequirement } from './atoms.js';
import { parseEducationRequirement } from './education.js';
import { parseExperienceRequirement } from './experience-req.js';
import { findGroupHits, groupById, subsumedBy } from './keywords.js';
import { languageTerms, parseLanguageRequirement } from './language.js';
import { parseLicenseRequirement } from './license.js';
import { cleanLine, fold } from './normalize.js';
import { parseAvailabilityRequirement } from './availability.js';
import { parseLiteralRequirement } from './literal.js';
import { isPersonalCondition, isPreference, mandatoryPart, softWords, withoutPreferenceWords } from './soft.js';
import { originalOf } from './text-match.js';

type Label = 'experience' | 'education' | 'other' | null;

const LABEL_RE =
  /^(yeu cau|kinh nghiem(?: lam viec)?|hoc van|trinh do(?: hoc van)?|bang cap|ky nang|ngoai ngu|gioi tinh|do tuoi|tuoi|requirements?|experience|education)\s*:\s*/;

function stripDecor(folded: string): string {
  return folded.replace(/^\s*(?:[-*+>]+|\d{1,2}[.)](?=\s))\s*/, '').trim();
}

function labelOf(folded: string): { label: Label; rest: string } {
  const m = LABEL_RE.exec(folded);
  if (!m) return { label: null, rest: folded };
  const name = m[1];
  const label: Label = /^(kinh nghiem|experience)/.test(name)
    ? 'experience'
    : /^(hoc van|trinh do|bang cap|education)/.test(name)
      ? 'education'
      : name.startsWith('yeu cau') || name.startsWith('requirement')
        ? null
        : 'other';
  return { label, rest: folded.slice(m[0].length) };
}

function keywordAtom(text: string, atoms: readonly Atom[]): KeywordAtom | null {
  const hasLicense = atoms.some((a) => a.kind === 'license');
  let ids = [...new Set(findGroupHits(text, 'req').map((h) => h.groupId))];
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
  return { kind: 'keywords', groupIds: ids, mode };
}

function measurableAtoms(text: string, label: Label): { atoms: Atom[]; trivial: string | null } {
  const atoms: Atom[] = [];
  const language = parseLanguageRequirement(text);
  if (language) atoms.push(language);
  const license = parseLicenseRequirement(text);
  if (license) atoms.push(license);
  const keywords = keywordAtom(text, atoms);
  const experience = parseExperienceRequirement(text, label === 'experience', keywords !== null);
  if (experience?.kind === 'atom') atoms.push(experience.atom);
  const educationAllowed = experience?.kind !== 'atom' || /\b(tot nghiep|bang|hoc van|trinh do|degree)\b/.test(text);
  const education = educationAllowed ? parseEducationRequirement(text, label === 'education') : null;
  if (education?.kind === 'atom') atoms.push(education.atom);
  if (keywords) atoms.push(keywords);
  const trivial =
    experience?.kind === 'none' ? experience.reason : education?.kind === 'none' ? education.reason : null;
  return { atoms, trivial: atoms.length === 0 ? trivial : null };
}

function softNote(text: string, atoms: readonly Atom[]): string | null {
  let rest = text;
  for (const atom of atoms) {
    if (atom.kind === 'language') {
      for (const t of languageTerms(atom.language)) rest = rest.replaceAll(t, ' ');
      rest = rest.replace(/\bgiao tiep\b/g, ' ');
    }
  }
  const words = softWords(rest);
  return words.length > 0 ? 'Phần kỹ năng mềm trong yêu cầu HR tự đánh giá khi phỏng vấn' : null;
}

function unknownReason(text: string): string {
  if (softWords(text).length > 0) return 'Yêu cầu về tính cách / kỹ năng mềm, HR tự đánh giá khi phỏng vấn';
  if (isPersonalCondition(text)) return 'Điều kiện cá nhân, HR xác nhận khi phỏng vấn';
  return 'Không tự chấm được yêu cầu này từ CV, HR xem trực tiếp';
}

/** Swaps folded field/major names for HR's own wording, used in reasons. */
function withOriginalLabels(atoms: Atom[], line: string): Atom[] {
  const clean = cleanLine(line);
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
  trivialReason: null,
  unknownReason: null,
  preference: false,
  softNote: null,
};

export const PREFERENCE_REASON = 'Là điểm cộng (ưu tiên), không bắt buộc nên không tính khi CV không thể hiện';

/** Last resort for lines nothing else understood: availability, or a tool/certificate named word for word. */
function fallbackAtoms(line: string, text: string): Atom[] {
  const availability = parseAvailabilityRequirement(text);
  if (availability) return [availability];
  const literal = parseLiteralRequirement(line);
  return literal ? [literal] : [];
}

/** Parses one requirement line. */
export function parseRequirement(line: string): ParsedRequirement {
  const folded = stripDecor(fold(line));
  const { label, rest } = labelOf(folded);
  if (!/[a-z0-9]/.test(rest)) return { ...EMPTY, unknownReason: 'Dòng yêu cầu trống' };
  if (label !== null && /^(khong yeu cau|khong can|khong bat buoc|khong)\b/.test(rest)) {
    const what = label === 'experience' ? 'kinh nghiệm' : label === 'education' ? 'bằng cấp' : 'mục này';
    return { ...EMPTY, trivialReason: `Tin không yêu cầu ${what}` };
  }
  const preference = isPreference(rest);
  const body = preference ? withoutPreferenceWords(rest) : mandatoryPart(rest);
  const text = label === 'experience' ? `kinh nghiem: ${body}` : body;
  const { atoms, trivial } = measurableAtoms(text, label);
  if (trivial && !preference) return { ...EMPTY, trivialReason: trivial };
  const all = atoms.length > 0 ? atoms : fallbackAtoms(line, text);
  if (all.length === 0) return { ...EMPTY, unknownReason: preference ? PREFERENCE_REASON : unknownReason(folded) };
  return { ...EMPTY, atoms: withOriginalLabels(all, line), preference, softNote: softNote(text, all) };
}
