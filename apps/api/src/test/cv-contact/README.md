# CV contact corpus (name, phone, email)

Test data for `parseCvContact(text)` from `@careers/shared`: 100 synthetic CVs, the text the site really extracts from
them, and the name, phone and email a human would read off each one.

**Every person in this corpus is fictional.** Names, phone numbers, emails, companies, addresses and ID numbers are
invented. Candidate emails use free-mail domains (gmail.com, yahoo.com, outlook.com) with made-up local parts; company
emails use made-up names or the reserved `.example` TLD. No real CV or real person was used.

## Files

| Path                | What                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `fixtures/<id>.txt` | Output of `pdfText()` (`src/lib/pdf-text.ts`, unpdf) for the CV's PDF, byte for byte                     |
| `expected.json`     | `[{ id, layout, notes, fullName, phone, email }]`, same order as the generator's case list               |
| `pdfs/<id>.pdf`     | 11 representative PDFs (each < 150 KB) for the end-to-end test                                           |
| `corpus.test.ts`    | Runs `parseCvContact` on every fixture; one test per CV and field, named `<id> [<layout>] reads <field>` |
| `pdf-e2e.test.ts`   | PDF → `pdfText` → `parseCvContact` for the kept PDFs; also checks the fixture still matches `pdfText`    |
| `holdout/`          | Held-out set: 40 more CVs (`fixtures/*.txt` + `expected.json`, no PDFs); see below                       |
| `holdout.test.ts`   | Same checks as `corpus.test.ts` on the held-out set                                                      |
| `load-corpus.ts`    | Shared loader for the tests                                                                              |

Expected values:

- `fullName`: the candidate's name in title case, diacritics exactly as the CV spells them (`TRẦN VĂN HÙNG` →
  `Trần Văn Hùng`, `NGUYEN VAN AN` → `Nguyen Van An`, old-style `Hoà`/`Thuỷ` kept), NFC. `null` when the text layer
  does not contain the name (e.g. the name is an image).
- `phone`: the candidate's own mobile as `0xxxxxxxxx`; `null` if the CV has none (company hotlines, referees and office
  landlines do not count). When a CV lists two, the one labelled personal / mobile is expected.
- `email`: the candidate's own address, lowercase, without `mailto:`; `null` if the text has none (a referee's email
  does not count).

## How the fixtures were made

`apps/api/scripts/gen-cv-contact-fixtures.mjs` drives everything; the data lives next to it in
`apps/api/scripts/cv-contact/`:

- `cases-basic.mjs`, `cases-styles.mjs`, `cases-hard.mjs` – the cases (one object per CV: person, layout template,
  options). `cases.mjs` lists the fields and merges the three arrays.
- `templates.mjs` – HTML layouts: `oneColumn`, `sidebar`, `banner`, `nameTitle`, `labelForm`, `topcv`, `vnw`, `canva`,
  `table`.
- `parts.mjs`, `filler.mjs` – section HTML and filler content (jobs, schools, skills), picked with a PRNG seeded by
  the case id, so a case renders the same every run.

For each case the script renders HTML → A4 PDF with Chrome (puppeteer-core, `page.pdf`, `printBackground`), runs the
PDF through the site's own `pdfText()`, writes `fixtures/<id>.txt`, derives the expected values from the case data
and fails if an expected value cannot be found anywhere in the extracted text (ignoring whitespace). It also copies the
PDFs of cases marked `keepPdf` into `pdfs/`, deletes fixtures of removed cases and prints pages / size per CV.

### Regenerate

puppeteer-core is not a dependency of the repo; install it in a scratch folder:

```bash
mkdir -p /tmp/cv-tools && npm i --prefix /tmp/cv-tools puppeteer-core
cd apps/api
PUPPETEER_CORE_DIR=/tmp/cv-tools npx tsx scripts/gen-cv-contact-fixtures.mjs            # all cases
PUPPETEER_CORE_DIR=/tmp/cv-tools npx tsx scripts/gen-cv-contact-fixtures.mjs --only id1,id2
npx prettier --write src/test/cv-contact/expected.json
```

`CHROME_PATH` overrides the browser (default `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`);
`--pdf-out <dir>` keeps every rendered PDF (default: a temp dir). The run needs `tsx` because `pdf-text.ts` is
TypeScript. Text depends on Chrome's layout and the installed fonts (made on macOS with Arial, Times New Roman,
Georgia, Verdana, Tahoma, Helvetica Neue, Avenir Next), so another machine may produce slightly different fixtures;
review the diff before committing.

To add a case, append an object to one of the `cases-*.mjs` arrays (copy a similar one), run with `--only <id>`, read
the new `.txt` and check its `expected.json` entry.

## What the extracted text looks like

Things worth knowing when writing or debugging the parser (all visible in the fixtures):

- **Order follows the DOM, not the page.** A left sidebar placed first in the HTML comes out entirely before the main
  column, so contact / skills / references can precede the name (`sidebar-*`, `hard-refs-before-candidate`). A right
  sidebar placed after the main column comes out last. Table cells come out row by row, cells joined by three spaces,
  and wrapped cells interleave (`vnw-4col-*`: `Địa chỉ: 45/7 Nguyễn Trãi, P.2, Q.5, TP.` / `HCM   Ngày sinh: …`).
