// Small hand-written PDFs Chrome cannot produce: password-protected files (standard security handler, RC4 40-bit) and
// files with no page content. ASCII text only (Helvetica).
import { createHash } from 'node:crypto';

const PAD = Buffer.from('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a', 'hex');

function rc4(key, data) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  let a = 0;
  let b = 0;
  return Buffer.from(
    data.map((byte) => {
      a = (a + 1) & 255;
      b = (b + s[a]) & 255;
      [s[a], s[b]] = [s[b], s[a]];
      return byte ^ s[(s[a] + s[b]) & 255];
    }),
  );
}

const md5 = (...parts) => createHash('md5').update(Buffer.concat(parts)).digest();
const padded = (pw) => Buffer.concat([Buffer.from(pw, 'latin1'), PAD]).subarray(0, 32);

function assemble(objects, trailerExtra) {
  const chunks = [Buffer.from('%PDF-1.4\n')];
  const offsets = [];
  let at = chunks[0].length;
  objects.forEach((body, i) => {
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')]);
    offsets.push(at);
    at += chunk.length;
    chunks.push(chunk);
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('')}`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${trailerExtra} >>\nstartxref\n${at}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer));
  return Buffer.concat(chunks);
}

function content(lines) {
  const ops = lines.map((l) => `(${l.replace(/([()\\])/g, '\\$1')}) Tj T*`).join('\n');
  return Buffer.from(`BT /F1 11 Tf 60 780 Td 16 TL\n${ops}\nET`, 'latin1');
}

const stream = (bytes) =>
  Buffer.concat([Buffer.from(`<< /Length ${bytes.length} >>\nstream\n`), bytes, Buffer.from('\nendstream')]);

const STRUCTURE = [
  Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
  Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
  Buffer.from(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  ),
  Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
];

/** A readable one-page PDF, no encryption. An empty `lines` gives a blank page. */
export const plainPdf = (lines) => assemble([...STRUCTURE, stream(content(lines))], '');

/** A PDF with no pages at all (the tree is valid, /Count is 0). */
export const zeroPagePdf = () =>
  assemble([Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'), Buffer.from('<< /Type /Pages /Kids [] /Count 0 >>')], '');

/**
 * Standard security handler, revision 2. An empty user password is what "owner-restricted" files use: they open
 * without asking, but printing or copying is limited. A non-empty one needs the password to open at all.
 */
export function encryptedPdf(lines, { userPassword, ownerPassword }) {
  const id = md5(Buffer.from(lines.join('|')));
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(-44);
  const o = rc4(md5(padded(ownerPassword)).subarray(0, 5), padded(userPassword));
  const key = md5(padded(userPassword), o, permissions, id).subarray(0, 5);
  const u = rc4(key, PAD);
  const objectNumber = 5;
  const objectKey = md5(key, Buffer.from([objectNumber & 255, (objectNumber >> 8) & 255, 0, 0, 0])).subarray(0, 10);
  const encrypted = rc4(objectKey, content(lines));
  const encryptDict = Buffer.from(
    `<< /Filter /Standard /V 1 /R 2 /O <${o.toString('hex')}> /U <${u.toString('hex')}> /P -44 >>`,
  );
  return assemble(
    [...STRUCTURE, stream(encrypted), encryptDict],
    `/Encrypt 6 0 R /ID [<${id.toString('hex')}> <${id.toString('hex')}>]`,
  );
}
