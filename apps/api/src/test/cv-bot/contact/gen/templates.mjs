// Layouts for the cv-bot contact set, modelled on what TopCV, VietnamWorks, Canva and Word exports look like. unpdf
// reads text in drawing order, which follows the DOM, so DOM order is the point of each template.
import { fillerFor, shuffled, stripDiacritics } from './filler.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MARGIN = { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' };
const NONE = { top: '0', bottom: '0', left: '0', right: '0' };

function nameHtml(c) {
  if (c.nameHtml) return c.nameHtml;
  if (!c.n) return '';
  if (c.nameLines) return c.nameLines.map(esc).join('<br>');
  return c.spaced ? `<span style="letter-spacing:.32em">${esc(c.n)}</span>` : esc(c.n);
}

const lineList = (lines) => (lines ?? []).map((l) => `<div class="ci">${esc(l)}</div>`).join('');
const boldLabel = (line) => {
  const at = line.indexOf(': ');
  return at === -1 ? esc(line) : `<strong>${esc(line.slice(0, at + 1))}</strong> ${esc(line.slice(at + 2))}`;
};
const contactList = (c) =>
  c.ctHtml ??
  (c.boldLabels ? (c.ct ?? []).map((l) => `<div class="ci">${boldLabel(l)}</div>`).join('') : lineList(c.ct));
const sec = (title, inner) => (inner ? `<section><h2>${esc(title)}</h2>${inner}</section>` : '');

/** The body sections every template arranges in its own order. */
function sectionsOf(c) {
  const f = fillerFor(c.id, c.lang, c.pages ?? 1);
  const jobNotes = c.j ? lineList(c.j) : '';
  const jobs = f.jobs
    .map(
      (job) =>
        `<div class="job"><b>${esc(job.head)}</b><div class="pd">${job.period}</div><ul>${job.bullets
          .map((b) => `<li>${esc(b)}</li>`)
          .join('')}</ul></div>`,
    )
    .join('');
  return {
    heads: f.heads,
    r: f.r,
    summary: sec(f.heads.summary, `<p>${esc(f.summary)}</p>`),
    exp: sec(f.heads.exp, jobs + jobNotes),
    edu: sec(f.heads.edu, `<div><b>${esc(f.school)}</b><div class="pd">${f.years}</div>${esc(f.major)}</div>`),
    skills: sec(f.heads.skills, `<div>${f.skills.map(esc).join(', ')}</div>`),
    refs: c.rf ? sec(f.heads.refs, lineList(c.rf)) : '',
    personal: c.p ? sec(f.heads.personal, lineList(c.p)) : '',
    extra: c.after ? lineList(c.after) : '',
    contactSec: sec(f.heads.contact, contactList(c)),
  };
}

const above = (c) => (c.ab ? `<div class="ab">${lineList(c.ab)}</div>` : '');
const footer = (c) => (c.ft ? `<div class="ft">${lineList(c.ft)}</div>` : '');

/** Word's usual font, which has every Vietnamese glyph. A case can name one that lacks some: Chrome then falls back per
 * glyph and the syllable comes out split ("v ớ i"), as with any PDF whose font lacks the letter. */
const wordFont = (c) => c.font ?? "'Times New Roman'";
/** Times New Roman subsets are large; one size per file keeps these PDFs small. */
const ONE_SIZE = 'h1,h1 *{font-size:10pt!important}';

function doc(c, css, body, font = "'Helvetica Neue'") {
  // Chrome embeds a new font subset per font size, so only two sizes keep each PDF small.
  const base = `*{box-sizing:border-box;font-size:10pt!important}h1,h1 *{font-size:20pt!important}body{margin:0;font-family:${font},sans-serif;font-size:10pt;line-height:1.35;color:#222}
h1{margin:0;font-size:22pt;font-weight:normal}h2{font-size:11pt;font-weight:normal;margin:10px 0 4px;border-bottom:1px solid #bbb}b{font-weight:normal}ul{margin:2px 0 6px 16px;padding:0}
p{margin:2px 0}.pd{font-size:9pt;color:#666}.t{font-size:12pt;color:#555;margin-bottom:4px}.ab{margin-bottom:6px;color:#555}
.ft{margin-top:14px;border-top:1px solid #ccc;padding-top:4px;font-size:8.5pt;color:#777}`;
  const title = c.docTitle ? `<title>${esc(c.docTitle)}</title>` : '';
  const html = `<!doctype html><html lang="${c.lang === 'en' ? 'en' : 'vi'}"><head><meta charset="utf-8">${title}<style>${base}${css}</style></head><body>${body}</body></html>`;
  return c.lang === 'novn' ? stripDiacritics(html) : html;
}

