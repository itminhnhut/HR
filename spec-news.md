# Spec: Tin tức (bài viết SEO) soạn bằng Lexical

Chủ sản phẩm 26/10: trong admin HR có phần tin tức viết bài để SEO, dùng Lexical. Chốt: nháp → đăng, có chuyên mục,
ảnh lưu Vercel Blob công khai, hiện ở menu "Tin tức" + trang /tin-tuc. Nghiên cứu: docs/adr/2026-10-26-tech-lexical-tin-tuc.md.

## 1. Problem

Site hiện chỉ có tin tuyển dụng; khi chưa có tin nào đang mở thì Google gần như không có gì để đọc. Bài viết (đời sống
công ty, cẩm nang ứng viên…) giúp site có nội dung thường xuyên, có từ khoá, có link nội bộ về các tin tuyển dụng.

## 2. Requirements

**Must have:**

- **Admin HR – mục "Tin tức"** (menu trái):
  - Danh sách bài: tab Nháp / Đã đăng, tìm theo tiêu đề, cột chuyên mục, ngày sửa, người sửa.
  - Quản lý chuyên mục: thêm, đổi tên, xoá (chỉ khi chưa có bài), slug tự sinh.
  - Trang soạn bài (Lexical 0.52.0): tiêu đề, chuyên mục, ảnh bìa (bắt buộc khi đăng, có alt), tóm tắt (≤ 160 ký tự,
    dùng làm mô tả SEO; trống thì lấy đoạn đầu), nội dung. Toolbar: hoàn tác/làm lại, Đoạn văn / Tiêu đề lớn (H2) /
    Tiêu đề nhỏ (H3), đậm, nghiêng, gạch chân, danh sách chấm / số, trích dẫn, link, chèn ảnh (tải lên, kéo thả, dán).
    Ảnh trong bài bắt buộc có alt (gợi ý từ tên file, sửa được).
  - Tự lưu nháp khi gõ (sau ~1,5 s), báo "Đã lưu lúc…"; rời trang khi chưa lưu thì hỏi.
  - Nút **Đăng** (kiểm: có tiêu đề, chuyên mục, ảnh bìa, nội dung ≥ 1 đoạn), **Gỡ bài** (về nháp, trang công khai 404),
    **Xem trước** (giống trang công khai). Sửa bài đã đăng: lưu là cập nhật luôn, ngày cập nhật đổi.
  - Ô "Đường dẫn" (slug) tự sinh từ tiêu đề không dấu; sửa được khi còn nháp, **khoá sau khi đăng** (giữ link cũ).
  - Xem trước kết quả Google (tiêu đề xanh, link, mô tả) ngay trong trang soạn.
- **Trang công khai**:
  - Menu "Tin tức". `/tin-tuc`: danh sách bài đã đăng mới nhất trước (ảnh bìa, chuyên mục, tiêu đề, tóm tắt, ngày),
    lọc theo chuyên mục, phân trang 12 bài.
  - `/tin-tuc/chuyen-muc/<slug>`: bài theo chuyên mục. `/tin-tuc/<slug>`: bài chi tiết, mục lục từ H2/H3, chia sẻ
    (copy link, Zalo, Facebook), 3 bài cùng chuyên mục, khối "Vị trí đang tuyển" (link về tin tuyển dụng).
- **SEO**:
  - Mỗi trang: title, description, canonical (www.lee-hr.com), Open Graph `article` (ảnh bìa, published/modified time,
    section), JSON-LD `BlogPosting` (headline, image, datePublished, dateModified +07:00, author/publisher TOP FLOW) +
    `BreadcrumbList`.
  - Bot (Google, Cốc Cốc, Bing, Zalo, Facebook…) nhận HTML dựng sẵn đủ nội dung bài, từ cùng bộ render với trang SPA.
  - Sitemap tự thêm bài đã đăng (lastmod = ngày sửa, kèm ảnh bìa) và trang chuyên mục; bài gỡ thì tự rút ra.
  - IndexNow: đăng/sửa/gỡ bài (và đăng/sửa tin tuyển dụng) thì báo Bing + Cốc Cốc ngay (như edu-viet-uc).
- **An toàn**: API chỉ nhận JSON Lexical đúng schema (zod), không nhận HTML; render escape mọi chữ, chỉ cho link
  http(s)/mailto/tel, ảnh chỉ từ kho Blob của mình. Ảnh tải lên: chỉ JPEG/PNG/WebP, ≤ 4 MB (giới hạn của Vercel 4,5 MB; trình soạn tự thu nhỏ ảnh lớn), kiểm byte đầu file, đọc
  kích thước thật. Chỉ HR đăng nhập mới gọi được API quản trị.
- Bản demo (mock) có đủ chức năng như BE (trừ tải ảnh thật: dùng ảnh mẫu).

**Out of scope:** hẹn giờ đăng, thẻ (tags), bình luận, nhiều tác giả/duyệt bài, video/iframe nhúng, bảng, màu/cỡ chữ,
dịch đa ngôn ngữ, trình soạn trên trang công khai.

## 3. Approach

- **Lưu**: bảng `news_categories` (id, name, slug, sort, timestamps) và `news_posts` (id, category_id, title, slug,
  status draft|published, summary, cover_url/alt/width/height, content jsonb, content_html, plain_text, published_at,
  updated_at, updated_by, created_at). `content_html`/`plain_text` tính trên server mỗi lần lưu.
