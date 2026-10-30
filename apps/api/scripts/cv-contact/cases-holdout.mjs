// HELD-OUT set: 40 CVs the parser was not tuned on (src/test/cv-contact/holdout/). All people are fictional and
// none of their names, phones or emails appear in the main corpus (checked below).
//
// - RANDOM_COUNT cases are drawn with a PRNG seeded by HOLDOUT_SEED: template, language, label style, phone/email
//   format, name effects and noise sections are mixed at random.
// - HOLDOUT_HARD are hand-written traps that differ from the main corpus' hard cases.
import { CASES, withDefaults } from './cases.mjs';
import { ROLES, normalizePhone, pick, rng, stripDiacritics, toMobile } from './filler.mjs';

export const HOLDOUT_SEED = '2026';
const RANDOM_COUNT = 26;

const SURNAMES = [
  ...Array(6).fill('Nguyễn'),
  ...Array(3).fill('Trần'),
  ...Array(3).fill('Lê'),
  ...Array(2).fill('Phạm'),
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Hồ',
  'Ngô',
  'Dương',
  'Lý',
  'Đinh',
  'Trương',
  'Lâm',
  'Cao',
  'Lưu',
  'Thái',
  'Hà',
  'Lương',
  'Đoàn',
  'Trịnh',
  'Châu',
  'Doãn',
  'Tăng',
  'Phùng',
  'Văn',
  'Kim',
  'Âu Dương',
  'Tôn Thất',
];
const MIDDLES = [
  'Văn',
  'Thị',
  'Hữu',
  'Đức',
  'Minh',
  'Ngọc',
  'Thanh',
  'Quốc',
  'Thu',
  'Hoài',
  'Bảo',
  'Gia',
  'Xuân',
  'Kim',
  'Công',
  'Đình',
  'Phương',
  'Mỹ',
  'Nhật',
  'Diệu',
];
const GIVENS = [
  'An',
  'Bình',
  'Cường',
  'Dung',
  'Giang',
  'Hải',
  'Hiền',
  'Khang',
  'Khoa',
  'Linh',
  'Loan',
  'Mạnh',
  'Nga',
  'Nhân',
  'Phát',
  'Quân',
  'Quyên',
  'Sương',
  'Tài',
  'Thịnh',
  'Tín',
  'Uyên',
  'Xuyến',
  'Đạt',
  'Thoa',
  'Lộc',
  'Sơn',
  'Phúc',
  'Trinh',
  'Kiệt',
  'Hậu',
  'Nguyên',
  'Vy',
  'Thắm',
  'Toàn',
  'Duy',
  'Hạnh',
  'Luân',
  'Nhi',
  'Tú',
];
const PREFIXES = [
  '032',
  '033',
  '034',
  '035',
  '036',
  '037',
  '038',
  '039',
  '056',
  '058',
  '070',
  '076',
  '077',
  '078',
  '079',
  '081',
  '082',
  '083',
  '084',
  '085',
  '086',
  '088',
  '089',
  '090',
  '091',
  '093',
  '094',
  '096',
  '097',
  '098',
];
const DOMAINS = [
  'gmail.com',
  'gmail.com',
  'gmail.com',
  'gmail.com',
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com.vn',
];
const FONTS = ['Arial', '"Times New Roman"', 'Georgia', 'Verdana', 'Tahoma', '"Helvetica Neue"', '"Avenir Next"'];

/** [name, format] — every phone display format seen in Vietnamese CVs. */
const PHONE_FORMATS = [
  ['4-3-3', (d) => `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`],
  ['dots', (d) => `${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7)}`],
  ['dashes', (d) => `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`],
  ['plain', (d) => d],
  ['+84 spaced', (d) => `+84 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`],
  ['(+84)', (d) => `(+84) ${d.slice(1)}`],
  ['84 no plus', (d) => `84${d.slice(1)}`],
  ['3-3-4', (d) => `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`],
  ['4-2-2-2', (d) => `${d.slice(0, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8)}`],
  ['+84 dashes', (d) => `+84-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`],
  ['+84 plain', (d) => `+84${d.slice(1)}`],
];