function topcvModern(c) {
  const s = sectionsOf(c);
  const css = `.hd{display:flex;gap:16px;align-items:center;border-bottom:3px solid #0a8f4d;padding-bottom:8px}.av{width:80px;height:80px;border-radius:50%;background:#cdd}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;margin:8px 0}`;
  const body = `${above(c)}<div class="hd"><div class="av"></div><div><h1>${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div></div></div>
<div class="grid">${contactList(c)}</div>${s.personal}${s.summary}${s.edu}${s.exp}${s.skills}${s.refs}${s.extra}${footer(c)}`;
  return { html: doc(c, css, body), margin: MARGIN };
}

function topcv2col(c) {
  const s = sectionsOf(c);
  const css = `.wrap{display:flex;min-height:297mm}.side{width:33%;background:#eef6f1;padding:16px 12px;${c.breakAll ? 'word-break:break-all;' : ''}}
.main{flex:1;padding:16px 18px}.av{width:90px;height:90px;border-radius:50%;background:#bcd;margin:0 auto 10px}`;
  const body = `<div class="wrap"><aside class="side"><div class="av"></div>${above(c)}${s.contactSec}${s.personal}${s.skills}${s.refs}${s.extra}</aside>
<main class="main"><h1>${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div>${s.summary}${s.exp}${s.edu}${footer(c)}</main></div>`;
  return { html: doc(c, css, body), margin: NONE };
}

function vnwExport(c) {
  const s = sectionsOf(c);
  const pairs = [...(c.ct ?? []), ...(c.p ?? [])].map((line) => {
    const at = line.indexOf(': ');
    return at === -1 ? ['', line] : [line.slice(0, at + 1), line.slice(at + 2)];
  });
  const rows = Array.from({ length: Math.ceil(pairs.length / 2) }, (_, i) => pairs.slice(i * 2, i * 2 + 2))
    .map((pair) => `<tr>${pair.map(([k, v]) => `<td class="k">${esc(k)}</td><td>${esc(v)}</td>`).join('')}</tr>`)
    .join('');
  const css = `.brand{display:flex;justify-content:space-between;font-size:9pt;color:#666;border-bottom:2px solid #f60;padding-bottom:4px;margin-bottom:8px}
table.i{width:100%;border-collapse:collapse;margin:8px 0}table.i td{border-bottom:1px solid #ddd;padding:3px 5px;font-size:9.5pt}.k{color:#777;width:17%}`;
  const brand = c.brand ?? ['HỒ SƠ ỨNG VIÊN', 'Mã hồ sơ: 8812731', 'Cập nhật: 12/09/2026'];
  const body = `<div class="brand">${brand.map((b) => `<span>${esc(b)}</span>`).join('')}</div>${above(c)}<h1>${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div>
<table class="i">${rows}</table>${s.summary}${s.exp}${s.edu}${s.skills}${s.refs}${s.extra}${footer(c)}`;
  return { html: doc(c, css, body), margin: MARGIN };
}

/** Canva: independent text boxes, drawn in layer order, so the name can come anywhere in the text layer. */
function canvaAbs(c) {
  const s = sectionsOf(c);
  const pos = {
    name: 'left:12mm;top:12mm;width:120mm;line-height:1.1',
    title: 'left:12mm;top:40mm;width:120mm;font-size:12pt;letter-spacing:.2em;text-transform:uppercase;color:#a56',
    contact: 'left:140mm;top:12mm;width:62mm;font-size:9.5pt',
    summary: 'left:12mm;top:50mm;width:120mm',
    exp: 'left:12mm;top:75mm;width:120mm',
    edu: 'left:140mm;top:60mm;width:62mm',
    skills: 'left:140mm;top:105mm;width:62mm',
    refs: 'left:140mm;top:140mm;width:62mm;font-size:9pt',
    personal: 'left:140mm;top:185mm;width:62mm;font-size:9pt',
    ab: 'left:12mm;top:4mm;width:120mm;font-size:9pt',
    ft: 'left:12mm;top:275mm;width:180mm;font-size:8pt',
  };
  const inner = {
    name: nameHtml(c),
    title: esc(c.t ?? ''),
    contact: contactList(c),
    summary: s.summary,
    exp: s.exp,
    edu: s.edu,
    skills: s.skills,
    refs: s.refs,
    personal: s.personal,
    ab: c.ab ? lineList(c.ab) : '',
    ft: c.ft ? lineList(c.ft) : '',
  };
  const keys = Object.keys(inner).filter((k) => inner[k]);
  const order = c.order ?? shuffled(s.r, keys);
  const body = `<div class="pg">${order.map((k) => `<div class="b" style="${pos[k]}">${k === 'name' ? `<h1>${inner[k]}</h1>` : inner[k]}</div>`).join('')}</div>`;
  const css = `.pg{position:relative;width:210mm;height:296mm;background:#fbf7f3;overflow:hidden}.b{position:absolute}h2{font-size:10.5pt}`;
  return { html: doc(c, css, body), margin: NONE };
}

