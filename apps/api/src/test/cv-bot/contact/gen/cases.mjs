// Merges the case files and defines the helper they use. Every person, number, address and company is invented.
export { BAD_FILES } from './cases-bad.mjs';
import { LAYOUT_CASES } from './cases-layout.mjs';
import { NAME_CASES } from './cases-name.mjs';
import { PHONE_CASES } from './cases-phone.mjs';
import { NOISE_CASES } from './cases-noise.mjs';
import { EMAIL_CASES } from './cases-email.mjs';
import { NONE_CASES } from './cases-none.mjs';
import { TEXT_CASES } from './cases-text.mjs';

export const ALL_CASES = [
  ...LAYOUT_CASES,
  ...NAME_CASES,
  ...PHONE_CASES,
  ...NOISE_CASES,
  ...EMAIL_CASES,
  ...NONE_CASES,
  ...TEXT_CASES,
];