- **Letter spacing becomes spaces.** CSS `letter-spacing` yields `L Ê   M I N H   C H Â U` (one space between letters,
  three between words), the same as names typed with spaces. CSS `text-transform: uppercase` is applied to the text
  layer (`LỄ TÂN KHÁCH SẠN`).
- **Icons and runs add spaces.** `☎ 0912 345 678` comes out as `☎   0912 345 678`; a bold/normal boundary inside a
  line also gives three spaces (`Nhân viên kinh doanh   – Công ty …`).
- **Lines wrap where the layout wraps.** Long names in a narrow sidebar split over two lines (`TÔN NỮ HOÀNG` / `BẢO
CHÂU`), a long email can break mid-word (`nguyenthithanhhuon` / `g.ketoantonghop2024@gmai` / `l.com`), and a phone at
  the end of a contact line can wrap (`0346` / `718 520`). Pages are joined with a newline.
- **Unicode.** NFC input gives NFC output. NFD input (decomposed accents) gives precomposed letters but with spaces
  around each accented letter: `NGUY Ễ N TH Ị   HUY Ề N TRANG` (`hard-nfd-source`).
- **No text for images.** A name drawn as an image is simply absent (`hard-name-as-image`); an email that exists only as
  a link target is absent too (`hard-email-link-text-only`).
- The `Ảnh 3x4` photo box of a Vietnamese form comes out before `SƠ YẾU LÝ LỊCH`.

## Coverage

Layouts: one column, two-column sidebar (left/right, name in sidebar or main, references in sidebar), header banner,
`NAME | Title` on one line, label forms (`SƠ YẾU LÝ LỊCH`, `HỒ SƠ XIN VIỆC`, `CURRICULUM VITAE`, `Họ và tên:` / `Họ
tên:` / `Full name:`), English, mixed VN/EN, no diacritics, TopCV-like, VietnamWorks-like, Canva-like, tables,
multi-page (2–3 pages), job title before the name.

Contact formats: `0912 345 678`, `0912.345.678`, `0912-345-678`, `+84 912 345 678`, `(+84) 908123456`, `84934567812`,
`097 123 4567`, `0939 15 26 37`, `09 87 65 43 21`, `+84-976-412-305`, `+84 (0) 912 864 205`, Zalo-only, two phones;
emails with dots, underscores, digits, capitals and a visible `mailto:`; no email; no phone.

Noise: references (`Người tham chiếu` / `References`), company phones/emails and a line manager in the experience
section, CCCD, tax code, social insurance and bank account numbers, dates of birth and employment, salaries
(`15.000.000 VNĐ`), GPA, street addresses with numbers, LinkedIn/GitHub/Facebook/portfolio links.

Names: 2 to 5 words, surnames Nguyễn, Trần, Lê, Phạm, Hoàng, Huỳnh, Phan, Vũ, Võ, Đặng, Bùi, Đỗ, Hồ, Ngô, Dương, Lý,
Đinh, Trương, Lâm, Tạ, Quách, Âu Dương, Tôn Nữ, Cao, Lưu, Mạc, Kiều, Khúc, Triệu, Thái, Hà, Giang, Lương, Đoàn,
Trịnh, Tô, Châu, La, Ninh; a given-name-first English name (`Minh Anh Tran`).

The `hard-*` cases are deliberately adversarial: other people's contacts before the candidate's, ID numbers and a
company tax code that look like phones, values missing from the text layer, NFD input, wrapped values.

## Held-out set (`holdout/`)

The parser was tuned on the 100 CVs above, so passing them says little about CVs it has not seen. `holdout/` holds 40
more CVs that must **not** be used for tuning: when one fails, add a similar case to the main corpus and fix the
parser there, then check whether the held-out case passes too.

- 26 random CVs drawn with a PRNG seeded `2026` (`scripts/cv-contact/cases-holdout.mjs`): template, language (vi, en,
  no diacritics, mixed), label style, phone format, email style (capitals, `mailto:`), name effects (ALL CAPS, letter
  spacing, split lines), sidebars left/right, references, company contacts, CCCD, dates, salary, GPA, links, multi-page
  and NFD source are mixed at random. Each case's `notes` lists what was drawn.
- 14 hand-written traps not in the main corpus: a photo box `ẢNH THẺ 3 x 4` before the name, `Ứng viên:` label,
  email only in a closing footer, CCCD right before a `0916 73 42 85` phone, office `+84-28-…` before a
  `+84-935-806-417` mobile, middle initial (`TRẦN V. HÙNG`), surnames that are common words (`Mai Anh Tuấn`, `Ông Thị
Diệu Hiền`, `Từ Hoàng Yến`), a staffing agency name in CAPS on the first line, English order (`KHOA NGUYEN DANG`),
  a nickname `(Kevin)`, `(Nữ – 1996)` after the name, two mobiles on one line, a name only in the closing signature.

The generator refuses held-out names, phones or emails that already appear in the main corpus. Regenerate with:

```bash
cd apps/api
PUPPETEER_CORE_DIR=/tmp/cv-tools npx tsx scripts/gen-cv-contact-fixtures.mjs --set holdout
```

Judgement calls in the expected values: `holdout-hard-nickname` expects the name without `(Kevin)`;
`holdout-hard-two-phones-one-line` expects the first of two mobiles; `holdout-hard-middle-initial` expects the
abbreviation as written (`Trần V. Hùng`).
