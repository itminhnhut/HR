// Builds the cv-bot contact held-out set: cases-*.mjs → HTML (templates.mjs) → A4 PDF (Chrome via puppeteer-core) →
// text via the site's own pdfText(). Never runs parseCvContact: expected values come only from the case files.
//
// Run from apps/api:
//   PUPPETEER_CORE_DIR=<dir with node_modules/puppeteer-core> npx tsx src/test/cv-bot/contact/gen/generate.mjs [--only id1,id2]
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocumentProxy } from 'unpdf';
import { pdfText } from '../../../../lib/pdf-text.ts';
import { ALL_CASES, BAD_FILES } from './cases.mjs';
import { TEMPLATES } from './templates.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PDFS = join(ROOT, 'pdfs');
const FIXTURES = join(ROOT, 'fixtures');
const BAD = join(ROOT, 'bad');
const TUNED = [
  new URL('../../../cv-contact/expected.json', import.meta.url),
  new URL('../../../cv-contact/holdout/expected.json', import.meta.url),
];
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function loadPuppeteer() {
  const dir = process.env.PUPPETEER_CORE_DIR;
  const require = createRequire(dir ? join(dir, 'noop.js') : import.meta.url);
  return require('puppeteer-core');
}

const expectedOf = (c) => ({
  id: c.id,
  layout: c.layout,
  focus: c.focus,
  path: c.text === undefined ? 'pdf' : 'text',
  notes: c.note ?? '',
  fullName: c.exp[0],
  phone: c.exp[1],
  email: c.exp[2],
  ...(c.alt ? { alsoAccept: c.alt } : {}),
  ...(c.unreadable ? { readable: false } : {}),
});

/** An expected value must be readable in the text layer, unless the case says the value has been converted. */
function presenceProblems(exp, c, text) {
  const squash = (s) =>
    s
      .normalize('NFC')
      .toLowerCase()
      .replace(/[\s ​­]+/g, '');
  const flat = squash(text);
  const digits = text.normalize('NFKC').replace(/\D/g, '');
  const problems = [];
  if (exp.fullName && !c.nameConverted && !flat.includes(squash(exp.fullName))) problems.push(`name "${exp.fullName}"`);
  if (exp.phone && !c.phoneConverted && !digits.includes(exp.phone.slice(1))) problems.push(`phone ${exp.phone}`);
  if (exp.email && !c.emailConverted && !flat.normalize('NFKC').includes(exp.email))
    problems.push(`email ${exp.email}`);
  return problems;
}

function checkData(cases) {
  const seen = new Set();
  const tuned = TUNED.flatMap((u) => JSON.parse(readFileSync(u, 'utf8')));
  const banned = new Set(tuned.flatMap((e) => [e.fullName, e.phone, e.email]).filter(Boolean));
  const problems = [];
  for (const c of cases) {
    if (seen.has(c.id)) problems.push(`duplicate id ${c.id}`);
    seen.add(c.id);
    if (c.text === undefined && !c.raw && !TEMPLATES[c.tpl]) problems.push(`${c.id}: unknown template ${c.tpl}`);
    for (const v of c.exp) if (v && banned.has(v)) problems.push(`${c.id}: "${v}" is in the tuned corpus`);
  }
  return problems;
}

async function imageOf(page, html) {
  await page.setViewport({ width: 620, height: 877, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  const shot = await page.screenshot({ type: 'jpeg', quality: 30, encoding: 'base64' });
  return `data:image/jpeg;base64,${shot}`;
}

async function renderScan(page, c) {
  const { html } = TEMPLATES.wordPlain(c);
  const src = await imageOf(page, html);
  const ft = c.scanFooter ? `<div style="font:7pt Arial;color:#888;text-align:right">${c.scanFooter}</div>` : '';
  const pages = Array.from(
    { length: c.scanPages ?? 1 },
    (_, i) =>
      `<div style="${i < (c.scanPages ?? 1) - 1 ? 'page-break-after:always;' : ''}"><img src="${src}" style="width:100%;height:280mm;object-fit:contain;display:block">${ft}</div>`,
  ).join('');
  await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0">${pages}</body>`, {
    waitUntil: 'load',
  });
  return page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
}

