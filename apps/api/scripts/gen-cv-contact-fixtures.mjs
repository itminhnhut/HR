// Generates the synthetic CV corpus for the parseCvContact tests (apps/api/src/test/cv-contact/).
// Every person, phone number, email and company in the corpus is fictional.
//
// Pipeline per case: data (scripts/cv-contact/cases-*.mjs) → HTML (templates.mjs) → PDF (Chrome via puppeteer-core)
// → text via the site's own pdfText() (src/lib/pdf-text.ts, unpdf) → fixtures/<id>.txt + expected.json.
//
// Run from apps/api (tsx is needed because pdf-text.ts is TypeScript):
//   PUPPETEER_CORE_DIR=/path/with/node_modules/puppeteer-core npx tsx scripts/gen-cv-contact-fixtures.mjs
// Options: --set holdout    build the held-out set (cases-holdout.mjs → src/test/cv-contact/holdout/, no PDFs kept)
//          --only id1,id2   regenerate some cases and merge them into expected.json
//          --pdf-out <dir>  where to keep every rendered PDF (default: a temp dir)
// Env:     CHROME_PATH       Chrome/Chromium binary (default: macOS Google Chrome)
//          PUPPETEER_CORE_DIR folder whose node_modules has puppeteer-core (default: normal resolution)
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocumentProxy } from 'unpdf';
import { pdfText } from '../src/lib/pdf-text.ts';
import { CASES } from './cv-contact/cases.mjs';
import { HOLDOUT_CASES } from './cv-contact/cases-holdout.mjs';
import { normalizePhone, stripDiacritics } from './cv-contact/filler.mjs';
import { buildParts } from './cv-contact/parts.mjs';
import { TEMPLATES } from './cv-contact/templates.mjs';

const ROOT = fileURLToPath(new URL('../src/test/cv-contact/', import.meta.url));
/** main: the tuning corpus (with kept PDFs); holdout: a separate set for measuring the parser honestly. */
const SETS = {
  main: { cases: CASES, out: ROOT },
  holdout: { cases: HOLDOUT_CASES, out: join(ROOT, 'holdout') },
};
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_KEPT_PDF_BYTES = 150_000;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function loadPuppeteer() {
  const dir = process.env.PUPPETEER_CORE_DIR;
  const require = createRequire(dir ? join(dir, 'noop.js') : import.meta.url);
  return require('puppeteer-core');
}

function expectedOf(cv) {
  const { name, phone, email } = cv.person;
  return {
    id: cv.id,
    layout: cv.layout,
    notes: cv.notes,
    fullName: name ?? null,
    phone: phone ? normalizePhone(phone) : null,
    email: email ? email.replace(/^mailto:/i, '').toLowerCase() : null,
    ...cv.expect,
  };
}

/** Warn when an expected value cannot be found in the extracted text at all (a generator or data bug). */
function presenceProblems(exp, text) {
  const squash = (s) => s.normalize('NFC').toLowerCase().replace(/\s+/g, '');
  const flat = squash(text);
  const digits = text.replace(/\D/g, '');
  const problems = [];
  if (exp.fullName && !flat.includes(squash(exp.fullName))) problems.push(`name "${exp.fullName}" not in text`);
  if (exp.phone && !digits.includes(exp.phone.slice(1))) problems.push(`phone ${exp.phone} not in text`);
  if (exp.email && !flat.includes(exp.email)) problems.push(`email ${exp.email} not in text`);
  return problems;
}

/** Copy a rendered PDF into pdfs/, unless the kept one already gives the same text (Chrome stamps every PDF with a
 * new date and id, so re-copying would churn binary files in git for nothing). */
async function keepPdf(pdfs, id, pdfOut, text) {
  const target = join(pdfs, `${id}.pdf`);
  if (existsSync(target) && (await pdfText(new Uint8Array(readFileSync(target)))) === text) return;
  copyFileSync(join(pdfOut, `${id}.pdf`), target);
}

