# CV PDFs for text-extraction tests

Fictional people, generated with Chrome (puppeteer-core) from HTML. Each file is under 200 KB. Extraction was checked
with `unpdf` 1.8.1 (`extractText(pdf, { mergePages: true })`); the output is Unicode NFC.

| File                   | Layout                                                               | Text layer |
| ---------------------- | -------------------------------------------------------------------- | ---------- |
| `cv-simple-vi.pdf`     | One column, Vietnamese with diacritics                               | yes        |
| `cv-two-column.pdf`    | Two columns: grey sidebar (contact, skills, education) + main column | yes        |
| `cv-scanned-image.pdf` | One JPEG of `cv-simple-vi` filling an A4 page, nothing else          | **no**     |

## `cv-simple-vi.pdf`: text that must be extractable

- `NGUYỄN THỊ MAI ANH`
- `KINH NGHIỆM LÀM VIỆC`, `HỌC VẤN`, `KỸ NĂNG`
- `03/2021 – nay` (en dash), `2015 – 2019`
- `Công ty TNHH Thương mại Phú Gia`
- `Tư vấn bán hàng`, `HubSpot CRM`
- `Đại học Kinh tế TP. HCM`
- `Word, Excel, PowerPoint`, `TOEIC 720`

## `cv-two-column.pdf`: text that must be extractable

The sidebar comes out before the main column with unpdf; tests should check that the strings exist, not their order.

- `TRẦN VĂN HÙNG`
- `MISA`, `Excel nâng cao`
- `Đại học Kinh tế Quốc dân`, `Chuyên ngành Kế toán`, `2013 – 2017`
- `KINH NGHIỆM LÀM VIỆC`
- `Kế toán tổng hợp – Công ty CP Xây dựng Hoà Bình An`, `07/2019 – nay`
- `09/2017 – 06/2019`

## `cv-scanned-image.pdf`

No text should come out (empty after trimming), so the server must report "Không đọc được chữ trong CV (ảnh scan hoặc
link), HR xem trực tiếp" and give no percent.
