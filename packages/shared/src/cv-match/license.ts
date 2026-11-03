/**
 * Driving licences ("bằng lái B2", "GPLX hạng C", "Driving licence: B"), where a higher car class covers a lower one,
 * and other papers a line asks for by name ("Có chứng chỉ hành nghề Dược", "Có giấy xác nhận kiến thức an toàn thực
 * phẩm"): the kind of paper is general, what it is for comes from the line.
 */
import { askInInterview, result, type AtomResult, type LicenseAtom } from './atoms.js';
import { LIST_ONLY_REASON, unbackedLists, withoutListLines } from './experience-lists.js';
import { synonymsOf } from './fields.js';
import { findGroupHits, groupById } from './keywords.js';
import { isKnownMajor } from './majors.js';
import type { CvDoc, CvLine } from './normalize.js';
import type { SectionKind } from './sections.js';
import { hasAnyTerm, hasTerm, isNegatedAt, snippet } from './text-match.js';

const CAR_CLASSES = ['b1', 'b', 'b2', 'c1', 'c', 'd1', 'd2', 'd', 'e', 'fb2', 'fc', 'fd', 'fe', 'f'];
const MOTORBIKE_CLASSES = ['a1', 'a', 'a2'];

const REQ_TRIGGER =
  /\b(bang lai|gplx|giay phep lai xe|driving licen[cs]e|driver'?s? licen[cs]e|biet lai xe|lai xe (?:o to|oto|may|tai)|bang (?:a1|a2|b1|b2|c|d|e|fb2|fc|fd|fe|f)|hang (?:a1|a2|b1|b2|b|c|d|e|fb2|fc|fd|fe|f))\b(?!\s*(?:anh|tieng|tin hoc|ngoai ngu|english))/;
const DRIVING_CONTEXT = /\b(lai|xe|gplx|licen[cs]e|driv\w*|o to|bang hang [a-f]\d?|bang [c-f]\d?|bang b[12])\b/;
const CLASS_RE =
  /\b(?:bang lai(?: xe)?(?: o to| may)?|gplx|giay phep lai xe|bang|hang|licen[cs]e|class)\s*(?:lai xe\s*)?(?:o to\s*)?(?:hang\s*)?:?\s*(a1|a2|b1|b2|c1|d1|d2|fb2|fc|fd|fe|[abcdef])\b(?!\s*(?:anh|tieng|tin hoc|ngoai ngu|english))/g;
const CLASS_LIST_RE = /^(?:\s*[,/&]\s*(?:va\s+)?(a1|a2|b1|b2|c1|d1|d2|fb2|fc|fd|fe|[abcdef])\b)+/;
const CLASS_START = /\b(?:bang lai|gplx|bang|hang)\b/;
const ANY_LICENSE =
  /\b(bang lai|gplx|giay phep lai xe|driving licen[cs]e|driver'?s? licen[cs]e|biet lai xe|lai xe o to|lai xe may)\b/;

function vehicleOf(cls: string | null, folded: string): LicenseAtom['vehicle'] {
  if (cls) return cls.startsWith('a') ? 'motorbike' : 'car';
  if (/\bxe may\b|\bmotorbike\b|\bmotorcycle\b/.test(folded)) return 'motorbike';
  return /\b(o to|oto|xe hoi|car|xe tai)\b/.test(folded) ? 'car' : 'any';
}

function classesIn(folded: string): string[] {
  CLASS_RE.lastIndex = 0;
  const out: string[] = [];
  for (let m = CLASS_RE.exec(folded); m; m = CLASS_RE.exec(folded)) {
    out.push(m[1]);
    const more = CLASS_LIST_RE.exec(folded.slice(m.index + m[0].length));
    for (const c of more?.[0].split(/[,/&]|\bva\b/) ?? []) if (c.trim().length > 0) out.push(c.trim());
  }
  return out;
}

function rank(cls: string): number {
  const car = CAR_CLASSES.indexOf(cls);
  return car >= 0 ? car : MOTORBIKE_CLASSES.indexOf(cls);
}

/** "3 năm kinh nghiệm lái xe tải" asks for the driving, not for a paper. */
const ASKS_FOR_DRIVING_WORK = /\b(?:kinh nghiem|experience)\b/;
const NAMES_A_PAPER = /\b(?:bang lai|gplx|giay phep lai xe|licen[cs]e)\b/;

/** Licence atom of a requirement line, or null. */
export function parseLicenseRequirement(folded: string): LicenseAtom | null {
  const credential = parseCredential(folded);
  if (credential) return credential;
  if (!REQ_TRIGGER.test(folded)) return null;
  if (ASKS_FOR_DRIVING_WORK.test(folded) && !NAMES_A_PAPER.test(folded)) return null;
  const classes = classesIn(folded).sort((a, b) => rank(a) - rank(b));
  const licenseClass = classes[0] ?? null;
  return { kind: 'license', licenseClass, vehicle: vehicleOf(licenseClass, folded) };
}

interface CvLicense {
  cls: string | null;
  vehicle: LicenseAtom['vehicle'];
  line: CvLine;
}

/** Studying for it, or handling other people's licences at a driving school, is not holding one. */
const IN_PROGRESS =
  /\b(dang hoc|dang thi|du kien|sap thi|chuan bi thi|applying for|in progress|learning|het han|expired|dang lam thu tuc)\b/;
const OTHERS_LICENCE = /\b(hoc vien|tiep nhan|day lai|giang day|dao tao lai xe|ho so)\b/;
const SKIPPED_SECTIONS: ReadonlySet<SectionKind> = new Set(['interests', 'references', 'objective']);
/** "Bằng lái:" alone on its line, the class on the next: columns and forms write it so. */
const LICENCE_LABEL = /^\W*(?:bang lai(?: xe)?|gplx|giay phep lai xe|driving licen[cs]e)\s*:?\s*$/;

function licenceText(doc: CvDoc, line: CvLine): string {
  const next = LICENCE_LABEL.test(line.folded) ? doc.lines[line.index + 1] : undefined;
  return next ? `${line.folded} ${next.folded}` : line.folded;
}

function licencesOn(line: CvLine, folded: string): CvLicense[] {
  if (!DRIVING_CONTEXT.test(folded) || SKIPPED_SECTIONS.has(line.section)) return [];
  if (IN_PROGRESS.test(folded) || (line.section === 'experience' && OTHERS_LICENCE.test(folded))) return [];
  const any = ANY_LICENSE.exec(folded);
  // "Bằng B1" under languages is a language paper; "Bằng lái xe B2" is a licence wherever it was put.
  if (!any && line.section === 'languages') return [];
  const start = any ?? CLASS_START.exec(folded);
  if (start && isNegatedAt(folded, start.index + start[0].length)) return [];
  const classes = classesIn(folded);
  const held = classes.map((cls) => ({ cls, vehicle: vehicleOf(cls, folded), line }));
  return classes.length === 0 && any ? [{ cls: null, vehicle: vehicleOf(null, folded), line }] : held;
}

function cvLicenses(doc: CvDoc): CvLicense[] {
  return doc.lines.flatMap((line) => licencesOn(line, licenceText(doc, line)));
}

/** "Chưa có bằng lái ô tô": a CV saying so has answered, whatever a list of keywords claims. */
function deniedLine(doc: CvDoc): CvLine | undefined {
  return doc.lines.find((line) => {
    const any = ANY_LICENSE.exec(line.folded);
    return any !== null && isNegatedAt(line.folded, any.index + any[0].length);
  });
}

/** FC is C with a trailer: it covers C and below, never D or E. An F class is only covered by itself. */
function covers(have: string, want: string): boolean {
  if (want.startsWith('f')) return have === want || (want === 'f' && have.startsWith('f'));
  const held = have.startsWith('f') ? have.slice(1) || 'b2' : have;
  const sameTrack =
    (CAR_CLASSES.includes(held) && CAR_CLASSES.includes(want)) ||
    (MOTORBIKE_CLASSES.includes(held) && MOTORBIKE_CLASSES.includes(want));
  return sameTrack && rank(held) >= rank(want);
}

function classVerdict(atom: LicenseAtom, want: string, list: CvLicense[], substantive: boolean): AtomResult {
  const label = `bằng lái ${want.toUpperCase()}`;
  const ok = list.find((l) => l.cls !== null && covers(l.cls, want));
  if (ok) return result('met', `CV ghi bằng lái ${ok.cls?.toUpperCase()}, yêu cầu ${label}`, snippet(ok.line));
  const lower = list.find((l) => l.cls !== null && l.vehicle === atom.vehicle);
  if (lower)
    return result('unmet', `CV ghi bằng lái ${lower.cls?.toUpperCase()}, yêu cầu ${label}`, snippet(lower.line));
  const vague = list.find((l) => l.cls === null);
  if (vague) return result('unknown', `CV có nhắc bằng lái nhưng không rõ hạng, yêu cầu ${label}`, snippet(vague.line));
  if (list.length > 0) {
    const have = list.map((l) => l.cls?.toUpperCase()).join(', ');
    return result('unmet', `CV chỉ ghi bằng lái ${have}, yêu cầu ${label}`, snippet(list[0].line));
  }
  if (atom.vehicle === 'motorbike') return askInInterview(`CV thường không ghi ${label}, HR hỏi khi phỏng vấn`);
  if (!substantive) return result('unknown', `CV quá ít nội dung để kết luận về ${label}, HR xem trực tiếp`);
  return result('unmet', `Không thấy ${label} trong CV`);
}

function otherVehicle(atom: LicenseAtom, list: readonly CvLicense[]): AtomResult {
  const first = list[0];
  const shown = list.map((l) => l.cls?.toUpperCase() ?? '').filter((c) => c.length > 0);
  if (atom.vehicle === 'car' && shown.length === list.length) {
    return result('unmet', `CV chỉ ghi bằng lái ${shown.join(', ')}, yêu cầu bằng lái ô tô`, snippet(first.line));
  }
  return result('unknown', 'CV có nhắc bằng lái nhưng không rõ loại xe', snippet(first.line));
}

function judgeDriving(atom: LicenseAtom, doc: CvDoc, substantive: boolean): AtomResult {
  const list = cvLicenses(doc);
  if (atom.licenseClass) return classVerdict(atom, atom.licenseClass, list, substantive);
  const fit = list.find((l) => atom.vehicle === 'any' || l.vehicle === atom.vehicle);
  if (fit) return result('met', 'CV có bằng lái xe', snippet(fit.line));
  if (list.length > 0) return otherVehicle(atom, list);
  if (atom.vehicle === 'motorbike') return askInInterview('CV thường không ghi bằng lái xe máy, HR hỏi khi phỏng vấn');
  if (!substantive) return result('unknown', 'CV quá ít nội dung để kết luận về bằng lái xe, HR xem trực tiếp');
  return result('unmet', 'Không thấy bằng lái xe trong CV');
}

/** A list of keywords with nothing behind it shows no licence, and does not rule one out. */
function evaluateDriving(atom: LicenseAtom, doc: CvDoc, substantive: boolean): AtomResult {
  const lists = unbackedLists(doc);
  const own = withoutListLines(doc, lists);
  const verdict = judgeDriving(atom, own, substantive);
  if (lists.length === 0 || verdict.verdict === 'met' || verdict.evidence) return verdict;
  const denied = atom.vehicle === 'motorbike' ? undefined : deniedLine(own);
  if (denied) return result('unmet', 'CV ghi chưa có bằng lái xe', snippet(denied));
  const listed = judgeDriving(atom, doc, substantive);
  return listed.verdict === 'met' ? result('unknown', LIST_ONLY_REASON, listed.evidence) : verdict;
}

interface CredentialOption {
  /** "hanh nghe" or "nghe" when the paper is named by that form; it may stand without the subject in a CV. */
  form: string | null;
  /** What the paper is for, folded. */
  subject: string;
}

/** Asks for a paper by name; the options it accepts, any one of them. */
export interface CredentialAtom extends LicenseAtom {
  credential: CredentialOption[];
}

function isCredentialAtom(atom: LicenseAtom): atom is CredentialAtom {
  return 'credential' in atom;
}

/** "Thẻ" and "thể" fold alike, so a card counts only with what cannot follow "có thể". */
const PAPER_WORD = 'giay chung nhan|giay xac nhan|giay phep|chung chi|chung nhan|bang nghe|the an toan';
const ASKS_PAPER = new RegExp(`^\\W*(?:(?:yeu cau|can|phai|bat buoc|da)\\s+)*(?:(?:co|so huu)\\s+)?(?=${PAPER_WORD})`);
const PAPER_AT_START = new RegExp(`^(?:${PAPER_WORD})\\b\\s*`);
const FORM_AT_START = /^(hanh nghe|nghe)\b\s*/;
const SUBJECT_FILLER = /^(?:ve|kien thuc|cua)\s+/;
/** Conditions on the paper, not what it is for. */
const PAPER_CONDITION = /\s*\b(?:con (?:han|hieu luc|gia tri)|tro len|bac \d|level \d|hang \d|tuong duong)\b.*$/;
/** Left to the language reader and to the search by name. */
const HANDLED_ELSEWHERE = /\b(?:toeic|ielts|toefl|jlpt|hsk|topik|vstep|tieng|ngoai ngu|tin hoc|lai xe (?:o to|may))\b/;

function credentialOption(part: string, isAnotherPaper: boolean): CredentialOption {
  const noun = PAPER_AT_START.exec(part);
  // "thẻ an toàn điện": "an toàn" is part of what the card is for.
  const rest =
    isAnotherPaper && part.startsWith('the an toan') ? part.slice(3).trim() : part.slice(noun?.[0].length ?? 0);
  const namedTrade = part.startsWith('bang nghe') ? 'nghe' : null;
  const form = namedTrade ?? FORM_AT_START.exec(rest)?.[1] ?? null;
  const subject = rest.replace(FORM_AT_START, '').replace(SUBJECT_FILLER, '').trim();
  return { form, subject };
}

/** "bằng nghề hoặc chứng chỉ nghề nấu ăn": the last option says what both are for. */
function shareSubject(options: readonly CredentialOption[]): CredentialOption[] {
  const subject = [...options].reverse().find((o) => o.subject.length > 0)?.subject ?? '';
  return options.map((o) => (o.subject.length > 0 ? o : { ...o, subject }));
}

function parseCredential(folded: string): CredentialAtom | null {
  const asks = ASKS_PAPER.exec(folded);
  if (!asks || HANDLED_ELSEWHERE.test(folded)) return null;
  const body = folded.slice(asks[0].length).replace(PAPER_CONDITION, '');
  // A paper the vocabulary knows has its own names and its own check.
  if (findGroupHits(body, 'req').some((h) => groupById(h.groupId)?.kind === 'cert')) return null;
  const parts = body
    .split(/\bhoac\b|\bor\b|,|\//)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const options = shareSubject(parts.map((part) => credentialOption(part, PAPER_AT_START.test(part))));
  // One bare name is a product or an exam ("chứng chỉ PMP"): the search by name reads those.
  if (options.some((o) => o.subject.length === 0 || (o.form === null && !o.subject.includes(' ')))) return null;
  return { kind: 'license', licenseClass: null, vehicle: 'any', credential: options };
}

const CV_PAPER = /\b(?:chung chi|chung nhan|giay (?:chung nhan|xac nhan|phep)|bang nghe|the an toan)\b/;
const CV_FOREIGN_PAPER = /\b(?:certificate|certified|certification|licen[cs]e|permit|card)\b/;
const NOT_HELD =
  /\b(?:chua|khong|het han|expired|dang hoc|dang thi|dang xu ly|dang cho|dang lam thu tuc|du kien|sap thi|chuan bi thi|bi thu hoi)\b/;
/** What follows the form when it names something else: up to a number, a condition or the end of the clause. */
const AFTER_FORM = /^\s*([a-z ]*?)\s*(?:\bso\b|\bcon\b|\bbac\b|\bcap\b|\bnam\b|\d|[,:(.]|$)/;

function hasWords(text: string, subject: string): boolean {
  return subject.split(' ').every((word) => hasTerm(text, word));
}

/** "ATTP" or "ATVSTP" for "an toàn thực phẩm": its letters start the words, in order, with few others. */
function hasInitials(text: string, subject: string): boolean {
  const words = subject.split(' ');
  if (words.length < 3) return false;
  const initials = words.map((w) => w.charAt(0)).join('');
  const inOrder = (token: string) => {
    let at = 0;
    for (const c of token) if (c === initials[at]) at += 1;
    return at === initials.length && token.startsWith(initials.charAt(0));
  };
  return (text.match(/[a-z]{3,}/g) ?? []).some((t) => t.length <= initials.length + 2 && inOrder(t));
}

/** Other names of what the paper is for: a field's only when the paper is for that field and no more. */
function subjectNames(subject: string): string[] {
  return subject.split(' ').length <= 2 ? synonymsOf(subject) : [];
}

function namesSubject(text: string, subject: string): boolean {
  return hasWords(text, subject) || hasInitials(text, subject) || hasAnyTerm(text, subjectNames(subject));
}

type PaperReading = 'held' | 'denied' | 'other-field' | 'open' | null;

/** The name of the form with what follows it in this clause: "" when the paper stands bare. */
function afterForm(clause: string, form: string): string | null {
  const at = new RegExp(`\\b(?:${form === 'nghe' ? 'chung chi nghe|bang nghe' : 'chung chi hanh nghe'})\\b`).exec(
    clause,
  );
  if (!at) return null;
  return AFTER_FORM.exec(clause.slice(at.index + at[0].length))?.[1]?.trim() ?? '';
}

function readByForm(clause: string, option: CredentialOption, doc: CvDoc): PaperReading {
  const named = option.form === null ? null : afterForm(clause, option.form);
  if (named === null) return null;
  if (NOT_HELD.test(clause)) return 'denied';
  // A practice certificate is for one named profession; other papers may name the same trade in other words.
  const isOtherField = option.form === 'hanh nghe' || (isKnownMajor(named) && isKnownMajor(option.subject));
  if (named.length > 0) return isOtherField ? 'other-field' : 'open';
  return doc.lines.some((l) => !CV_PAPER.test(l.folded) && namesSubject(l.folded, option.subject)) ? 'held' : 'open';
}

/** "Trung cấp Hàn": a vocational degree is a trade paper, and one in other words may be the one asked for. */
const VOCATIONAL_LEVEL = /\b(?:trung cap|cao dang|so cap|vocational)\b/;

function readClause(clause: string, option: CredentialOption, doc: CvDoc): PaperReading {
  const hasPaper = CV_PAPER.test(clause);
  const isForeign = CV_FOREIGN_PAPER.test(clause);
  const isVocational = option.form === 'nghe' && VOCATIONAL_LEVEL.test(clause);
  if (namesSubject(clause, option.subject)) {
    if (NOT_HELD.test(clause) && hasPaper) return 'denied';
    if (hasPaper || isForeign || isVocational) return 'held';
    return option.subject.split(' ').length >= 3 ? 'open' : null;
  }
  return readByForm(clause, option, doc) ?? (isForeign || isVocational ? 'open' : null);
}

const RANK: readonly PaperReading[] = ['held', 'denied', 'other-field', 'open'];

function bestPaper(doc: CvDoc, options: readonly CredentialOption[]): { reading: PaperReading; line: CvLine | null } {
  const found = doc.lines
    .filter((line) => !SKIPPED_SECTIONS.has(line.section))
    .flatMap((line) =>
      line.folded
        .replace(/\bcchn\b/g, 'chung chi hanh nghe')
        .split(/\.(?:\s|$)|;|\s\/\s/)
        .flatMap((clause) => options.map((option) => ({ reading: readClause(clause, option, doc), line }))),
    );
  for (const reading of RANK) {
    const hit = found.find((f) => f.reading === reading);
    if (hit) return hit;
  }
  return { reading: null, line: null };
}

function evaluateCredential(atom: CredentialAtom, doc: CvDoc, substantive: boolean): AtomResult {
  const lists = unbackedLists(doc);
  const { reading, line } = bestPaper(withoutListLines(doc, lists), atom.credential);
  const quote = line ? snippet(line) : null;
  if (reading === 'held') return result('met', 'CV có giấy tờ đúng yêu cầu', quote);
  if (reading === 'denied') return result('unmet', 'CV ghi chưa có hoặc đã hết hạn giấy tờ này', quote);
  if (reading === 'other-field') return result('unmet', 'CV có giấy tờ của ngành khác, không đúng yêu cầu', quote);
  if (reading === 'open') return result('unknown', 'CV có giấy tờ ghi khác tên, HR xem có đúng yêu cầu không', quote);
  const listed = bestPaper({ ...doc, lines: lists }, atom.credential);
  if (listed.reading === 'held') return result('unknown', LIST_ONLY_REASON, listed.line ? snippet(listed.line) : null);
  if (!substantive) return result('unknown', 'CV quá ít nội dung để kết luận về giấy tờ này, HR xem trực tiếp');
  return result('unmet', 'Không thấy giấy tờ yêu cầu trong CV');
}

/** Licence or named paper verdict. */
export function evaluateLicense(atom: LicenseAtom, doc: CvDoc, substantive: boolean): AtomResult {
  return isCredentialAtom(atom) ? evaluateCredential(atom, doc, substantive) : evaluateDriving(atom, doc, substantive);
}
