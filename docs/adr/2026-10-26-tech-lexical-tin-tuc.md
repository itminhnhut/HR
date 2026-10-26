# ADR: Trình soạn bài Tin tức bằng Lexical

Ngày: 2026-10-26 · Trạng thái: đề xuất (chờ duyệt cùng spec-news.md)

## Bối cảnh

HR cần viết bài tin tức trong trang admin để làm SEO. Chủ sản phẩm chọn Lexical (đã dùng ở edu-viet-uc, bản 0.48).
Site: React 19 + Vite SPA, API Hono trên Vercel serverless, Postgres (Neon). Trang tin tuyển dụng đã có bản HTML dựng
sẵn cho bot (vercel.json chuyển user-agent bot sang API).

## Sự thật đã kiểm (npm, GitHub, 2026-10-26)

- `lexical` và mọi `@lexical/*`: **0.52.0** (2026-09-28, MIT). Còn 0.x, gần như minor nào cũng có thay đổi phá vỡ →
  **ghim đúng phiên bản** (không `^`). Hỗ trợ React ≥ 18. ESM-only từ 0.51.
- `LexicalComposer` bị đánh dấu deprecated từ 0.51 → dùng `LexicalExtensionComposer`; `CAN_UNDO/REDO_COMMAND`
  deprecated từ 0.50.
- Không có advisory bảo mật cho gói lexical. `@lexical/headless` kéo theo happy-dom 20 có advisory mức cao
  (GHSA-834v-8h66-3h79, chỉ khai thác được khi bật JS evaluation) → **không cài `@lexical/headless`**.
- Kích thước (đo bằng esbuild, production): core + react + rich-text + list + link + history + markdown + clipboard
  ≈ **103 KB gzip**; thêm node ảnh và toolbar ≈ 105–115 KB. Chỉ tải ở trang soạn bài của HR.
- Không có node ảnh chính thức: viết DecoratorNode theo ImageNode của playground (v0.52.0).
- Dán từ Word/Google Docs: giữ đậm/nghiêng/gạch chân, tiêu đề h1–h6, danh sách, trích dẫn, link (kể cả `javascript:`),
  canh lề; bỏ màu, cỡ chữ, font, bảng (thành đoạn văn), ảnh, script, iframe.
- Gõ tiếng Việt: không tìm thấy issue riêng cho Telex/VNI/UniKey trong repo Lexical; có nhiều bản sửa IME cho Safari/iOS
  ở 0.52. **Chưa kiểm chứng tiếng Việt** → phải tự gõ thử trước khi coi là xong.

## Quyết định

1. **Lưu nội dung dạng JSON của Lexical** (`editorState.toJSON()`, cột `jsonb`) làm nguồn gốc. Không nhận HTML từ
   trình duyệt. Lý do: HTML → editor mất thông tin (edu-viet-uc lưu HTML và phải "dọn" HTML bằng regex ở trình duyệt).
2. **Tự viết bộ chuyển JSON → HTML (~100 dòng) trong `packages/shared`**, không dùng `$generateHtmlFromNodes`:
   không cần DOM trên server (headless + happy-dom nặng 337 KB gzip và còn cảnh báo audit), và trang công khai dùng
   chung hàm này nên bot và người xem thấy cùng nội dung, không tải Lexical.
3. **Kiểm tra nghiêm bằng zod ở API** (lớp 1) và **escape + chỉ cho phép URL an toàn khi render** (lớp 2):
   - chỉ các loại node đã biết; tiêu đề chỉ h2/h3; định dạng chữ chỉ đậm/nghiêng/gạch chân; `style` phải rỗng;
   - link chỉ `http(s):`, `mailto:`, `tel:` (đã thử: dán `javascript:` vẫn được lưu nguyên trong JSON);
   - ảnh chỉ từ kho Blob công khai của mình, bắt buộc có alt; giới hạn độ sâu, số node, ~200 KB.
   - Không cần DOMPurify vì không bao giờ tin chuỗi HTML từ client.
4. **Trình soạn**: `LexicalExtensionComposer` + RichText, History, List, Link (`validateUrl`), ClipboardDOMImport;
   MarkdownShortcut với bộ rút gọn (tiêu đề, trích dẫn, danh sách, đậm, nghiêng, link); node ảnh tự viết; toolbar tự
   viết; transform đổi h1 → h2, h4–h6 → h3, xoá định dạng/kiểu chữ không cho phép, gỡ link không an toàn ngay khi dán.
5. **Tải lười** (`React.lazy`) trình soạn chỉ ở route `/hr/tin-tuc/...`; không file nào khác import `lexical`.
6. **SEO**: bot nhận HTML dựng sẵn từ API như trang tin tuyển dụng (cùng bộ render). Google gọi cách này là "dynamic
   rendering", chấp nhận được khi nội dung giống nhau; thêm `coccocbot`, `Applebot`, `DuckDuckBot` vào danh sách bot.

## Dùng lại từ edu-viet-uc (admin-edu, lexical 0.48)

- **Dùng lại (có sửa)**: hành vi node ảnh (chèn, chọn, phím Delete/Enter/Esc, kéo đổi cỡ), kiểm tra file ảnh khi tải
  lên, khung toolbar, sinh id cho tiêu đề (mục lục).
- **Không dùng lại**: lưu HTML; dọn HTML bằng regex ở trình duyệt (bỏ lọt `java\tscript:`, `data:`); node ảnh nhận
  mọi `<img>` dán vào (link ảnh Google hết hạn, pixel theo dõi); node video nhận mọi `<iframe>`; font/cỡ chữ/màu;
  H1 trong bài; file 1349 dòng có `any`, `console.error`, `window.prompt`; API deprecated.

## Phương án khác (đã cân nhắc)

- **Tiptap 3.32** (MIT, ProseMirror): dán tốt, có static renderer không cần DOM, ~133 KB gzip; vài extension trả phí.
- **Plate 53** (Slate): nhiều component sẵn nhưng phụ thuộc lớn, đổi major thường xuyên.
- **Markdown textarea**: nhỏ, dễ an toàn, nhưng HR mất WYSIWYG, dán Word và ảnh có alt.

## Hệ quả

- Mỗi loại node mới cần thêm 1 dòng render + 1 nhánh zod.
- Nâng Lexical phải có lượt kiểm thử lại (ghim phiên bản, đọc release notes).
- Cần một Blob store **công khai** cho ảnh (kho CV đang là private).
