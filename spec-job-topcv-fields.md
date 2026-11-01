# Spec: Tin tuyển dụng đủ trường như TopCV

## 1. Problem

HR muốn đưa 3 tin đang đăng trên TopCV (Nhân viên Chứng từ – Logistics, Trợ lý Giám đốc, Kỹ sư Cơ điện lạnh HVAC)
vào admin **đúng nội dung, không thêm không bớt**. Form tin hiện tại không chứa được nguyên văn:

- **Quyền lợi** tối đa 80 ký tự mỗi dòng; 13/21 dòng của 3 tin dài 81–114 ký tự.
- **Mô tả công việc** chỉ là danh sách phẳng; tin Logistics và Trợ lý có nhóm "1. Quản lý đơn hàng…", "2. Thủ tục hải
  quan…" → nhóm thành một việc được đánh số lẫn với việc thật.
- Thiếu trường **Cấp bậc** (Nhân viên), **Số lượng tuyển** (1 / 2 người), **Hình thức làm việc** (Tại văn phòng /
  Hybrid).

## 2. Requirements

**Must have:**

- Quyền lợi: mỗi dòng tối đa **200** ký tự (tin và Mẫu tin). Thẻ tin ở trang chủ vẫn gọn (chip cắt bằng "…").
- Mô tả công việc, Yêu cầu, Ưu tiên: khi ô có dòng bắt đầu bằng gạch đầu dòng (`•`, `-`, `*`), dòng **không** có gạch
  đầu dòng là **tiêu đề nhóm**; trang tin hiện tiêu đề nhóm và đánh số việc lại từ 01 trong mỗi nhóm. Ô không có gạch
  đầu dòng nào giữ như cũ (mọi dòng là một ý) → tin cũ không đổi. Tiêu đề nhóm không bị chấm như một yêu cầu khi chấm %
  khớp CV.
- Trường mới (đều không bắt buộc, tin cũ để trống):
  - **Cấp bậc**: chọn trong danh sách của Mẫu tin (mặc định: Thực tập sinh, Nhân viên, Trưởng nhóm, Trưởng/Phó phòng,
    Quản lý, Giám đốc; HR thêm được như phòng ban).
  - **Số lượng tuyển**: số 1–100.
  - **Hình thức làm việc**: Tại văn phòng / Kết hợp (Hybrid) / Từ xa (Remote).
- Ba trường mới hiện ở khối thông tin tin tuyển dụng (trang tin, xem trước trong admin); Hình thức "Từ xa" ghi vào
  JSON-LD JobPosting (`jobLocationType: TELECOMMUTE`), Số lượng tuyển ghi `totalJobOpenings`.
- Nhập 3 tin TopCV thành **bản nháp trên prod** sau khi deploy, nguyên văn.

**Out of scope:**

- **Giới tính, độ tuổi** (TopCV ghi "Nữ", "Nam", "Tuổi 23–32"): không thêm trường — BLLĐ 2019 Điều 8 cấm phân biệt đối
  xử vì giới tính, tuổi khi tuyển; NĐ 12/2022 có mức phạt. Báo HR, không nhập.
- Nhãn phân loại của TopCV (Chuyên môn, Kiến thức ngành, Danh mục nghề, Mức độ cạnh tranh).
- Tự động lấy tin từ TopCV (TopCV chặn tải tự động).

## 3. Approach

- Migration 0017: `jobs` thêm `level text`, `openings integer`, `work_mode text` (null = chưa chọn); Mẫu tin thêm danh
  sách `levels` (mặc định như trên, giống `departments`).
- Shared: `BENEFIT_MAX` 80 → 200; `jobInputSchema` thêm 3 trường; hàm `toSections(text)` → `[{ title, items }]` dùng chung
  cho trang tin, xem trước và chấm CV (chấm CV chỉ dùng `items`). `toLines` giữ cho chỗ khác.
- Web: form tin thêm 3 ô (Cấp bậc dạng chọn + thêm lựa chọn như Phòng ban; Số lượng; Hình thức 3 nút); TaskList /
  CheckList vẽ theo nhóm; khối "Thông tin chung" thêm 3 dòng khi có giá trị.
- Nhập 3 tin bằng API HR (`POST /api/hr/jobs`, intent `draft`), giữ nguyên chữ TopCV; Kinh nghiệm "1 năm", Phòng ban
  "Xuất nhập khẩu/Logistics" và "Ban Giám đốc" thêm vào lựa chọn Mẫu tin; Lộ trình thử việc để trống (TopCV không có).

## 4. Impact Analysis

- Files: packages/shared (job-template, validation, format → toSections, cv-match chỗ đọc yêu cầu), apps/api (schema,
  migration 0017, hr-jobs, job DTO, job-bot-page/JSON-LD), apps/web (HrJobFormPage, job-form/*, PreviewDialog,
  JobSections, JobPage, HrTemplatePage).
- Public API: thêm trường `level`, `openings`, `workMode` (có thể null) vào tin; không đổi trường cũ.
- Breaking change: không.

## 5. Test Strategy

- Unit (shared): `toSections` (không gạch đầu dòng → một nhóm không tiêu đề; có gạch → tiêu đề + ý; dòng trống); schema
  (quyền lợi 200 ký tự, số lượng 1–100, hình thức); chấm CV bỏ qua tiêu đề nhóm.
- API (PGlite): migration giữ tin cũ (3 trường null); lưu / đọc 3 trường; Mẫu tin có `levels`.
- Web: trang tin hiện nhóm + đánh số lại; tin cũ hiện như trước; form lưu 3 trường; JSON-LD có `totalJobOpenings`.
- Manual: nhập 3 tin trên dev, so từng dòng với TopCV, bấm thử 1440 / 390.

## 6. Implementation Steps

- [x] Step 1: Shared — BENEFIT_MAX 200, 3 trường trong schema + Mẫu tin `levels`, `toSections`, chấm CV bỏ tiêu đề + test.
- [x] Step 2: DB + API — migration 0017, lưu / trả 3 trường, JSON-LD + test.
- [ ] Step 3: Web — form 3 ô, trang tin + xem trước theo nhóm, khối thông tin + test.
- [ ] Step 4: Bấm thử dev (nhập 3 tin, so với TopCV), typecheck + test + build; gợi ý /code-review.
- [ ] Step 5: Deploy (sao lưu Neon, migrate 0017), nhập 3 tin thành bản nháp trên prod.

## 7. Risks

- Tin cũ có dòng bắt đầu bằng "-" lẫn dòng không có → dòng không có sẽ thành tiêu đề. Kiểm tra mọi tin trên prod trước
  khi deploy (hiện prod có 1 tin, không có gạch đầu dòng).
- Quyền lợi dài làm vỡ chip trên thẻ tin → chip `truncate`, kiểm tra 390 px.
- Trong nội dung TopCV có chữ "hàng đầu" (tin Trợ lý, tin HVAC) — Luật Quảng cáo sửa đổi 2025 cần chứng minh; giữ
  nguyên theo yêu cầu, báo HR quyết.
- Tin Logistics tự mâu thuẫn giờ làm (mô tả 8h00–17h30, phần Thời gian làm việc 08:00–17:00) → giữ nguyên cả hai, báo
  HR.