/** Canva hero: a huge name, often over two lines, then two columns. */
function canvaHero(c) {
  const s = sectionsOf(c);
  const css = `.hero{background:#2d3e50;color:#fff;padding:24px 26px}.hero h1{font-size:36pt;line-height:1.05;font-weight:normal}.hero .t{color:#cde;letter-spacing:.25em;text-transform:uppercase;font-size:10pt;margin-top:6px}
.cols{display:grid;grid-template-columns:38% 1fr}.l{padding:12px 16px;background:#f3f3f3}.r{padding:12px 18px}.hello{font-size:14pt}`;
  const hello = c.hello ? `<div class="hello">${esc(c.hello)}</div>` : '';
  const body = `<div class="hero">${hello}<h1>${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div></div>${above(c)}
<div class="cols"><div class="l">${s.contactSec}${s.personal}${s.edu}${s.skills}</div><div class="r">${s.summary}${s.exp}${s.refs}${s.extra}${footer(c)}</div></div>`;
  return { html: doc(c, css, body), margin: NONE };
}

/** Word: a plain letter-like page in Times New Roman. */
function wordPlain(c) {
  const s = sectionsOf(c);
  const css = `${ONE_SIZE}.c{text-align:center}h1{font-size:18pt}.ci{white-space:pre-wrap}`;
  const docTitle = c.dt ? `<div class="c"><b>${esc(c.dt)}</b></div>` : '';
  const body = `${above(c)}${docTitle}<div class="c"><h1>${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div>${contactList(c)}</div>
${s.personal}${s.summary}${s.exp}${s.edu}${s.skills}${s.refs}${s.extra}${footer(c)}`;
  return { html: doc(c, css, body, wordFont(c)), margin: MARGIN };
}

/** Word table: the header is a table, name on the left, contact on the right; the body is label/value rows. */
function wordTable(c) {
  const s = sectionsOf(c);
  const css = `${ONE_SIZE}strong{font-weight:bold}table{width:100%;border-collapse:collapse}td{border:1px solid #999;padding:5px 7px;vertical-align:top}td.l{width:52%}`;
  const cells = [
    `<td class="l"><h1 style="font-size:17pt">${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div></td>`,
    `<td>${contactList(c)}</td>`,
  ];
  const head = c.contactLeft ? [...cells].reverse().join('') : cells.join('');
  const body = `${above(c)}<table><tr>${head}</tr></table>${s.personal}${s.summary}${s.exp}${s.edu}${s.skills}${s.refs}${s.extra}${footer(c)}`;
  return { html: doc(c, css, body, wordFont(c)), margin: MARGIN };
}

/** Word with a real page header/footer: the name can live only there (Chrome's header template). */
function wordHeader(c) {
  const s = sectionsOf(c);
  const band = (text) =>
    text
      ? `<div style="font-size:10pt;width:100%;padding:0 14mm;color:#333;font-family:'Times New Roman'">${esc(c.lang === 'novn' ? stripDiacritics(text) : text)}</div>`
      : '<span></span>';
  const css = `${ONE_SIZE}h1{font-size:16pt}`;
  const body = `${above(c)}${c.n ? `<h1>${nameHtml(c)}</h1>` : ''}${c.dt ? `<h1>${esc(c.dt)}</h1>` : ''}<div class="t">${esc(c.t ?? '')}</div>${contactList(c)}
${s.personal}${s.summary}${s.exp}${s.edu}${s.skills}${s.refs}${s.extra}${footer(c)}`;
  return {
    html: doc(c, css, body, wordFont(c)),
    margin: { ...MARGIN, top: '26mm', bottom: '22mm' },
    header: band(c.hdr),
    footer: band(c.ftr),
  };
}

/** Three columns; `cols` says which order they sit in the DOM. */
function threeCol(c) {
  const s = sectionsOf(c);
  const cols = {
    a: `<div class="col">${s.summary}${s.skills}${s.personal}${s.extra}</div>`,
    b: `<div class="col mid">${above(c)}<h1>${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div>${s.exp}</div>`,
    c: `<div class="col">${s.contactSec}${s.edu}${s.refs}</div>`,
  };
  const css = `.w{display:grid;grid-template-columns:27% 1fr 27%;min-height:297mm}.col{padding:12px 10px;font-size:9.5pt}.mid{background:#f7f7f7}h1{font-size:18pt}`;
  const order = [...(c.cols ?? 'abc')].map((k) => cols[k]).join('');
  return { html: doc(c, css, `<div class="w">${order}</div>`), margin: NONE };
}

