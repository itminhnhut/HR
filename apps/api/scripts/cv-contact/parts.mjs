// Turns a case from cases-*.mjs into HTML fragments (name, contact, sections) that a layout template arranges.
import { ADDRESSES, CERTS, COMPANIES, INTERESTS, PROJECT_TEXT, ROLES, SCHOOLS, pick, pickN, rng } from './filler.mjs';

const HEADINGS = {
  vi: {
    objective: 'MỤC TIÊU NGHỀ NGHIỆP',
    experience: 'KINH NGHIỆM LÀM VIỆC',
    education: 'HỌC VẤN',
    skills: 'KỸ NĂNG',
    references: 'NGƯỜI THAM CHIẾU',
    personal: 'THÔNG TIN CÁ NHÂN',
    contact: 'LIÊN HỆ',
    projects: 'DỰ ÁN TIÊU BIỂU',
    certs: 'CHỨNG CHỈ',
    interests: 'SỞ THÍCH',
  },
  en: {
    objective: 'CAREER OBJECTIVE',
    experience: 'WORK EXPERIENCE',
    education: 'EDUCATION',
    skills: 'SKILLS',
    references: 'REFERENCES',
    personal: 'PERSONAL DETAILS',
    contact: 'CONTACT',
    projects: 'KEY PROJECTS',
    certs: 'CERTIFICATES',
    interests: 'INTERESTS',
  },
};

const WORDS = {
  vi: { present: 'nay', major: 'Chuyên ngành', companyPhone: 'ĐT công ty', manager: 'Quản lý trực tiếp' },
  en: { present: 'Present', major: 'Major', companyPhone: 'Company phone', manager: 'Line manager' },
};

const CONTACT_LABELS = {
  icons: ['☎', '✉', '📍'],
  'icons-text': ['Tel', 'Mail', 'Add'],
  'labels-vi': ['Điện thoại:', 'Email:', 'Địa chỉ:'],
  'labels-vi-long': ['Số điện thoại:', 'Email:', 'Địa chỉ:'],
  'labels-vi-short': ['ĐT:', 'E-mail:', 'ĐC:'],
  'labels-en': ['Phone:', 'Email:', 'Address:'],
  'labels-en-mobile': ['Mobile:', 'E-mail:', 'Address:'],
  plain: ['', '', ''],
};

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Text language for headings/filler: 'mixed' and 'novn' use Vietnamese filler. */
const textLang = (cv) => (cv.lang === 'en' ? 'en' : 'vi');

function heading(cv, key) {
  if (cv.lang === 'mixed') return `${HEADINGS.vi[key]} / ${HEADINGS.en[key]}`;
  return HEADINGS[textLang(cv)][key];
}

function nameHtml(cv) {
  const raw = cv.nameCase === 'upper' ? cv.person.displayName.toUpperCase() : cv.person.displayName;
  switch (cv.nameEffect) {
    case 'spaced-literal':
      return `<span class="pre">${esc(
        raw
          .split(' ')
          .map((w) => [...w].join(' '))
          .join('   '),
      )}</span>`;
    case 'spaced-css':
      return `<span class="spaced">${esc(raw)}</span>`;
    case 'split': {
      const words = raw.split(' ');
      const at = cv.nameSplitAt ?? 1;
      return `<span class="line">${esc(words.slice(0, at).join(' '))}</span><br><span class="line">${esc(words.slice(at).join(' '))}</span>`;
    }
    case 'split-spaced': {
      const words = raw.split(' ');
      const at = cv.nameSplitAt ?? 1;
      return `<span class="spaced">${esc(words.slice(0, at).join(' '))}</span><br><span class="spaced">${esc(words.slice(at).join(' '))}</span>`;
    }
    default:
      return esc(raw);
  }
}

function contactPairs(cv, r) {
  if (cv.contact) return cv.contact;
  const [pl, el, al] = CONTACT_LABELS[cv.contactStyle ?? 'labels-vi'];
  const address = cv.person.address ?? pick(r, ADDRESSES[textLang(cv)]);
  const pairs = [];
  if (cv.person.phone) pairs.push([pl, cv.person.phone]);
  if (cv.person.email) pairs.push([el, cv.person.email]);
  if (cv.person.address !== null) pairs.push([al, address]);
  return [...pairs, ...(cv.contactExtra ?? [])];
}

function job(cv, r, i, count) {
  const lang = textLang(cv);
  const role = ROLES[cv.role][lang];
  const company = pick(r, COMPANIES);
  const endYear = 2025 - i * 2;
  const end = i === 0 ? WORDS[lang].present : `${String(1 + Math.floor(r() * 12)).padStart(2, '0')}/${endYear}`;
  const start = `${String(1 + Math.floor(r() * 12)).padStart(2, '0')}/${endYear - 2}`;
  const bulletCount = (cv.pages ?? 1) > 1 ? 6 : 3;
  const bullets = pickN(r, role.bullets, bulletCount);
  const co = cv.companyContact && i < 2 ? companyLine(cv, company, i) : '';
  const position = role.positions[Math.min(i, role.positions.length - 1)];
  const companyName = lang === 'en' ? company[1] : company[0];
  const extra = count > 3 && i >= 2 ? `<p>${esc(PROJECT_TEXT[lang])}</p>` : '';
  return `<div class="job"><div class="job-head"><b>${esc(position)}</b> – ${esc(companyName)}</div><div class="period">${start} – ${end}</div><ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>${extra}${co}</div>`;
}

