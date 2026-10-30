// Layout templates for the synthetic CV corpus. Each takes a case and its parts (see parts.mjs) and returns
// { html, margin } for Chrome's page.pdf(). Templates differ in DOM order on purpose: unpdf reads text in drawing
// order, which follows the DOM, so sidebars placed first in the DOM come out first in the extracted text.
import { esc, inline, lines, rows } from './parts.mjs';

const MAIN_ORDER = ['objective', 'experience', 'projects', 'education', 'skills', 'certs', 'references', 'interests'];
const PAGE_MARGIN = { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' };
const NO_MARGIN = { top: '0', bottom: '0', left: '0', right: '0' };

function doc(cv, css, body) {
  const font = cv.font ?? 'Arial';
  const accent = cv.accent ?? '#1f4e79';
  const base = `*{box-sizing:border-box}body{margin:0;font-family:${font},sans-serif;font-size:10.5pt;color:#222;line-height:1.4}
h1{margin:0;font-size:24pt;color:${accent}}.title{font-size:12.5pt;color:#555;margin:2px 0 6px}
.sec h2{font-size:11.5pt;margin:14px 0 6px;color:${accent};border-bottom:1px solid #ccc;padding-bottom:2px}
ul{margin:4px 0 8px 18px;padding:0}.job{margin-bottom:8px}.period{color:#666;font-size:9.5pt}.co{font-size:9.5pt;color:#555}
.ref{margin-bottom:6px}.spaced{letter-spacing:0.35em}.pre{white-space:pre}.top{font-size:10pt;color:#444;margin-bottom:10px}
.accent{color:${accent}}.ft{margin-top:18px;padding:6px 14px;border-top:1px solid #ccc;font-size:9pt;color:#666}`;
  const lang = cv.lang === 'en' ? 'en' : 'vi';
  const footer = cv.footer ? `<footer class="ft">${cv.footer}</footer>` : '';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>${base}${css}</style></head><body>${body}${footer}</body></html>`;
}

/** One section, or '' when the case has nothing for it. */
function sec(p, key, prefix = '') {
  const inner = p.sections[key];
  if (!inner) return '';
  return `<section class="sec"><h2>${prefix}${p.heading(key)}</h2>${inner}</section>`;
}

const secs = (p, keys) => keys.map((k) => sec(p, k)).join('');

function oneColumn(cv, p) {
  const top = cv.top ? `<div class="top">${cv.top}</div>` : '';
  const head = cv.titleFirst
    ? `<div class="title big">${p.title}</div><h1>${p.name}</h1>`
    : `<h1>${p.name}</h1><div class="title">${p.title}</div>`;
  const contact = cv.contactAtEnd ? '' : `<div class="contact">${inline(p.contact, cv.sep ?? ' | ')}</div>`;
  const end = cv.contactAtEnd
    ? `<section class="sec"><h2>${p.heading('contact')}</h2>${lines(p.contact)}</section>`
    : '';
  const css = `.big{font-size:15pt;text-transform:uppercase;letter-spacing:1px;color:#333}.contact{font-size:10pt;margin-bottom:6px}.sep{color:#999}`;
  const body = `${top}<header>${head}${contact}</header>${sec(p, 'personal')}${secs(p, MAIN_ORDER)}${end}`;
  return { html: doc(cv, css, body), margin: PAGE_MARGIN };
}

function sidebar(cv, p) {
  const o = { side: 'left', name: 'main', refs: 'main', contact: 'sidebar', width: '34%', ...cv.sidebar };
  const nameBlock = `<div class="namebox"><h1>${p.name}</h1><div class="title">${p.title}</div></div>`;
  const contactSec = `<section class="sec"><h2>${p.heading('contact')}</h2>${lines(p.contact)}</section>`;
  const side = [
    o.name === 'sidebar' ? nameBlock : '',
    o.contact === 'sidebar' ? contactSec : '',
    o.refs === 'sidebar-top' ? sec(p, 'references') : '',
    secs(p, ['personal', 'skills', 'education', 'certs']),
    o.refs === 'sidebar' ? sec(p, 'references') : '',
    sec(p, 'interests'),
  ].join('');
  const main = [
    o.name === 'main' ? nameBlock : '',
    o.contact === 'main' ? `<div class="contact">${inline(p.contact)}</div>` : '',
    secs(p, ['objective', 'experience', 'projects']),
    o.refs === 'main' ? sec(p, 'references') : '',
  ].join('');
  const wrap = o.breakWords ? 'overflow-wrap:anywhere;word-break:break-all;' : '';
  const css = `.wrap{display:flex;min-height:297mm}.side{width:${o.width};background:${cv.sideBg ?? '#eef2f6'};padding:18px 14px;${wrap}}
.main{flex:1;padding:18px 20px}.side h1{font-size:20pt}.side .ci{margin-bottom:4px;font-size:9.5pt}.contact{font-size:10pt}`;
  const sideHtml = `<aside class="side">${side}</aside>`;
  const mainHtml = `<main class="main">${main}</main>`;
  const body = `<div class="wrap">${o.side === 'left' ? sideHtml + mainHtml : mainHtml + sideHtml}</div>`;
  return { html: doc(cv, css, body), margin: NO_MARGIN };
}

function banner(cv, p) {
  const contact = `<div class="contact">${inline(p.contact, '&nbsp;&nbsp;&nbsp;')}</div>`;
  const below = cv.contactBelowBanner;
  const css = `.banner{background:${cv.accent ?? '#1f4e79'};color:#fff;padding:26px 30px}.banner h1{color:#fff;font-size:30pt}
.banner .title{color:#dde;font-size:14pt}.contact{font-size:10pt;margin-top:6px}.body{padding:6px 30px 20px}
.below{background:#f2f2f2;padding:8px 30px;font-size:10pt}`;
  const body = `<div class="banner"><h1>${p.name}</h1><div class="title">${p.title}</div>${below ? '' : contact}</div>${
    below ? `<div class="below">${inline(p.contact, '&nbsp;&nbsp;•&nbsp;&nbsp;')}</div>` : ''
  }<div class="body">${sec(p, 'personal')}${secs(p, MAIN_ORDER)}</div>`;
  return { html: doc(cv, css, body), margin: NO_MARGIN };
}

function nameTitle(cv, p) {
  const top = cv.top ? `<div class="top">${cv.top}</div>` : '';
  const css = `h1{font-size:20pt}.t{color:#555;font-weight:normal}.contact{font-size:10pt;margin:6px 0;border-top:2px solid #333;padding-top:6px}`;
  const body = `${top}<h1>${p.name}<span class="t"> ${esc(cv.sep ?? '|')} ${p.title}</span></h1><div class="contact">${inline(
    p.contact,
    ' · ',
  )}</div>${sec(p, 'personal')}${secs(p, MAIN_ORDER)}`;
  return { html: doc(cv, css, body), margin: PAGE_MARGIN };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function labelForm(cv, p) {
  const en = cv.lang === 'en';
  const docTitle = cv.top ?? (en ? 'CURRICULUM VITAE' : 'SƠ YẾU LÝ LỊCH');
  const nameLabel = cv.nameLabel ?? (en ? 'Full name:' : 'Họ và tên:');
  const formRows = cv.formRows ?? [[nameLabel, '$NAME'], ...(cv.personal ?? []), ...p.contact];
  const value = (v) => (v === '$NAME' ? `<b>${p.name}</b>` : esc(v));
  const info =
    cv.formStyle === 'dots'
      ? formRows.map(([k, v]) => `<div class="dl">${esc(k)} ${value(v)}</div>`).join('')
      : `<table class="form">${formRows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${value(v)}</td></tr>`).join('')}</table>`;
  const photo = cv.photoBox ? `<div class="photo">${en ? 'Photo 3x4' : 'Ảnh 3x4'}</div>` : '';
  const keys = ['education', 'experience', 'skills', 'certs', 'objective', 'references'].filter((k) => p.sections[k]);
  const numbered = keys.map((k, i) => sec(p, k, `${ROMAN[i + 1]}. `)).join('');
  const css = `.center{text-align:center;margin-bottom:12px}.doctitle{font-size:20pt;color:#111}.sub{font-size:10pt;font-style:italic}
.form td{padding:3px 8px 3px 0;vertical-align:top}.form .k{width:150px;color:#444}.dl{margin:3px 0}
.photo{float:right;width:30mm;height:40mm;border:1px solid #999;text-align:center;padding-top:16mm;font-size:9pt;color:#777}`;
  const sub = cv.subtitle ? `<div class="sub">${cv.subtitle}</div>` : '';
  const body = `<div class="center"><div class="doctitle">${esc(docTitle)}</div>${sub}</div>${photo}<section class="sec"><h2>I. ${p.heading(
    'personal',
  )}</h2>${info}</section>${numbered}`;
  return { html: doc(cv, css, body), margin: PAGE_MARGIN };
}

function topcv(cv, p) {
  const grid = p.contact.map(([k, v]) => `<div class="ci"><span class="ic">${esc(k)}</span> ${esc(v)}</div>`).join('');
  const css = `.head{display:flex;gap:18px;align-items:center;border-bottom:3px solid ${cv.accent ?? '#00b14f'};padding-bottom:12px}
.avatar{width:90px;height:90px;border-radius:50%;background:#cfd8dc}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;margin:10px 0;font-size:10pt}
.ic{display:inline-block;min-width:18px;color:${cv.accent ?? '#00b14f'}}.sec h2{border:none;border-left:4px solid ${cv.accent ?? '#00b14f'};padding-left:8px}`;
  const body = `<div class="head"><div class="avatar"></div><div><h1>${p.name}</h1><div class="title">${p.title}</div></div></div><div class="grid">${grid}</div>${sec(
    p,
    'personal',
  )}${secs(p, ['objective', 'education', 'experience', 'projects', 'skills', 'certs', 'references', 'interests'])}`;
  return { html: doc(cv, css, body), margin: PAGE_MARGIN };
}

function vnw(cv, p) {
  const info = [...p.contact, ...(cv.personal ?? [])];
  const table =
    cv.infoCols === 4
      ? Array.from({ length: Math.ceil(info.length / 2) }, (_, i) => info.slice(i * 2, i * 2 + 2))
          .map((pair) => `<tr>${pair.map(([k, v]) => `<td class="k">${esc(k)}</td><td>${esc(v)}</td>`).join('')}</tr>`)
          .join('')
      : rows(info);
  const css = `.info{width:100%;border-collapse:collapse;margin:8px 0;font-size:10pt}.info td{border-bottom:1px solid #e3e3e3;padding:4px 6px}
.info .k{color:#666;width:22%}.wanted{font-size:10pt;color:#666}`;
  const wanted = cv.wanted ? `<div class="wanted">${esc(cv.wanted)}</div>` : '';
  const body = `<h1>${p.name}</h1><div class="title">${p.title}</div>${wanted}<table class="info">${table}</table>${secs(p, MAIN_ORDER)}`;
  return { html: doc(cv, css, body), margin: PAGE_MARGIN };
}

function canva(cv, p) {
  const accent = cv.accent ?? '#c27c5b';
  const css = `.hero{background:${accent}22;padding:28px 30px 18px;border-bottom:6px solid ${accent}}.hero h1{font-size:34pt;line-height:1.1;color:#333}
.hero .title{letter-spacing:0.3em;text-transform:uppercase;font-size:10.5pt;color:${accent};margin-top:8px}
.cols{display:grid;grid-template-columns:36% 1fr}.left{padding:16px 20px;background:#faf6f2}.right{padding:16px 24px}
.left .ci{margin-bottom:6px;font-size:9.5pt}.hello{font-family:Georgia;font-style:italic;font-size:15pt;color:${accent}}`;
  const hello = cv.hello ? `<div class="hello">${esc(cv.hello)}</div>` : '';
  const body = `<div class="hero">${hello}<h1>${p.name}</h1><div class="title">${p.title}</div></div><div class="cols"><div class="left"><section class="sec"><h2>${p.heading(
    'contact',
  )}</h2>${lines(p.contact)}</section>${secs(p, ['personal', 'education', 'skills', 'interests'])}</div><div class="right">${secs(
    p,
    ['objective', 'experience', 'projects', 'certs', 'references'],
  )}</div></div>`;
  return { html: doc(cv, css, body), margin: NO_MARGIN };
}

function table(cv, p) {
  const contact = lines(p.contact);
  const row = (label, html) => (html ? `<tr><th>${label}</th><td>${html}</td></tr>` : '');
  const head = cv.tableHeaderRow
    ? `<tr><td colspan="2" class="hd"><h1>${p.name}</h1><div class="title">${p.title}</div></td></tr>`
    : row(cv.lang === 'en' ? 'Full name' : 'Họ tên', `<b>${p.name}</b><div class="title">${p.title}</div>`);
  const css = `table.cv{width:100%;border-collapse:collapse}table.cv th,table.cv td{border:1px solid #888;padding:6px 8px;vertical-align:top;text-align:left}
table.cv th{width:24%;background:#f0f0f0;font-size:10pt}.hd{text-align:center}`;
  const body = `<table class="cv">${head}${row(p.heading('contact'), contact)}${MAIN_ORDER.concat('personal')
    .map((k) => row(p.heading(k), p.sections[k]))
    .join('')}</table>`;
  return { html: doc(cv, css, body), margin: PAGE_MARGIN };
}

export const TEMPLATES = { oneColumn, sidebar, banner, nameTitle, labelForm, topcv, vnw, canva, table };