const CONTACT_STYLES = {
  vi: ['icons', 'labels-vi', 'labels-vi-long', 'labels-vi-short', 'icons-text', 'plain'],
  en: ['labels-en', 'labels-en-mobile', 'icons', 'icons-text', 'plain'],
};

const asciiKey = (s) =>
  stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/** Names, phones and emails already used by the main corpus (candidates, referees, managers). */
function usedValues() {
  const names = new Set();
  const phones = new Set();
  const emails = new Set();
  const addPhone = (p) => {
    const mobile = toMobile(p);
    if (mobile) phones.add(mobile);
  };
  for (const cv of CASES) {
    if (cv.person.displayName) names.add(asciiKey(cv.person.displayName));
    if (cv.person.phone) addPhone(cv.person.phone);
    if (cv.person.email) emails.add(cv.person.email.replace(/^mailto:/i, '').toLowerCase());
    for (const [, v] of cv.contact ?? []) {
      for (const m of v.match(/[\d+().\s-]{9,}/g) ?? []) addPhone(m);
      if (v.includes('@')) emails.add(v.toLowerCase());
    }
    for (const ref of [...(cv.references ?? []), ...(cv.manager ? [cv.manager] : [])]) {
      addPhone(ref.phone);
      if (ref.email) emails.add(ref.email.toLowerCase());
    }
  }
  return { names, phones, emails };
}

function newName(r, used) {
  for (;;) {
    const words = r();
    const surname = pick(r, SURNAMES);
    const count = words < 0.1 ? 0 : words < 0.65 ? 1 : 2;
    const middles = Array.from({ length: count }, () => pick(r, MIDDLES));
    const name = [surname, ...middles, pick(r, GIVENS)].join(' ');
    if (new Set(name.split(' ')).size !== name.split(' ').length) continue;
    if (used.names.has(asciiKey(name))) continue;
    used.names.add(asciiKey(name));
    return name;
  }
}

function newPhoneDigits(r, used) {
  for (;;) {
    const d = pick(r, PREFIXES) + String(Math.floor(r() * 1e7)).padStart(7, '0');
    if (used.phones.has(d)) continue;
    used.phones.add(d);
    return d;
  }
}

function newEmail(r, name, used, role) {
  const parts = stripDiacritics(name).toLowerCase().split(' ');
  const sur = parts[0];
  const given = parts.at(-1);
  const mids = parts.slice(1, -1).join('');
  const yy = String(85 + Math.floor(r() * 17)).padStart(2, '0');
  const styles = [
    () => `${given}.${sur}`,
    () => `${sur}${mids}${given}${yy}`,
    () => `${given}_${sur}${10 + Math.floor(r() * 90)}`,
    () => `${sur}.${mids}${given}.${role}`,
    () => `${mids}${given}.${sur}${yy}`,
    () => `${given}${sur}.work`,
  ];
  let local = pick(r, styles)().replace(/\.\./g, '.');
  const domain = pick(r, DOMAINS);
  while (used.emails.has(`${local}@${domain}`)) local += String(Math.floor(r() * 10));
  used.emails.add(`${local}@${domain}`);
  return { local, domain };
}

const capitalizeLocal = (local) => local.replace(/(^|[._])([a-z])/g, (_, a, b) => a + b.toUpperCase());

function personalRows(r, en) {
  const rows = [];
  const year = 1985 + Math.floor(r() * 16);
  const dob = `${String(1 + Math.floor(r() * 28)).padStart(2, '0')}/${String(1 + Math.floor(r() * 12)).padStart(2, '0')}/${year}`;
  if (r() < 0.45) rows.push([en ? 'Date of birth:' : 'Ngày sinh:', dob]);
  if (r() < 0.3) rows.push([en ? 'ID card:' : 'Số CCCD:', `0${String(Math.floor(r() * 1e11)).padStart(11, '0')}`]);
  if (r() < 0.25) rows.push([en ? 'Gender:' : 'Giới tính:', pick(r, en ? ['Male', 'Female'] : ['Nam', 'Nữ'])]);
  if (r() < 0.25)
    rows.push([
      en ? 'Expected salary:' : 'Mức lương mong muốn:',
      `${pick(r, ['10', '12', '15', '18', '25'])}.000.000 VNĐ`,
    ]);
  return rows;
}