async function nameImage(page, c) {
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="n" style="display:inline-block;padding:4px 8px;font:bold 26px 'Helvetica Neue'">${c.imgName}</div></body>`,
  );
  const el = await page.$('#n');
  const png = await el.screenshot({ encoding: 'base64' });
  return `<img alt="" src="data:image/png;base64,${png}" style="height:38px">`;
}

async function render(page, c) {
  if (c.tpl === 'scan') return renderScan(page, c);
  const withImage = c.imgName ? { ...c, nameHtml: await nameImage(page, c) } : c;
  const { html, margin, header, footer } = TEMPLATES[c.tpl](withImage);
  await page.setContent(html, { waitUntil: 'load' });
  return page.pdf({
    format: 'A4',
    printBackground: true,
    margin,
    tagged: false,
    outline: false,
    displayHeaderFooter: Boolean(header || footer),
    headerTemplate: header ?? '<span></span>',
    footerTemplate: footer ?? '<span></span>',
  });
}

async function main() {
  const problems = checkData(ALL_CASES);
  if (problems.length) throw new Error(problems.join('\n'));
  const only = arg('--only')?.split(',');
  const selected = only ? ALL_CASES.filter((c) => only.includes(c.id)) : ALL_CASES;
  for (const dir of [PDFS, FIXTURES, BAD]) mkdirSync(dir, { recursive: true });

  for (const [name, bytes] of Object.entries(BAD_FILES)) writeFileSync(join(BAD, name), bytes);

  const puppeteer = loadPuppeteer();
  let browser = await puppeteer.launch({ executablePath: CHROME });
  const rows = [];
  try {
    for (const [i, c] of selected.entries()) {
      // A fresh browser every so often: one long-lived page ends up stuck after a couple of hundred PDFs.
      if (i > 0 && i % 40 === 0) {
        await browser.close();
        browser = await puppeteer.launch({ executablePath: CHROME });
      }
      const page = await browser.newPage();
      page.setDefaultTimeout(120_000);
      const exp = expectedOf(c);
      if (c.text !== undefined) {
        writeFileSync(join(FIXTURES, `${c.id}.txt`), c.text);
        rows.push({ id: c.id, pages: 0, bytes: 0, chars: c.text.length, problems: presenceProblems(exp, c, c.text) });
        await page.close();
        continue;
      }
      await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
      const pdf = new Uint8Array(c.raw ? c.raw : await render(page, c));
      writeFileSync(join(PDFS, `${c.id}.pdf`), pdf);
      const pages = (await getDocumentProxy(pdf.slice())).numPages;
      const text = await pdfText(pdf.slice());
      writeFileSync(join(FIXTURES, `${c.id}.txt`), text);
      const pageProblem = c.minPages && pages < c.minPages ? [`${pages} pages, wanted at least ${c.minPages}`] : [];
      rows.push({
        id: c.id,
        pages,
        bytes: pdf.length,
        chars: text.length,
        problems: [...presenceProblems(exp, c, text), ...pageProblem],
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  writeFileSync(join(ROOT, 'expected.json'), `${JSON.stringify(ALL_CASES.map(expectedOf), null, 2)}\n`);

  if (!only) {
    const ids = new Set(ALL_CASES.map((c) => c.id));
    for (const dir of [PDFS, FIXTURES])
      for (const f of readdirSync(dir)) if (!ids.has(f.replace(/\.(pdf|txt)$/, ''))) rmSync(join(dir, f));
  }

  for (const r of rows) {
    const flag = r.problems.length ? `  !! not in text: ${r.problems.join('; ')}` : '';
    console.log(
      `${r.id.padEnd(30)} ${String(r.pages).padStart(2)}p ${String(Math.round(r.bytes / 1024)).padStart(4)} KB ${String(r.chars).padStart(6)} ch${flag}`,
    );
  }
  const total = rows.reduce((sum, r) => sum + r.bytes, 0);
  const bad = rows.filter((r) => r.problems.length);
  console.log(`\n${rows.length} cases, PDFs ${Math.round(total / 1024)} KB in all, ${bad.length} with problems.`);
  if (bad.length || !existsSync(join(ROOT, 'expected.json'))) process.exitCode = 1;
}

await main();
