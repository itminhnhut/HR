// Bad files kept on disk for failure-paths.test.ts; the others are built from these bytes inside the test.
import { encryptedPdf, plainPdf, zeroPagePdf } from './raw-pdf.mjs';

const SECRET_CV = [
  'Cu Hoang Phi',
  'SDT: 0396 118 420',
  'Email: cu.hoangphi88@gmail.com',
  'Kinh nghiem: 5 nam ke toan tong hop',
];

export const BAD_FILES = {
  'encrypted-user-password.pdf': encryptedPdf(SECRET_CV, { userPassword: 'matkhau', ownerPassword: 'chu-so-huu' }),
  'blank-page.pdf': plainPdf([]),
  'zero-pages.pdf': zeroPagePdf(),
};
