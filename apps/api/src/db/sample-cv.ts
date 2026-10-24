/**
 * A small, valid one-page PDF ("CV mẫu") for local demo data, so "Xem CV" opens a real file.
 * Built by hand: plain ASCII text, with the cross-reference offsets computed below.
 */
export function sampleCvPdf(fullName: string): Uint8Array<ArrayBuffer> {
  // Built-in Helvetica has no Vietnamese tones; the sample only needs to open.
  const ascii = fullName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  const safe = ascii.replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '');
  const text = [
    `BT /F1 22 Tf 60 760 Td (${safe}) Tj ET`,
    'BT /F1 12 Tf 60 730 Td (CV mau - du lieu thu tren may) Tj ET',
    'BT /F1 12 Tf 60 700 Td (Kinh nghiem: 2 nam lam viec van phong) Tj ET',
    'BT /F1 12 Tf 60 680 Td (Hoc van: Cao dang) Tj ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}
