// The corpus: every case, with defaults filled in. Add a case to one of the cases-*.mjs arrays and rerun
// scripts/gen-cv-contact-fixtures.mjs.
//
// Case fields (only id, layout, notes, person are required):
//   id, layout, notes          → copied to expected.json
//   person                     { name, displayName?, phone?, email?, address? } — name is the expected fullName
//                              (title case, as the CV spells it); phone/email are written as displayed and normalised
//                              for expected.json; address null hides the address line
//   expect                     overrides expected values (e.g. { email: null } when the text layer lacks it)
//   template                   oneColumn | sidebar | banner | nameTitle | labelForm | topcv | vnw | canva | table
//   lang                       vi | en | mixed (bilingual headings) | novn (whole CV stripped of diacritics)
//   role                       filler content: sales | accounting | it | marketing | hr | logistics | design |
//                              teacher | nurse | cs
//   nameCase / nameEffect      upper | as-is ; spaced-css | spaced-literal | split | split-spaced (+ nameSplitAt)
//   contactStyle / contact / contactExtra   label set for the default contact pairs, or explicit [label, value] pairs
//   personal                   [label, value] rows (date of birth, CCCD, salary…)
//   references, companyContact, companyOverride, manager, gpa, salary, pages (1–3), contactAtEnd, titleFirst,
//   top (raw HTML first line), title, font, accent, sidebar {side,name,refs,contact,width,breakWords}, sep,
//   formStyle, photoBox, nameLabel, formRows, subtitle, wanted, infoCols, hello, tableHeaderRow, contactBelowBanner,
//   footer (raw HTML after the last section), nameHtml (raw HTML replacing the rendered name),
//   nameAsImage, nfd, keepPdf (copy the PDF into src/test/cv-contact/pdfs for the end-to-end test)
import { BASIC_CASES } from './cases-basic.mjs';
import { HARD_CASES } from './cases-hard.mjs';
import { STYLE_CASES } from './cases-styles.mjs';

export const withDefaults = (cv) => ({
  template: 'oneColumn',
  lang: 'vi',
  role: 'sales',
  nameCase: 'as-is',
  ...cv,
  person: { ...cv.person, displayName: cv.person.displayName ?? cv.person.name },
});

export const CASES = [...BASIC_CASES, ...STYLE_CASES, ...HARD_CASES].map(withDefaults);