function randomReference(r, used, en) {
  const name = newName(r, used);
  const shown = en ? stripDiacritics(name) : name;
  const honor = en ? pick(r, ['Mr.', 'Ms.']) : pick(r, ['Ông', 'Bà', 'Anh', 'Chị']);
  const phone = pick(r, PHONE_FORMATS)[1](newPhoneDigits(r, used));
  const { local, domain } = newEmail(r, name, used, 'ref');
  const role = en
    ? pick(r, ['Line Manager', 'Director', 'Team Leader'])
    : pick(r, ['Trưởng phòng', 'Giám đốc', 'Trưởng nhóm']);
  return { name: `${honor} ${shown}`, role, phone, email: `${local}@${domain}` };
}

const chance = (r, p) => r() < p;

/** Template-specific options, with a short description of each choice for the notes. */
function templateOptions(r, template, lang) {
  const o = {};
  const notes = [];
  if (template === 'sidebar') {
    o.sidebar = {
      side: pick(r, ['left', 'right']),
      name: pick(r, ['main', 'sidebar']),
      refs: pick(r, ['main', 'sidebar']),
    };
    notes.push(`sidebar ${o.sidebar.side}, name in ${o.sidebar.name}, refs in ${o.sidebar.refs}`);
  }
  if (template === 'oneColumn') {
    if (chance(r, 0.12)) ((o.titleFirst = true), notes.push('title first'));
    if (chance(r, 0.08)) ((o.contactAtEnd = true), notes.push('contact at end'));
    if (chance(r, 0.18)) {
      o.top = pick(r, [
        'CURRICULUM VITAE',
        'HỒ SƠ XIN VIỆC',
        'SƠ YẾU LÝ LỊCH',
        lang === 'en' ? 'RESUME' : 'CV XIN VIỆC',
      ]);
      notes.push(`first line "${o.top}"`);
    }
  }
  if (template === 'labelForm') {
    if (chance(r, 0.5)) ((o.formStyle = 'dots'), notes.push('label lines'));
    if (chance(r, 0.4)) ((o.photoBox = true), notes.push('photo box'));
    if (chance(r, 0.5)) o.top = pick(r, ['SƠ YẾU LÝ LỊCH', 'HỒ SƠ XIN VIỆC', 'CURRICULUM VITAE']);
  }
  if (template === 'banner' && chance(r, 0.5)) ((o.contactBelowBanner = true), notes.push('contact below banner'));
  if (template === 'canva' && chance(r, 0.5)) o.hello = lang === 'en' ? 'Hello, I am' : 'Xin chào!';
  if (template === 'table' && chance(r, 0.5)) ((o.tableHeaderRow = true), notes.push('header row'));
  if (template === 'vnw' && chance(r, 0.5)) ((o.infoCols = 4), notes.push('4-column info'));
  if (template === 'nameTitle') o.sep = pick(r, ['|', '–', '-', '•']);
  return { o, notes };
}