async function nameImage(page, cv) {
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="n" style="display:inline-block;padding:6px 10px;font:bold 34px Georgia;color:#7a3e2b">${cv.person.displayName}</div></body>`,
  );
  const el = await page.$('#n');
  const png = await el.screenshot({ encoding: 'base64' });
  return `<img alt="" src="data:image/png;base64,${png}" style="height:46px">`;
}

async function render(page, cv) {
  const withImage = cv.nameAsImage ? { ...cv, nameHtml: await nameImage(page, cv) } : cv;
  const parts = buildParts(withImage);
  const { html, margin } = TEMPLATES[cv.template](withImage, parts);
  let finalHtml = cv.lang === 'novn' ? stripDiacritics(html) : html;
  if (cv.nfd) finalHtml = finalHtml.normalize('NFD');
  await page.setContent(finalHtml, { waitUntil: 'load' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin });
  return new Uint8Array(pdf);
}

function checkCases(cases) {
  const seen = new Set();
  for (const cv of cases) {
    if (seen.has(cv.id)) throw new Error(`Duplicate case id ${cv.id}`);
    seen.add(cv.id);
    if (!TEMPLATES[cv.template]) throw new Error(`${cv.id}: unknown template ${cv.template}`);
    if (!cv.layout || !cv.notes) throw new Error(`${cv.id}: layout and notes are required`);
  }
}

async function main() {
  const setName = arg('--set') ?? 'main';
  const set = SETS[setName];
  if (!set) throw new Error(`Unknown set ${setName}`);
  const { cases, out } = set;
  checkCases(setName === 'main' ? cases : [...CASES, ...cases]);
  const fixtures = join(out, 'fixtures');
  const pdfs = join(out, 'pdfs');
  const only = arg('--only')?.split(',');
  const selected = only ? cases.filter((c) => only.includes(c.id)) : cases;
  const pdfOut = arg('--pdf-out') ?? mkdtempSync(join(tmpdir(), 'cv-contact-'));
  for (const dir of [fixtures, pdfOut]) mkdirSync(dir, { recursive: true });

  const puppeteer = loadPuppeteer();
  const browser = await puppeteer.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const results = [];
  try {
    for (const cv of selected) {
      const pdf = await render(page, cv);
      writeFileSync(join(pdfOut, `${cv.id}.pdf`), pdf);
      // pdf.js may detach the buffer it is given, so each reader gets its own copy.
      const pages = (await getDocumentProxy(pdf.slice())).numPages;
      const text = await pdfText(pdf.slice());
      writeFileSync(join(fixtures, `${cv.id}.txt`), text);
      if (cv.keepPdf) {
        mkdirSync(pdfs, { recursive: true });
        await keepPdf(pdfs, cv.id, pdfOut, text);
      }
      const exp = expectedOf(cv);
      const problems = presenceProblems(exp, text);
      if (cv.keepPdf && pdf.length > MAX_KEPT_PDF_BYTES) problems.push(`kept PDF is ${pdf.length} bytes`);
      results.push({ exp, pages, bytes: pdf.length, chars: text.length, problems });
    }
  } finally {
    await browser.close();
  }

  const expectedPath = join(out, 'expected.json');
  const previous = only && existsSync(expectedPath) ? JSON.parse(readFileSync(expectedPath, 'utf8')) : [];
  const byId = new Map(previous.map((e) => [e.id, e]));
  for (const r of results) byId.set(r.exp.id, r.exp);
  const ordered = cases.map((c) => byId.get(c.id)).filter(Boolean);
  writeFileSync(expectedPath, `${JSON.stringify(ordered, null, 2)}\n`);

  if (!only) {
    const ids = new Set(cases.map((c) => c.id));
    const kept = new Set(cases.filter((c) => c.keepPdf).map((c) => c.id));
    for (const f of readdirSync(fixtures)) if (!ids.has(f.replace(/\.txt$/, ''))) rmSync(join(fixtures, f));
    if (existsSync(pdfs))
      for (const f of readdirSync(pdfs)) if (!kept.has(f.replace(/\.pdf$/, ''))) rmSync(join(pdfs, f));
  }

  for (const r of results) {
    const flag = r.problems.length ? `  !! ${r.problems.join('; ')}` : '';
    console.log(
      `${r.exp.id.padEnd(34)} ${String(r.pages).padStart(2)}p ${String(Math.round(r.bytes / 1024)).padStart(4)} KB ${String(r.chars).padStart(6)} ch${flag}`,
    );
  }
  const bad = results.filter((r) => r.problems.length);
  console.log(`\n${setName}: ${results.length} CVs rendered, PDFs in ${pdfOut}, ${bad.length} with problems.`);
  if (bad.length) process.exitCode = 1;
}

await main();
