# parse-cv on the fresh blind set

> This data is synthetic and written by one author. It measures a fresh synthetic set the tuning never saw, not real CVs.
> The PDFs come from two producers (headless Chrome and reportlab), with one-page layouts and clean embedded fonts.

Labels frozen: frozen 2026-11-03 14:44:25 +0700. Checksum 493cacb47adb23e8904d0a42cff1024bc7b051284180a681656c25f64d8390ef (matches labels.sha256).
Non-200 responses: 0. Answers not in NFC: 0.

## All (164 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 163 | 155/160 (96.9%) | 2 | 3 | 3/3 (100.0%) | 0 | 158/163 (96.9%) |
| phone | 162 | 151/155 (97.4%) | 1 | 3 | 7/7 (100.0%) | 0 | 158/162 (97.5%) |
| email | 162 | 153/156 (98.1%) | 0 | 3 | 6/6 (100.0%) | 0 | 159/162 (98.1%) |

- CVs with a wrong or false phone or email: 1/164 (0.6%)
- All three fields right (ambiguous fields not counted): 154/164 (93.9%)
- All three fields right, only CVs with no ambiguous field: 149/159 (93.7%)

## Ordinary (112 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 112 | 109/112 (97.3%) | 1 | 2 | 0/0 (n/a) | 0 | 109/112 (97.3%) |
| phone | 112 | 109/112 (97.3%) | 0 | 3 | 0/0 (n/a) | 0 | 109/112 (97.3%) |
| email | 112 | 110/112 (98.2%) | 0 | 2 | 0/0 (n/a) | 0 | 110/112 (98.2%) |

- CVs with a wrong or false phone or email: 0/112 (0.0%)
- All three fields right (ambiguous fields not counted): 105/112 (93.8%)
- All three fields right, only CVs with no ambiguous field: 105/112 (93.8%)

## Hard (52 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 51 | 46/48 (95.8%) | 1 | 1 | 3/3 (100.0%) | 0 | 49/51 (96.1%) |
| phone | 50 | 42/43 (97.7%) | 1 | 0 | 7/7 (100.0%) | 0 | 49/50 (98.0%) |
| email | 50 | 43/44 (97.7%) | 0 | 1 | 6/6 (100.0%) | 0 | 49/50 (98.0%) |

- CVs with a wrong or false phone or email: 1/52 (1.9%)
- All three fields right (ambiguous fields not counted): 49/52 (94.2%)
- All three fields right, only CVs with no ambiguous field: 44/47 (93.6%)

## ordinary/topcv (36 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 36 | 35/36 (97.2%) | 1 | 0 | 0/0 (n/a) | 0 | 35/36 (97.2%) |
| phone | 36 | 36/36 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 36/36 (100.0%) |
| email | 36 | 36/36 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 36/36 (100.0%) |

- CVs with a wrong or false phone or email: 0/36 (0.0%)
- All three fields right (ambiguous fields not counted): 35/36 (97.2%)
- All three fields right, only CVs with no ambiguous field: 35/36 (97.2%)

## ordinary/vietnamworks (18 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 18 | 18/18 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 18/18 (100.0%) |
| phone | 18 | 18/18 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 18/18 (100.0%) |
| email | 18 | 18/18 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 18/18 (100.0%) |

- CVs with a wrong or false phone or email: 0/18 (0.0%)
- All three fields right (ambiguous fields not counted): 18/18 (100.0%)
- All three fields right, only CVs with no ambiguous field: 18/18 (100.0%)

## ordinary/word (36 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 36 | 35/36 (97.2%) | 0 | 1 | 0/0 (n/a) | 0 | 35/36 (97.2%) |
| phone | 36 | 36/36 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 36/36 (100.0%) |
| email | 36 | 36/36 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 36/36 (100.0%) |

- CVs with a wrong or false phone or email: 0/36 (0.0%)
- All three fields right (ambiguous fields not counted): 35/36 (97.2%)
- All three fields right, only CVs with no ambiguous field: 35/36 (97.2%)

## ordinary/canva (22 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 22 | 21/22 (95.5%) | 0 | 1 | 0/0 (n/a) | 0 | 21/22 (95.5%) |
| phone | 22 | 19/22 (86.4%) | 0 | 3 | 0/0 (n/a) | 0 | 19/22 (86.4%) |
| email | 22 | 20/22 (90.9%) | 0 | 2 | 0/0 (n/a) | 0 | 20/22 (90.9%) |

- CVs with a wrong or false phone or email: 0/22 (0.0%)
- All three fields right (ambiguous fields not counted): 17/22 (77.3%)
- All three fields right, only CVs with no ambiguous field: 17/22 (77.3%)

## hard/two_column (7 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 7 | 6/7 (85.7%) | 0 | 1 | 0/0 (n/a) | 0 | 6/7 (85.7%) |
| phone | 7 | 7/7 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 7/7 (100.0%) |
| email | 7 | 6/7 (85.7%) | 0 | 1 | 0/0 (n/a) | 0 | 6/7 (85.7%) |

- CVs with a wrong or false phone or email: 0/7 (0.0%)
- All three fields right (ambiguous fields not counted): 6/7 (85.7%)
- All three fields right, only CVs with no ambiguous field: 6/7 (85.7%)

## hard/references (7 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 7 | 6/7 (85.7%) | 1 | 0 | 0/0 (n/a) | 0 | 6/7 (85.7%) |
| phone | 7 | 6/6 (100.0%) | 0 | 0 | 1/1 (100.0%) | 0 | 7/7 (100.0%) |
| email | 7 | 6/6 (100.0%) | 0 | 0 | 1/1 (100.0%) | 0 | 7/7 (100.0%) |