/** Main column first, contact and references in a right sidebar that comes out last. */
function rightSide(c) {
  const s = sectionsOf(c);
  const css = `.w{display:flex;min-height:297mm}.m{flex:1;padding:16px 18px}.s{width:32%;background:#223;color:#eee;padding:16px 12px}.s h2{border-color:#667}`;
  const body = `<div class="w"><main class="m">${above(c)}<h1>${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div>${s.summary}${s.exp}${s.edu}${s.extra}${footer(c)}</main>
<aside class="s">${s.contactSec}${s.personal}${s.skills}${s.refs}</aside></div>`;
  return { html: doc(c, css, body), margin: NONE };
}

const SVG = {
  phone:
    '<svg width="11" height="11" viewBox="0 0 16 16"><path d="M3 1l3 3-2 2c1 3 3 5 6 6l2-2 3 3-2 3C6 16 0 10 1 3z"/></svg>',
  mail: '<svg width="11" height="11" viewBox="0 0 16 16"><path d="M1 3h14v10H1zM1 3l7 6 7-6" fill="none" stroke="#000"/></svg>',
  pin: '<svg width="11" height="11" viewBox="0 0 16 16"><circle cx="8" cy="6" r="4"/><path d="M4 8l4 7 4-7"/></svg>',
};

/** Vector icons instead of labels: the text layer holds only the bare values, on one row or stacked. */
function iconRow(c) {
  const s = sectionsOf(c);
  const icon = (i) => SVG[['phone', 'mail', 'pin'][i % 3]];
  const items = (c.ct ?? []).map((v, i) => `<span class="it">${icon(i)} ${esc(v)}</span>`).join('');
  const css = `.row{display:flex;flex-wrap:wrap;gap:4px 14px;margin:6px 0;font-size:9.5pt}.it{display:inline-flex;gap:4px;align-items:center}${
    c.stacked ? '.row{flex-direction:column}' : ''
  }`;
  const body = `${above(c)}<h1>${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div><div class="row">${items}</div>${s.personal}${s.summary}${s.exp}${s.edu}${s.skills}${s.refs}${s.extra}${footer(c)}`;
  return { html: doc(c, css, body), margin: MARGIN };
}

/** ATS-friendly résumé in English. */
function atsEn(c) {
  const s = sectionsOf(c);
  const css = `h1{font-size:19pt}.ci{display:inline}.ci:not(:last-child)::after{content:"  •  "}`;
  const body = `${above(c)}<h1>${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div><div>${contactList(c)}</div>${s.summary}${s.exp}${s.edu}${s.skills}${s.personal}${s.refs}${s.extra}${footer(c)}`;
  return { html: doc(c, css, body), margin: MARGIN };
}

/** Vietnamese form: "SƠ YẾU LÝ LỊCH" with dotted leaders and family rows. */
function formDots(c) {
  const s = sectionsOf(c);
  const rows = c.form.map((l) => `<div class="dl">${esc(l)}</div>`).join('');
  const css = `${ONE_SIZE}.dt{text-align:center;font-size:17pt;margin-bottom:8px}.dl{margin:3px 0}.ph{float:right;width:28mm;height:38mm;border:1px solid #999;text-align:center;padding-top:14mm;font-size:9pt;color:#777}`;
  const body = `${above(c)}<div class="dt">${esc(c.dt ?? 'SƠ YẾU LÝ LỊCH')}</div><div class="ph">Ảnh 4x6</div>${rows}${s.exp}${s.edu}${s.refs}${s.extra}${footer(c)}`;
  return { html: doc(c, css, body, wordFont(c)), margin: MARGIN };
}

/** Cover letter on page 1, CV on page 2: the recruiter's name and contacts come first. */
function coverThenCv(c) {
  const s = sectionsOf(c);
  const letter = (c.letter ?? []).map((l) => `<p>${esc(l)}</p>`).join('');
  const css = `${ONE_SIZE}.lt{height:265mm;page-break-after:always}.lt h1{font-size:15pt;text-align:center;margin-bottom:10px}h1{font-size:18pt}`;
  const body = `<div class="lt"><h1>${esc(c.lang === 'en' ? 'COVER LETTER' : 'THƯ XIN VIỆC')}</h1>${letter}</div>
<h1>${nameHtml(c)}</h1><div class="t">${esc(c.t ?? '')}</div>${contactList(c)}${s.summary}${s.exp}${s.edu}${s.skills}${s.refs}`;
  return { html: doc(c, css, body, wordFont(c)), margin: MARGIN };
}

/** Rendered by generate.mjs into an image-only page; this is the page that gets photographed. */
const scan = (c) => wordPlain(c);

export const TEMPLATES = {
  topcvModern,
  topcv2col,
  vnwExport,
  canvaAbs,
  canvaHero,
  wordPlain,
  wordTable,
  wordHeader,
  threeCol,
  rightSide,
  iconRow,
  atsEn,
  formDots,
  coverThenCv,
  scan,
};
