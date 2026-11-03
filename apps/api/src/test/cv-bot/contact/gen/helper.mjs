const LAYOUT_LABEL = {
  topcvModern: 'TopCV-style one column',
  topcv2col: 'TopCV-style two columns',
  vnwExport: 'VietnamWorks-style export',
  canvaAbs: 'Canva free text boxes',
  canvaHero: 'Canva big-name hero',
  wordPlain: 'Word plain',
  wordTable: 'Word table',
  wordHeader: 'Word page header',
  threeCol: 'three columns',
  rightSide: 'right sidebar',
  iconRow: 'vector icons, no labels',
  atsEn: 'English ATS',
  formDots: 'Vietnamese form (SYLL)',
  coverThenCv: 'cover letter + CV',
  scan: 'scanned image',
};

/** One CV. `exp` is [fullName, phone, email], typed by hand from what a human reads on the page. */
export const cv = (focus, id, tpl, fields, exp) => ({
  focus,
  id,
  tpl,
  layout: LAYOUT_LABEL[tpl],
  lang: 'vi',
  ...fields,
  exp,
});
