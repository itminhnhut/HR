# Spec: HR tự thêm nguồn hồ sơ

## 1. Problem

"Nguồn hồ sơ" đang là danh sách cố định (Email, Zalo, Người giới thiệu, TopCV, VietnamWorks, Facebook, Khác). Nguồn
khác (LinkedIn, hội chợ việc làm, trường đại học, nhóm Zalo…) đều dồn vào "Khác", nên HR không biết kênh nào ra ứng
viên tốt.

## 2. Requirements

**Must have:**

- Ô chọn nguồn (form "Thêm hồ sơ" và "Sửa liên hệ") có dòng cuối **"+ Thêm nguồn mới…"**: HR gõ tên → lưu → nguồn được
  chọn ngay và có sẵn cho lần sau, cho mọi HR.
- **Quản lý nguồn** (nút "Quản lý nguồn" cạnh bộ lọc Nguồn ở trang Hồ sơ ứng viên): danh sách nguồn kèm số hồ sơ;
  **đổi tên**, **ẩn / hiện lại**, **xoá** (chỉ nguồn tự thêm và chưa có hồ sơ nào).
- Quy tắc:
  - Tên 2–60 ký tự, **không trùng** (không phân biệt hoa thường, có dấu hay không: "LinkedIn" = "linkedin" = "LÍNKEDIN"
    bị chặn với thông báo "Đã có nguồn LinkedIn").
  - Tối đa 50 nguồn.
  - "Website" (hồ sơ ứng viên tự nộp) là nguồn hệ thống: không chọn được khi HR thêm hồ sơ, không đổi tên, không ẩn.
  - "Người giới thiệu" giữ ô "Ai giới thiệu". "Khác" không ẩn được (luôn còn chỗ chọn).
  - Nguồn sẵn có (Email, Zalo, TopCV, VietnamWorks, Facebook, Người giới thiệu) đổi tên / ẩn được, không xoá được.
  - **Ẩn**: không hiện trong ô chọn khi thêm hồ sơ mới; hồ sơ cũ vẫn giữ và hiện đúng tên; bộ lọc và Tổng quan vẫn có
    (ghi "đã ẩn").
  - **Đổi tên**: mọi hồ sơ cũ hiện tên mới (thống kê không bị tách đôi).
- Bộ lọc Nguồn, nhãn trên hồ sơ, khối CV, Tổng quan "theo nguồn" dùng danh sách mới.
- Dữ liệu cũ giữ nguyên: 8 nguồn hiện có thành 8 dòng trong bảng nguồn với đúng mã cũ.

**Out of scope:**

- Gộp hai nguồn làm một, sắp xếp lại thứ tự bằng kéo thả, màu / icon riêng cho nguồn, nguồn theo từng tin.

## 3. Approach

- Migration 0016: bảng `application_sources` (`key` text khoá chính — mã không đổi khi đổi tên; `name`; `kind`
  `system` | `builtin` | `custom`; `hidden`; `position`; `created_by`; `created_at`), thêm sẵn 8 nguồn cũ; đổi
  `applications.source` từ enum sang text tham chiếu `application_sources.key` (dữ liệu cũ chuyển nguyên), bỏ enum
  `application_source`. Mã nguồn mới = slug không dấu của tên (trùng thì thêm số).
- API HR: `GET /hr/sources` (kèm số hồ sơ), `POST /hr/sources` { name }, `PATCH /hr/sources/:key` { name?, hidden? },
  `DELETE /hr/sources/:key` (409 nếu đang có hồ sơ / không phải nguồn tự thêm). Thêm hồ sơ / sửa liên hệ kiểm tra nguồn
  có trong bảng, không phải `website`, không bị ẩn (hồ sơ đang mang nguồn đã ẩn vẫn giữ được khi sửa liên hệ).
- Shared: `ApplicationSource` thành `string` (mã); bỏ danh sách cố định `HR_SOURCES`/`APPLICATION_SOURCE_LABEL`; thêm
  schema tên nguồn + hàm so trùng tên (bỏ dấu, chữ thường).
- FE: hook `useSources()` (một lần tải, dùng chung), `SourceSelect` có "+ Thêm nguồn mới…" (dùng ở form thêm hồ sơ và
  sửa liên hệ), hộp "Quản lý nguồn", mọi chỗ hiện tên nguồn lấy từ hook (mã lạ → hiện mã).

## 4. Impact Analysis

- Files: packages/shared (cv-intake.ts, types.ts, mới sources.ts), apps/api (schema, migration 0016, services sources /
  hr-intake / hr-applications / dashboard, routes), apps/web (api client + mock, queries, AddApplicationDialog, CvPanel,
  HrApplicantsPage, HrDashboardPage, mới SourceSelect / ManageSourcesDialog / useSources).
- Public API thay đổi: thêm route `/hr/sources`; trường `source` vẫn là chuỗi mã như cũ (giá trị cũ không đổi).
- Breaking change: không cho dữ liệu; kiểu TS `ApplicationSource` rộng hơn (string).

## 5. Test Strategy

- Unit (shared): schema tên, so trùng tên (hoa thường, dấu), slug.
- API (PGlite): migration giữ nguồn của hồ sơ cũ; thêm nguồn (trùng tên → 422, quá 50 → 422); đổi tên (hồ sơ cũ hiện
  tên mới); ẩn (không chọn được khi thêm hồ sơ mới, hồ sơ cũ sửa liên hệ vẫn giữ được); xoá (chưa dùng → OK, đang dùng /
  nguồn sẵn có → 409); không chọn được `website`; "Khác"/"Website" không ẩn được; thêm hồ sơ với nguồn mới; lọc + Tổng
  quan có nguồn mới.
- Web: "+ Thêm nguồn mới…" tạo và chọn ngay; trùng tên báo lỗi; quản lý nguồn đổi tên / ẩn / xoá; tên mới hiện ở nhãn.
- Manual: bấm thử 1440 / 390.

## 6. Implementation Steps

- [x] Step 1: Shared — kiểu, schema tên nguồn, so trùng, slug + test.
- [x] Step 2: DB + API — migration 0016, service + route nguồn, kiểm tra nguồn khi thêm hồ sơ / sửa liên hệ, Tổng quan +
      test.
- [x] Step 3: Web — useSources, SourceSelect "+ Thêm nguồn mới…", Quản lý nguồn, thay mọi chỗ dùng danh sách cố định +
      test.
- [x] Step 4: Bấm thử thật (1440 / 390), typecheck + test + prettier; gợi ý /code-review.

## 7. Risks

- Migration đổi kiểu cột trên dữ liệu thật: dùng `USING source::text`, chạy thử trên PGlite với dữ liệu mẫu trước, sao
  lưu Neon trước khi chạy.
- Hai HR thêm cùng một tên cùng lúc → khoá duy nhất trên tên đã chuẩn hoá, người thứ hai nhận "Đã có nguồn …".
- Mã nguồn sinh từ tên trùng mã cũ (vd đổi tên rồi thêm lại tên cũ) → thêm hậu tố số.
