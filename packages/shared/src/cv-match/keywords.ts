/**
 * Skill / tool / certificate / asset dictionary (folded, lowercase, no tones).
 * A requirement mentioning any `terms` of a group asks for that group; the CV satisfies it with any of the group's
 * own terms, any covered group (`covers`, e.g. "CRM" ← HubSpot) or, for `allOf`, every listed group together
 * ("tin học văn phòng" ← Word + Excel).
 */
import { fold } from './normalize.js';
import type { Span } from './text-match.js';
import { findTerm } from './text-match.js';

export type GroupKind = 'tool' | 'skill' | 'cert' | 'asset';

export interface KeywordGroup {
  id: string;
  label: string;
  kind: GroupKind;
  /** Terms recognised in both requirement and CV. */
  terms: string[];
  /** Extra terms recognised only in requirements (too ambiguous inside a CV, e.g. "ts"). */
  reqOnly?: string[];
  /** Any one of these groups satisfies this one (and is dropped from a requirement naming both). */
  covers?: string[];
  /** All of these groups together satisfy this one. */
  allOf?: string[];
  /** Groups only listed as examples next to this one in a requirement ("Office (Word, Excel, PowerPoint)"). */
  examples?: string[];
}

type RawGroup = KeywordGroup;

const RAW: RawGroup[] = [
  {
    id: 'excel',
    label: 'Excel',
    kind: 'tool',
    terms: ['excel', 'google sheets', 'google sheet', 'bảng tính', 'spreadsheet', 'spreadsheets'],
  },
  {
    id: 'word',
    label: 'Word',
    kind: 'tool',
    terms: ['word', 'ms word', 'microsoft word', 'google docs', 'soạn thảo văn bản'],
  },
  {
    id: 'powerpoint',
    label: 'PowerPoint',
    kind: 'tool',
    terms: ['powerpoint', 'power point', 'google slides', 'trình chiếu'],
  },
  {
    id: 'office',
    label: 'tin học văn phòng',
    kind: 'tool',
    terms: [
      'tin học văn phòng',
      'ms office',
      'microsoft office',
      'office 365',
      'microsoft 365',
      'vi tính văn phòng',
      'tin học vp',
    ],
    reqOnly: ['office'],
    covers: ['it-cert'],
    allOf: ['word', 'excel'],
    examples: ['powerpoint'],
  },
  {
    id: 'computer',
    label: 'tin học / máy tính',
    kind: 'skill',
    terms: ['tin học', 'vi tính', 'máy tính', 'computer', 'computer skills'],
    covers: ['office', 'word', 'excel', 'powerpoint', 'it-cert'],
  },
  {
    id: 'it-cert',
    label: 'chứng chỉ tin học',
    kind: 'cert',
    terms: [
      'chứng chỉ tin học',
      'chứng chỉ ic3',
      'chứng chỉ mos',
      'ic3',
      'mos',
      'tin học a',
      'tin học b',
      'ứng dụng cntt cơ bản',
      'ứng dụng công nghệ thông tin cơ bản',
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    kind: 'tool',
    terms: ['crm', 'phần mềm crm', 'hệ thống crm'],
    covers: ['salesforce', 'hubspot', 'bitrix', 'zoho', 'getfly', 'odoo'],
  },
  { id: 'salesforce', label: 'Salesforce', kind: 'tool', terms: ['salesforce'] },
  { id: 'hubspot', label: 'HubSpot', kind: 'tool', terms: ['hubspot'] },
  { id: 'bitrix', label: 'Bitrix24', kind: 'tool', terms: ['bitrix', 'bitrix24'] },
  { id: 'zoho', label: 'Zoho', kind: 'tool', terms: ['zoho', 'zoho crm'] },
  { id: 'getfly', label: 'Getfly', kind: 'tool', terms: ['getfly', 'getfly crm'] },
  { id: 'odoo', label: 'Odoo', kind: 'tool', terms: ['odoo'] },
  { id: 'sap', label: 'SAP', kind: 'tool', terms: ['sap', 'sap b1', 'sap erp', 'sap business one'] },
  { id: 'erp', label: 'ERP', kind: 'tool', terms: ['erp', 'phần mềm erp'], covers: ['sap', 'odoo'] },
  { id: 'misa', label: 'MISA', kind: 'tool', terms: ['misa', 'misa sme', 'misa amis'] },
  { id: 'fast', label: 'Fast Accounting', kind: 'tool', terms: ['fast accounting', 'phần mềm fast', 'kế toán fast'] },
  { id: 'bravo', label: 'Bravo', kind: 'tool', terms: ['bravo', 'phần mềm bravo'] },
  {
    id: 'accounting-sw',
    label: 'phần mềm kế toán',
    kind: 'tool',
    terms: ['phần mềm kế toán', 'kế toán máy', 'accounting software'],
    covers: ['misa', 'fast', 'bravo', 'sap', 'odoo'],
  },
  {
    id: 'acc-chief-cert',
    label: 'chứng chỉ kế toán trưởng',
    kind: 'cert',
    terms: ['chứng chỉ kế toán trưởng', 'kế toán trưởng'],
  },
  { id: 'acca', label: 'ACCA', kind: 'cert', terms: ['acca'] },
  { id: 'cpa', label: 'CPA', kind: 'cert', terms: ['cpa'] },
  { id: 'cfa', label: 'CFA', kind: 'cert', terms: ['cfa'] },
  { id: 'photoshop', label: 'Photoshop', kind: 'tool', terms: ['photoshop', 'adobe photoshop'] },
  { id: 'illustrator', label: 'Illustrator', kind: 'tool', terms: ['illustrator', 'adobe illustrator'] },
  { id: 'figma', label: 'Figma', kind: 'tool', terms: ['figma'] },
  { id: 'canva', label: 'Canva', kind: 'tool', terms: ['canva'] },
  { id: 'corel', label: 'CorelDRAW', kind: 'tool', terms: ['corel', 'coreldraw', 'corel draw'] },
  { id: 'indesign', label: 'InDesign', kind: 'tool', terms: ['indesign', 'adobe indesign'] },
  { id: 'lightroom', label: 'Lightroom', kind: 'tool', terms: ['lightroom'] },
  { id: 'premiere', label: 'Premiere', kind: 'tool', terms: ['premiere', 'premiere pro', 'adobe premiere'] },
  { id: 'after-effects', label: 'After Effects', kind: 'tool', terms: ['after effects', 'after effect'] },
  { id: 'capcut', label: 'CapCut', kind: 'tool', terms: ['capcut'] },
  {
    id: 'design-tools',
    label: 'phần mềm thiết kế',
    kind: 'tool',
    terms: ['phần mềm thiết kế', 'công cụ thiết kế', 'phần mềm đồ họa', 'bộ adobe', 'adobe'],
    covers: ['photoshop', 'illustrator', 'figma', 'canva', 'corel', 'indesign', 'lightroom'],
  },
  {
    id: 'video-tools',
    label: 'dựng video',
    kind: 'skill',
    terms: ['dựng video', 'edit video', 'chỉnh sửa video', 'video editing', 'phần mềm dựng video'],
    covers: ['premiere', 'after-effects', 'capcut'],
  },
  { id: 'autocad', label: 'AutoCAD', kind: 'tool', terms: ['autocad', 'auto cad'] },
  { id: 'sketchup', label: 'SketchUp', kind: 'tool', terms: ['sketchup'] },
  { id: '3dsmax', label: '3ds Max', kind: 'tool', terms: ['3ds max', '3dsmax'] },
  { id: 'revit', label: 'Revit', kind: 'tool', terms: ['revit'] },
  { id: 'react', label: 'React', kind: 'tool', terms: ['react', 'reactjs', 'react.js'] },
  { id: 'react-native', label: 'React Native', kind: 'tool', terms: ['react native'] },
  { id: 'vue', label: 'Vue', kind: 'tool', terms: ['vue', 'vuejs', 'vue.js'] },
  { id: 'angular', label: 'Angular', kind: 'tool', terms: ['angular', 'angularjs'] },
  { id: 'nextjs', label: 'Next.js', kind: 'tool', terms: ['next.js', 'nextjs'] },
  { id: 'nodejs', label: 'Node.js', kind: 'tool', terms: ['node.js', 'nodejs'], reqOnly: ['node'] },
  { id: 'typescript', label: 'TypeScript', kind: 'tool', terms: ['typescript'], reqOnly: ['ts'] },
  { id: 'javascript', label: 'JavaScript', kind: 'tool', terms: ['javascript', 'es6'], reqOnly: ['js'] },
  { id: 'html', label: 'HTML', kind: 'tool', terms: ['html', 'html5'] },
  { id: 'css', label: 'CSS', kind: 'tool', terms: ['css', 'css3', 'scss', 'sass', 'tailwind', 'tailwindcss'] },
  { id: 'python', label: 'Python', kind: 'tool', terms: ['python'] },
  { id: 'java', label: 'Java', kind: 'tool', terms: ['java'] },
  { id: 'csharp', label: 'C#', kind: 'tool', terms: ['c#'] },
  { id: 'dotnet', label: '.NET', kind: 'tool', terms: ['.net', 'asp.net', 'dotnet', '.net core'] },
  { id: 'php', label: 'PHP', kind: 'tool', terms: ['php'] },
  { id: 'laravel', label: 'Laravel', kind: 'tool', terms: ['laravel'] },
  { id: 'golang', label: 'Go', kind: 'tool', terms: ['golang'] },
  { id: 'sql', label: 'SQL', kind: 'tool', terms: ['sql'], covers: ['mysql', 'postgresql', 'sqlserver', 'oracle'] },
  { id: 'mysql', label: 'MySQL', kind: 'tool', terms: ['mysql'] },
  { id: 'postgresql', label: 'PostgreSQL', kind: 'tool', terms: ['postgresql', 'postgres'] },
  { id: 'sqlserver', label: 'SQL Server', kind: 'tool', terms: ['sql server', 'ms sql', 'mssql'] },
  { id: 'oracle', label: 'Oracle', kind: 'tool', terms: ['oracle', 'oracle db'] },
  { id: 'mongodb', label: 'MongoDB', kind: 'tool', terms: ['mongodb', 'mongo'] },
  { id: 'git', label: 'Git', kind: 'tool', terms: ['git', 'github', 'gitlab'] },
  { id: 'docker', label: 'Docker', kind: 'tool', terms: ['docker'] },
  { id: 'aws', label: 'AWS', kind: 'tool', terms: ['aws', 'amazon web services'] },
  { id: 'linux', label: 'Linux', kind: 'tool', terms: ['linux', 'ubuntu'] },
  { id: 'flutter', label: 'Flutter', kind: 'tool', terms: ['flutter'] },
  { id: 'kotlin', label: 'Kotlin', kind: 'tool', terms: ['kotlin'] },
  { id: 'swift', label: 'Swift', kind: 'tool', terms: ['swift'] },
  { id: 'seo', label: 'SEO', kind: 'skill', terms: ['seo'] },
  { id: 'google-ads', label: 'Google Ads', kind: 'tool', terms: ['google ads', 'adwords', 'google adwords'] },
  {
    id: 'facebook-ads',
    label: 'Facebook Ads',
    kind: 'tool',
    terms: ['facebook ads', 'fb ads', 'quảng cáo facebook', 'meta ads'],
  },
  { id: 'tiktok-ads', label: 'TikTok Ads', kind: 'tool', terms: ['tiktok ads', 'quảng cáo tiktok'] },
  { id: 'google-analytics', label: 'Google Analytics', kind: 'tool', terms: ['google analytics', 'ga4'] },
  {
    id: 'laptop',
    label: 'laptop',
    kind: 'asset',
    terms: ['laptop', 'máy tính cá nhân', 'máy tính xách tay', 'macbook'],
  },
  {
    id: 'vehicle',
    label: 'xe máy / phương tiện đi lại',
    kind: 'asset',
    terms: ['xe máy', 'phương tiện đi lại', 'phương tiện cá nhân', 'xe riêng', 'motorbike', 'motorcycle'],
  },
];

function foldGroup(g: RawGroup): KeywordGroup {
  return { ...g, terms: g.terms.map(fold), reqOnly: g.reqOnly?.map(fold) };
}

export const KEYWORD_GROUPS: readonly KeywordGroup[] = RAW.map(foldGroup);

const BY_ID = new Map(KEYWORD_GROUPS.map((g) => [g.id, g]));

/** Groups made redundant when `g` is named in the same requirement line. */
export function subsumedBy(g: KeywordGroup): string[] {
  return [...(g.covers ?? []), ...(g.allOf ?? []), ...(g.examples ?? [])];
}

export function groupById(id: string): KeywordGroup | null {
  return BY_ID.get(id) ?? null;
}

interface TermEntry {
  term: string;
  groupId: string;
}

function termTable(includeReqOnly: boolean): TermEntry[] {
  const entries = KEYWORD_GROUPS.flatMap((g) => [
    ...g.terms.map((term) => ({ term, groupId: g.id })),
    ...(includeReqOnly ? (g.reqOnly ?? []).map((term) => ({ term, groupId: g.id })) : []),
  ]);
  return entries.sort((a, b) => b.term.length - a.term.length);
}

const REQ_TERMS = termTable(true);
const CV_TERMS = termTable(false);

export interface GroupHit extends Span {
  groupId: string;
}

function overlaps(a: Span, taken: readonly Span[]): boolean {
  return taken.some((t) => a.start < t.end && t.start < a.end);
}

/** Longest-match, non-overlapping group hits in a folded string ("react native" beats "react"). */
export function findGroupHits(folded: string, side: 'req' | 'cv'): GroupHit[] {
  const hits: GroupHit[] = [];
  for (const { term, groupId } of side === 'req' ? REQ_TERMS : CV_TERMS) {
    if (!folded.includes(term)) continue;
    for (const span of findTerm(folded, term)) {
      if (!overlaps(span, hits)) hits.push({ ...span, groupId });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}