function randomCase(r, index, used) {
  const template = pick(r, [
    'oneColumn',
    'oneColumn',
    'sidebar',
    'sidebar',
    'banner',
    'nameTitle',
    'labelForm',
    'topcv',
    'vnw',
    'canva',
    'table',
  ]);
  const lang = pick(r, ['vi', 'vi', 'vi', 'vi', 'vi', 'en', 'en', 'novn', 'novn', 'mixed']);
  const en = lang === 'en';
  const role = pick(r, Object.keys(ROLES));
  const fullName = newName(r, used);
  const written = lang === 'novn' || (en && chance(r, 0.6)) ? stripDiacritics(fullName) : fullName;
  const [phoneFormat, formatPhone] = pick(r, PHONE_FORMATS);
  const phone = formatPhone(newPhoneDigits(r, used));
  const { local, domain } = newEmail(r, fullName, used, pick(r, ['kt', 'hr', 'sales', 'dev', 'mkt', 'cv']));
  const emailCase = r();
  const email =
    emailCase < 0.15
      ? `${capitalizeLocal(local)}@${domain}`
      : emailCase < 0.2
        ? `mailto:${local}@${domain}`
        : `${local}@${domain}`;
  const { o, notes } = templateOptions(r, template, lang);
  const cv = { template, lang, role, font: pick(r, FONTS), ...o };
  cv.nameCase = chance(r, 0.5) ? 'upper' : 'as-is';
  cv.nameEffect = pick(r, [
    ...Array(12).fill(undefined),
    'spaced-css',
    'spaced-css',
    'split',
    'split',
    'spaced-literal',
    'split-spaced',
  ]);
  if (cv.nameEffect?.startsWith('split'))
    cv.nameSplitAt = fullName.startsWith('Âu Dương') || fullName.startsWith('Tôn Thất') ? 2 : 1;
  cv.contactStyle = pick(r, CONTACT_STYLES[en || (lang === 'mixed' && chance(r, 0.5)) ? 'en' : 'vi']);
  const personal = personalRows(r, en);
  if (personal.length) cv.personal = personal;
  if (chance(r, 0.3))
    cv.references = Array.from({ length: chance(r, 0.5) ? 2 : 1 }, () => randomReference(r, used, en));
  if (chance(r, 0.25)) cv.companyContact = true;
  if (chance(r, 0.2))
    cv.gpa = en
      ? `GPA: ${(2.8 + r()).toFixed(2)}/4`
      : `Điểm trung bình: ${(6.5 + r() * 3).toFixed(1).replace('.', ',')}/10`;
  if (chance(r, 0.12)) cv.pages = 2;
  if (chance(r, 0.25)) {
    const [label, site] = pick(r, [
      ['LinkedIn:', 'linkedin.com/in/'],
      ['GitHub:', 'github.com/'],
      ['Facebook:', 'facebook.com/'],
    ]);
    cv.contactExtra = [[label, `${site}${local.replace(/[._]/g, '-')}`]];
  }
  if (lang === 'vi' && chance(r, 0.1)) cv.nfd = true;

  const quirks = [
    ...notes,
    cv.nameCase === 'upper' ? 'name ALL CAPS' : 'name as written',
    cv.nameEffect,
    `phone ${phoneFormat}`,
    emailCase < 0.15 ? 'email with capitals' : emailCase < 0.2 ? 'mailto: email' : undefined,
    `contact ${cv.contactStyle}`,
    cv.personal ? `personal: ${cv.personal.map(([k]) => k.replace(':', '')).join(', ')}` : undefined,
    cv.references ? `${cv.references.length} reference(s)` : undefined,
    cv.companyContact ? 'company contacts' : undefined,
    cv.gpa ? 'GPA' : undefined,
    cv.pages ? 'multi-page' : undefined,
    cv.contactExtra ? 'profile link' : undefined,
    cv.nfd ? 'NFD source' : undefined,
  ].filter(Boolean);
  const slug = stripDiacritics(fullName).toLowerCase().replace(/\s+/g, '-');
  return {
    ...cv,
    id: `holdout-r${String(index + 1).padStart(2, '0')}-${slug}`,
    layout: `random: ${template} / ${lang}`,
    notes: `Seed ${HOLDOUT_SEED}: ${quirks.join('; ')}`,
    person: { name: written, phone, email },
  };
}