- **Shared** (`packages/shared/src/news/`): schema zod cho JSON Lexical (allowlist), `renderArticleHtml(json)` không
  DOM, `articlePlainText`, `headingId`, `newsSlug`, `blogPostingData` (JSON-LD). Không import lexical.
- **API**: `/api/hr/news` (CRUD, publish/unpublish, categories, `POST /api/hr/news/images` → Vercel Blob public),
  `/api/news` (list, by category, detail đã đăng). Bot SSR: `/tin-tuc`, `/tin-tuc/:slug`, `/tin-tuc/chuyen-muc/:slug`
  trong `routes/share.ts` (thêm `coccocbot|applebot|duckduckbot` vào regex vercel.json). Sitemap: thêm `newsSource`.
  IndexNow: key file `public/<key>.txt`, gọi sau khi lưu (lỗi chỉ log, không làm hỏng việc lưu).
- **Web**: route HR `/hr/tin-tuc`, `/hr/tin-tuc/moi`, `/hr/tin-tuc/:id` (lazy, chỉ file editor import lexical);
  route công khai `/tin-tuc...` dùng `renderArticleHtml` (không tải Lexical).

## 4. Impact Analysis

- Files thay đổi: packages/shared (news/, types, index), apps/api (schema + migration 0010, services/news*.ts,
  lib/image-store.ts, lib/indexnow.ts, routes/hr-news.ts, routes/public-news.ts, routes/share.ts, services/sitemap.ts),
  apps/web (api layer + mock, pages/hr/news/_, pages/news/_, router, SiteHeader, HrLayout), vercel.json, .env.example.
- Public API thay đổi: có (thêm endpoint, không đổi endpoint cũ). Breaking change: không.
- Biến môi trường mới trên Vercel: token Blob công khai (`NEWS_BLOB_READ_WRITE_TOKEN`) nếu không dùng chung store;
  `INDEXNOW_KEY`.

## 5. Test Strategy

- Unit (shared): schema từ chối node lạ, h1/h4, `style`, link `javascript:`/`java\tscript:`/`data:`, ảnh ngoài kho,
  quá sâu/quá lớn; render escape `<script>`, đúng thẻ, id tiêu đề không dấu và không trùng; slug tiếng Việt; JSON-LD.
- Integration (API, PGlite): CRUD + quyền HR; đăng thiếu ảnh bìa/chuyên mục bị chặn; slug trùng thêm số, khoá sau
  đăng; gỡ bài → API công khai 404, sitemap rút ra; tải ảnh sai loại/quá lớn/giả đuôi bị chặn; bot SSR có đủ meta,
  JSON-LD, nội dung; IndexNow được gọi khi đăng (mock fetch), lỗi IndexNow không làm hỏng lưu.
- Web: render trang danh sách/chi tiết từ mock; trình soạn: tự lưu, chặn rời trang, đăng/gỡ (test với mock API).
- Manual: tự bấm trên máy tính + điện thoại: viết bài có ảnh, dán từ Word và Google Docs, **gõ tiếng Việt Telex (macOS),
  UniKey Telex/VNI (Windows), bàn phím iPhone, Gboard**; xem trước Google; chia sẻ Zalo/Facebook; Rich Results Test.

## 6. Implementation Steps

- [ ] Step 1: Shared — schema JSON bài viết, bộ render HTML, plain text, slug, JSON-LD + test (XSS trước).
- [ ] Step 2: DB + API quản trị — migration 0010, chuyên mục, bài (nháp/đăng/gỡ/sửa), quyền HR + test.
- [ ] Step 3: Ảnh — kho Blob công khai, API tải ảnh (kiểm loại/cỡ/kích thước) + test.
- [ ] Step 4: Admin UI — danh sách bài, chuyên mục, trang soạn Lexical (toolbar, ảnh, tự lưu, đăng/gỡ, xem trước Google).
- [ ] Step 5: Trang công khai — menu, /tin-tuc, chuyên mục, chi tiết (mục lục, chia sẻ, bài liên quan, việc đang tuyển).
- [ ] Step 6: SEO — bot SSR cho tin tức, sitemap newsSource, JSON-LD/OG, IndexNow, bot regex vercel.json.
- [ ] Step 7: Tự bấm thử máy tính + điện thoại, gõ tiếng Việt, dán Word/Docs; sửa lỗi; gợi ý /code-review.

## 7. Risks

- **Gõ tiếng Việt trong Lexical** chưa được kiểm chứng (UniKey/EVKey trên Windows dùng xoá-gõ lại, khác IME). Nếu lỗi
  nặng: báo chủ sản phẩm trước khi đổi sang Tiptap.
- Vercel Blob: kho CV là private; có thể phải tạo store public riêng (chủ sản phẩm thao tác trên Vercel, gửi token).
- Lexical 0.x đổi API thường xuyên → ghim 0.52.0, không tự nâng.
- Dynamic rendering (bot ≠ người) là giải pháp tạm theo Google; giữ nội dung hai bên giống nhau bằng chung bộ render.
- Bài dài nhiều ảnh: giới hạn 200 KB JSON, ảnh ≤ 4 MB; trang công khai lazy-load ảnh, khai báo width/height (tránh CLS).
