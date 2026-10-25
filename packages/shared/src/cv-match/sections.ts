/**
 * CV section headers (Vietnamese + English, folded form). A keyword under "Sở thích" or "Mục tiêu" is not a skill;
 * a date range under "Học vấn" is not work experience.
 */
export type SectionKind =
  | 'none'
  | 'experience'
  | 'education'
  | 'skills'
  | 'certificates'
  | 'languages'
  | 'objective'
  | 'interests'
  | 'personal'
  | 'summary'
  | 'projects'
  | 'activities'
  | 'references'
  | 'other';

const HEADERS: Record<Exclude<SectionKind, 'none'>, string[]> = {
  experience: [
    'kinh nghiem lam viec',
    'kinh nghiem',
    'qua trinh lam viec',
    'qua trinh cong tac',
    'lich su lam viec',
    'kinh nghiem chuyen mon',
    'work experience',
    'experience',
    'employment history',
    'professional experience',
    'employment',
    'work history',
    'career history',
  ],
  education: [
    'hoc van',
    'trinh do hoc van',
    'qua trinh hoc tap',
    'trinh do dao tao',
    'dao tao',
    'education',
    'academic background',
    'education background',
    'educational background',
    'hoc tap',
  ],
  skills: [
    'ky nang',
    'ky nang chuyen mon',
    'ky nang lam viec',
    'ky nang tin hoc',
    'tin hoc',
    'skills',
    'technical skills',
    'key skills',
    'core skills',
    'hard skills',
    'cong cu',
    'tools',
    'ky nang mem',
    'soft skills',
  ],
  certificates: [
    'chung chi',
    'bang cap',
    'bang cap chung chi',
    'chung chi bang cap',
    'certifications',
    'certificates',
    'certification',
    'giai thuong',
    'awards',
    'thanh tich',
    'danh hieu',
  ],
  languages: ['ngoai ngu', 'languages', 'language', 'trinh do ngoai ngu'],
  objective: [
    'muc tieu',
    'muc tieu nghe nghiep',
    'objective',
    'career objective',
    'career objectives',
    'career goal',
    'career goals',
    'mong muon',
    'dinh huong',
    'dinh huong nghe nghiep',
    'nguyen vong',
  ],
  // Things the candidate likes or still wants to learn: mentioned there, a skill is not a skill they have.
  interests: [
    'so thich',
    'so thich ca nhan',
    'interests',
    'hobbies',
    'hobby',
    'mong muon hoc them',
    'muon hoc them',
    'ky nang muon hoc',
    'ky nang muon phat trien',
    'dinh huong hoc tap',
    'dang hoc them',
    'muc tieu hoc tap',
    'ke hoach hoc tap',
    'learning goals',
    'want to learn',
    'skills to learn',
    'currently learning',
  ],
  personal: [
    'thong tin ca nhan',
    'personal information',
    'personal info',
    'thong tin lien he',
    'contact',
    'lien he',
    'personal details',
    'contact information',
  ],
  summary: ['gioi thieu', 'gioi thieu ban than', 'tom tat', 'summary', 'profile', 'about me', 've toi', 'ho so'],
  projects: ['du an', 'du an tieu bieu', 'projects', 'du an da tham gia', 'personal projects'],
  activities: [
    'hoat dong',
    'hoat dong ngoai khoa',
    'activities',
    'volunteer',
    'tinh nguyen',
    'extracurricular activities',
  ],
  references: ['nguoi tham chieu', 'references', 'nguoi gioi thieu', 'reference'],
  other: [
    'thong tin khac',
    'thong tin them',
    'other',
    'others',
    'khac',
    'giay to',
    'phuong tien',
    'thiet bi',
    'giay to phuong tien',
    'additional information',
    'other information',
  ],
};

const PHRASE_TO_KIND = new Map<string, Exclude<SectionKind, 'none'>>();
for (const [kind, phrases] of Object.entries(HEADERS) as [Exclude<SectionKind, 'none'>, string[]][]) {
  for (const p of phrases) PHRASE_TO_KIND.set(p, kind);
}

export interface HeaderMatch {
  kind: Exclude<SectionKind, 'none'>;
  /** "Kỹ năng: Excel, Word" — header and content on one line. */
  inline: boolean;
}

function stripDecor(folded: string): string {
  return folded
    .replace(/^[\s\-*+>#.]*(?:(?:[ivx]+|\d+)[.)]\s*)?/, '')
    .replace(/[\s:.\-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function exactHeader(stripped: string): Exclude<SectionKind, 'none'> | null {
  for (const part of stripped.split(/\s*[/|&]\s*/)) {
    const kind = PHRASE_TO_KIND.get(part.trim());
    if (kind) return kind;
  }
  return null;
}

/** Detects a section header in a folded line; null when the line is ordinary content. */
export function detectHeader(folded: string): HeaderMatch | null {
  const stripped = stripDecor(folded);
  if (stripped.length === 0) return null;
  const exact = stripped.length <= 60 ? exactHeader(stripped) : null;
  if (exact) return { kind: exact, inline: false };
  const inline = /^([a-z ]{3,40}?)\s*:\s*\S/.exec(stripped);
  if (!inline) return null;
  const kind = PHRASE_TO_KIND.get(inline[1].trim());
  return kind ? { kind, inline: true } : null;
}