/** Hand-written traps not present in the main corpus. */
const HOLDOUT_HARD = [
  {
    id: 'holdout-hard-photo-box-then-name',
    layout: 'hard: one-column',
    notes: 'Photo placeholder "ẢNH THẺ 3 x 4" (two capitalised words, looks like a name) comes before the real name',
    top: '<div style="width:28mm;height:36mm;border:1px solid #999;text-align:center;padding-top:13mm;font-size:9pt;color:#777">ẢNH THẺ<br>3 x 4</div>',
    role: 'cs',
    person: { name: 'Doãn Thị Bích Liên', phone: '0397 528 146', email: 'bichlien.doan@gmail.com' },
    nameCase: 'upper',
  },
  {
    id: 'holdout-hard-ung-vien-label',
    layout: 'hard: label form',
    notes: 'Form titled "PHIẾU THÔNG TIN ỨNG VIÊN" with the name after "Ứng viên:"',
    template: 'labelForm',
    top: 'PHIẾU THÔNG TIN ỨNG VIÊN',
    nameLabel: 'Ứng viên:',
    role: 'logistics',
    person: { name: 'Khổng Văn Lợi', phone: '0763 409 251', email: 'khongvanloi.kho@gmail.com' },
    nameCase: 'upper',
  },
  {
    id: 'holdout-hard-email-footer-only',
    layout: 'hard: one-column',
    notes: 'Candidate email only in a closing footer line; company emails appear earlier in the experience section',
    role: 'hr',
    companyContact: true,
    person: { name: 'Hoàng Kim Loan', phone: '0869 302 715', email: 'hoangkimloan.96@gmail.com' },
    contact: [
      ['Điện thoại:', '0869 302 715'],
      ['Địa chỉ:', 'Số 7, đường 3/2, P. Xuân Khánh, Ninh Kiều, Cần Thơ'],
    ],
    footer: 'Cảm ơn Quý công ty đã dành thời gian xem hồ sơ. Mọi liên hệ xin gửi về: hoangkimloan.96@gmail.com',
  },
  {
    id: 'holdout-hard-cccd-then-phone-4-2-2-2',
    layout: 'hard: one-column',
    notes: 'CCCD right before a phone written 4-2-2-2 ("0916 73 42 85") on the same line',
    role: 'sales',
    person: { name: 'Tăng Hữu Nghĩa', phone: '0916 73 42 85', email: 'tanghuunghia.kd@gmail.com' },
    contact: [
      ['CCCD:', '038197002614'],
      ['ĐT:', '0916 73 42 85'],
      ['Email:', 'tanghuunghia.kd@gmail.com'],
    ],
  },
  {
    id: 'holdout-hard-office-tel-then-mobile-plus84',
    layout: 'hard: english one-column',
    notes:
      'English: office "Tel: +84-28-3822-1100" before "Mobile: +84-935-806-417"; name without diacritics, rare surname Viên',
    lang: 'en',
    role: 'logistics',
    person: { name: 'Vien Ngoc Ha', phone: '+84-935-806-417', email: 'ngocha.vien@outlook.com' },
    contact: [
      ['Tel (office):', '+84-28-3822-1100'],
      ['Mobile:', '+84-935-806-417'],
      ['Email:', 'ngocha.vien@outlook.com'],
    ],
  },
  {
    id: 'holdout-hard-middle-initial',
    layout: 'hard: one-column',
    notes: 'Middle name abbreviated: "TRẦN V. HÙNG"',
    role: 'accounting',
    person: { name: 'Trần V. Hùng', phone: '0948 216 503', email: 'tranvhung.acc@gmail.com' },
    nameCase: 'upper',
  },
  {
    id: 'holdout-hard-surname-mai',
    layout: 'hard: banner',
    notes: 'Surname that is also a common word / given name: "MAI ANH TUẤN"',
    template: 'banner',
    role: 'sales',
    person: { name: 'Mai Anh Tuấn', phone: '0332 610 874', email: 'maianhtuan.sales@gmail.com' },
    nameCase: 'upper',
    contactStyle: 'icons',
  },
  {
    id: 'holdout-hard-agency-caps-first-line',
    layout: 'hard: one-column',
    notes: 'First line is a staffing agency name in CAPS ("CÔNG TY CỔ PHẦN NHÂN LỰC VIỆT TÂM") plus a profile code',
    top: '<b>CÔNG TY CỔ PHẦN NHÂN LỰC VIỆT TÂM</b><br>HỒ SƠ ỨNG VIÊN – Mã hồ sơ: VT-2026-0412',
    role: 'logistics',
    person: { name: 'Phùng Thị Ngọc Hoa', phone: '0857 204 639', email: 'ngochoa.phung@yahoo.com' },
    nameCase: 'upper',
  },
  {
    id: 'holdout-hard-english-order',
    layout: 'hard: english one-column',
    notes:
      'Vietnamese name in English order, given name first: "KHOA NGUYEN DANG" (Nguyễn Đăng Khoa); expected as written',
    lang: 'en',
    role: 'it',
    person: { name: 'Khoa Nguyen Dang', phone: '+84 902 418 357', email: 'khoa.nguyendang.dev@gmail.com' },
    nameCase: 'upper',
    contactStyle: 'labels-en',
  },
  {
    id: 'holdout-hard-nickname',
    layout: 'hard: sidebar',
    notes:
      'Name followed by an English nickname in brackets: "Phùng Gia Khang (Kevin)"; expected without the nickname (judgement call)',
    template: 'sidebar',
    role: 'marketing',
    person: { name: 'Phùng Gia Khang', phone: '0786 254 019', email: 'kevin.phunggiakhang@gmail.com' },
    nameHtml: 'Phùng Gia Khang <span style="font-size:13pt;color:#777">(Kevin)</span>',
  },
  {
    id: 'holdout-hard-name-gender-year',
    layout: 'hard: one-column',
    notes: 'Gender and birth year on the name line: "LẠI THU QUYÊN (Nữ – 1996)"',
    role: 'accounting',
    person: { name: 'Lại Thu Quyên', phone: '0354 871 260', email: 'laithuquyen.kt@gmail.com' },
    nameHtml: 'LẠI THU QUYÊN <span style="font-size:12pt;color:#666">(Nữ – 1996)</span>',
  },
  {
    id: 'holdout-hard-two-phones-one-line',
    layout: 'hard: one-column',
    notes:
      'Two mobiles on one line "0389 157 640 – 0912 806 735"; expected the first (ambiguous: both are the candidate’s)',
    role: 'cs',
    person: { name: 'Lê Hoàng Diệu', phone: '0389 157 640', email: 'hoangdieu.le.cs@gmail.com' },
    contact: [
      ['ĐT:', '0389 157 640 – 0912 806 735'],
      ['Email:', 'hoangdieu.le.cs@gmail.com'],
    ],
  },
  {
    id: 'holdout-hard-name-only-in-signature',
    layout: 'hard: one-column',
    notes:
      'No name in the header (only the job title); the name appears only in the closing signature, surname Từ (also a common word)',
    role: 'cs',
    person: { name: 'Từ Hoàng Yến', phone: '0779 341 286', email: 'tuhoangyen.cs@yahoo.com' },
    nameHtml: '',
    footer: 'Xin chân thành cảm ơn!<br>Người viết hồ sơ<br><b>Từ Hoàng Yến</b>',
  },
  {
    id: 'holdout-hard-email-all-caps-surname-ong',
    layout: 'hard: one-column',
    notes: 'Email entirely in capitals; surname Ông (also means "Mr.")',
    role: 'teacher',
    person: { name: 'Ông Thị Diệu Hiền', phone: '0829 645 130', email: 'DIEUHIEN.ONG@GMAIL.COM' },
    nameCase: 'upper',
  },
];

function assertNew(cases) {
  const used = usedValues();
  for (const cv of cases) {
    const { displayName, phone, email } = cv.person;
    if (displayName && used.names.has(asciiKey(displayName))) throw new Error(`${cv.id}: name used in the main corpus`);
    if (phone && used.phones.has(normalizePhone(phone))) throw new Error(`${cv.id}: phone used in the main corpus`);
    if (email && used.emails.has(email.toLowerCase())) throw new Error(`${cv.id}: email used in the main corpus`);
  }
}

function buildHoldout() {
  const hard = HOLDOUT_HARD.map(withDefaults);
  assertNew(hard);
  const used = usedValues();
  for (const cv of hard) {
    used.names.add(asciiKey(cv.person.displayName));
    used.phones.add(normalizePhone(cv.person.phone));
    used.emails.add(cv.person.email.toLowerCase());
  }
  const r = rng(HOLDOUT_SEED);
  const random = Array.from({ length: RANDOM_COUNT }, (_, i) => withDefaults(randomCase(r, i, used)));
  return [...random, ...hard];
}

export const HOLDOUT_CASES = buildHoldout();