function companyLine(cv, company, i) {
  const w = WORDS[textLang(cv)];
  if (cv.companyContact === 'manager' && cv.manager) {
    const m = cv.manager;
    return `<div class="co">${w.manager}: ${esc(m.name)} – ${esc(m.phone)}${m.email ? ` – ${esc(m.email)}` : ''}</div>`;
  }
  const [, , phone, email] = i === 0 && cv.companyOverride ? cv.companyOverride : company;
  return `<div class="co">${w.companyPhone}: ${esc(phone)} · Email: ${esc(email)}</div>`;
}

function references(cv) {
  if (!cv.references) return '';
  return cv.references
    .map(
      (ref) =>
        `<div class="ref"><b>${esc(ref.name)}</b><br>${esc(ref.role)}<br>${esc(ref.phoneLabel ?? (textLang(cv) === 'en' ? 'Phone:' : 'Điện thoại:'))} ${esc(ref.phone)}${ref.email ? `<br>Email: ${esc(ref.email)}` : ''}</div>`,
    )
    .join('');
}

function education(cv, r) {
  const lang = textLang(cv);
  const school = cv.school ?? pick(r, SCHOOLS)[lang === 'en' ? 1 : 0];
  const major = pick(r, ROLES[cv.role][lang].majors);
  const from = 2008 + Math.floor(r() * 10);
  const gpa = cv.gpa ? `<div>${esc(cv.gpa)}</div>` : '';
  return `<div class="edu"><b>${esc(school)}</b><div class="period">${from} – ${from + 4}</div><div>${WORDS[lang].major}: ${esc(major)}</div>${gpa}</div>`;
}

function objective(cv) {
  const lang = textLang(cv);
  const base =
    lang === 'en'
      ? 'To grow in a professional environment, apply my experience to deliver measurable results and take on more responsibility within two years.'
      : 'Mong muốn làm việc trong môi trường chuyên nghiệp, phát huy kinh nghiệm để mang lại kết quả rõ ràng cho công ty và phát triển lên vị trí quản lý trong 2 năm tới.';
  const salary = cv.salary ? `<div>${esc(cv.salary)}</div>` : '';
  return `<p>${esc(base)}</p>${salary}`;
}

/** Everything a template needs, already rendered to HTML (except contact pairs, which each template styles). */
export function buildParts(cv) {
  const r = rng(cv.id);
  const lang = textLang(cv);
  const role = ROLES[cv.role][lang];
  const pages = cv.pages ?? 1;
  const jobCount = pages === 1 ? 2 : pages === 2 ? 5 : 8;
  const sections = {
    objective: objective(cv),
    experience: Array.from({ length: jobCount }, (_, i) => job(cv, r, i, jobCount)).join(''),
    education: education(cv, r),
    skills: `<ul>${pickN(r, role.skills, 5)
      .map((s) => `<li>${esc(s)}</li>`)
      .join('')}</ul>`,
    certs: `<ul>${pickN(r, CERTS[lang], 2)
      .map((s) => `<li>${esc(s)}</li>`)
      .join('')}</ul>`,
    interests: `<p>${pickN(r, INTERESTS[lang], 3).join(', ')}</p>`,
    projects: pages > 1 ? `<p>${esc(PROJECT_TEXT[lang])}</p><p>${esc(PROJECT_TEXT[lang])}</p>` : '',
    references: references(cv),
    personal: cv.personal ? cv.personal.map(([k, v]) => `<div>${esc(k)} ${esc(v)}</div>`).join('') : '',
  };
  return {
    name: cv.nameHtml ?? nameHtml(cv),
    title: esc(cv.title ?? role.title),
    contact: contactPairs(cv, r),
    sections,
    heading: (key) => heading(cv, key),
  };
}

/** Render contact pairs inline: "☎ 0912 345 678 | ✉ a@b.com". */
export const inline = (pairs, sep = ' | ') =>
  pairs
    .map(([k, v]) => `<span class="ci">${k ? `${esc(k)} ` : ''}${esc(v)}</span>`)
    .join(`<span class="sep">${sep}</span>`);

/** Render contact pairs one per line. */
export const lines = (pairs) =>
  pairs.map(([k, v]) => `<div class="ci">${k ? `${esc(k)} ` : ''}${esc(v)}</div>`).join('');

/** Render contact pairs as table rows (label cell + value cell). */
export const rows = (pairs) =>
  pairs.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