- CVs with a wrong or false phone or email: 0/7 (0.0%)
- All three fields right (ambiguous fields not counted): 6/7 (85.7%)
- All three fields right, only CVs with no ambiguous field: 6/7 (85.7%)

## hard/relatives_or_company (7 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 7 | 7/7 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 7/7 (100.0%) |
| phone | 7 | 5/6 (83.3%) | 1 | 0 | 1/1 (100.0%) | 0 | 6/7 (85.7%) |
| email | 7 | 7/7 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 7/7 (100.0%) |

- CVs with a wrong or false phone or email: 1/7 (14.3%)
- All three fields right (ambiguous fields not counted): 6/7 (85.7%)
- All three fields right, only CVs with no ambiguous field: 6/7 (85.7%)

## hard/several_emails (7 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 7 | 7/7 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 7/7 (100.0%) |
| phone | 7 | 7/7 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 7/7 (100.0%) |
| email | 5 | 5/5 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 5/5 (100.0%) |

- CVs with a wrong or false phone or email: 0/7 (0.0%)
- All three fields right (ambiguous fields not counted): 7/7 (100.0%)
- All three fields right, only CVs with no ambiguous field: 5/5 (100.0%)

## hard/name_position (12 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 11 | 8/8 (100.0%) | 0 | 0 | 3/3 (100.0%) | 0 | 11/11 (100.0%) |
| phone | 12 | 12/12 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 12/12 (100.0%) |
| email | 12 | 12/12 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 12/12 (100.0%) |

- CVs with a wrong or false phone or email: 0/12 (0.0%)
- All three fields right (ambiguous fields not counted): 12/12 (100.0%)
- All three fields right, only CVs with no ambiguous field: 11/11 (100.0%)

## hard/no_email (4 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 4 | 4/4 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 4/4 (100.0%) |
| phone | 4 | 4/4 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 4/4 (100.0%) |
| email | 4 | 0/0 (n/a) | 0 | 0 | 4/4 (100.0%) | 0 | 4/4 (100.0%) |

- CVs with a wrong or false phone or email: 0/4 (0.0%)
- All three fields right (ambiguous fields not counted): 4/4 (100.0%)
- All three fields right, only CVs with no ambiguous field: 4/4 (100.0%)

## hard/no_phone (5 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 5 | 5/5 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 5/5 (100.0%) |
| phone | 5 | 0/0 (n/a) | 0 | 0 | 5/5 (100.0%) | 0 | 5/5 (100.0%) |
| email | 5 | 4/4 (100.0%) | 0 | 0 | 1/1 (100.0%) | 0 | 5/5 (100.0%) |

- CVs with a wrong or false phone or email: 0/5 (0.0%)
- All three fields right (ambiguous fields not counted): 5/5 (100.0%)
- All three fields right, only CVs with no ambiguous field: 5/5 (100.0%)

## hard/phone_oddity (3 CVs)

| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |
|---|---|---|---|---|---|---|---|
| fullName | 3 | 3/3 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 3/3 (100.0%) |
| phone | 1 | 1/1 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 1/1 (100.0%) |
| email | 3 | 3/3 (100.0%) | 0 | 0 | 0/0 (n/a) | 0 | 3/3 (100.0%) |

- CVs with a wrong or false phone or email: 0/3 (0.0%)
- All three fields right (ambiguous fields not counted): 3/3 (100.0%)
- All three fields right, only CVs with no ambiguous field: 1/1 (100.0%)

## Wrong values and false fills

- o001 ordinary/topcv/topcv_side **fullName** wrong: expected `Nguyễn Thị Hồng Nhung`, returned `Nguyễn Thị Hồng`
- h014 hard/references/word_classic **fullName** wrong: expected `Mai Thế Hiển`, returned `Trần Văn Sơn`
- h016 hard/relatives_or_company/canva_center **phone** wrong: expected `0936107284`, returned `0989021763`

## Missing

- o077 ordinary/word/word_classic **fullName** missing: expected `K'Thuận`, returned (none)
- o097 ordinary/canva/canva_side **email** missing: expected `maichi.hoang@gmail.com`, returned (none)
- o099 ordinary/canva/canva_band **phone** missing: expected `0585209176`, returned (none)
- o100 ordinary/canva/canva_side **fullName** missing: expected `Lầu Thị Xía`, returned (none)
- o100 ordinary/canva/canva_side **email** missing: expected `lauxia.hg@gmail.com`, returned (none)
- o105 ordinary/canva/canva_band **phone** missing: expected `0776430951`, returned (none)
- o108 ordinary/canva/canva_band **phone** missing: expected `0938120574`, returned (none)
- h007 hard/two_column/two_col_cell **fullName** missing: expected `Y Bhuôn Niê`, returned (none)
- h007 hard/two_column/two_col_cell **email** missing: expected `ybhuon.nie@gmail.com`, returned (none)

## Ambiguous fields (not in any count above)

- h023 **email**: labelled `huunghia.le@gmail.com`, returned `huunghia.le@gmail.com` - two personal addresses listed with equal standing
- h024 **email**: labelled `ha.phuong.nguyen@gmail.com`, returned `ha.phuong.nguyen@gmail.com` - personal and student addresses are both her own
- h036 **fullName**: labelled `Trần Thanh Tùng`, returned `Trần Thanh Tùng` - whether the nickname belongs in the name is debatable
- h050 **phone**: labelled `0912640387`, returned `0912640387` - two own mobiles listed with equal standing
- h051 **phone**: labelled `0383402715`, returned `0383402715` - old 11-digit number; the label is its 2018 conversion, which the CV does not show
