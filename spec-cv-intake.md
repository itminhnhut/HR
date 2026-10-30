# Spec: Thêm và cập nhật CV ứng viên

## 1. Problem

CV chỉ vào hệ thống khi ứng viên tự nộp trên website:

- V1: CV nhận qua email, Zalo, người giới thiệu, TopCV… không đưa vào được → không chấm % khớp, không gửi sếp
  duyệt, không tự xoá đúng hạn.
- V2: hồ sơ nộp thiếu CV / link hỏng → HR không bổ sung được.
- V3: ứng viên muốn gửi CV mới cho hồ sơ đã nộp → phải nộp lại, sinh hồ sơ trùng.

## 2. Requirements

**Must have:**

- **A. HR thêm hồ sơ** (nút "Thêm hồ sơ" ở Hồ sơ ứng viên): vị trí (tin đang mở hoặc đã đóng, không nháp), họ tên,
  SĐT, email (không bắt buộc), **nguồn** (Email / Zalo / Người giới thiệu + ô "Ai giới thiệu" / TopCV / VietnamWorks
  / Facebook / Khác), CV (PDF ≤ 4 MB hoặc link, không bắt buộc), ghi chú, ô **bắt buộc** "Ứng viên đã chủ động gửi
  CV và đồng ý cho công ty dùng để tuyển dụng" (lưu thời điểm, phiên bản chính sách, tên HR xác nhận). Hồ sơ bắt đầu ở
  "Đã xem"; không gửi gì cho ứng viên, không đăng ký nhận tin.
- **Chặn trùng** SĐT + vị trí: báo "Đã có hồ sơ của … (nộp …, trạng thái …)" + nút Mở hồ sơ / Cập nhật CV vào hồ sơ
  đó. Khác vị trí vẫn tạo được.
- **B. HR thêm / đổi CV** cho mọi hồ sơ: PDF hoặc link; chỉ giữ CV mới nhất (file cũ xoá khỏi kho); **lịch sử đổi CV**
  (ai, lúc nào, tên file cũ); chấm lại % khớp. HR sửa được SĐT / email / nguồn / người giới thiệu của hồ sơ **do HR
  thêm** (hồ sơ tự nộp giữ nguyên dữ liệu gốc).
- **C. Ứng viên cập nhật CV** ở "Hồ sơ của tôi" (đăng nhập Google, đúng email hồ sơ): file mới / dùng CV đã lưu trong
  tài khoản / link. Chỉ khi trạng thái "Mới" hoặc "Đã xem", tin chưa đóng, tối đa **3 lần** mỗi hồ sơ. Không đổi trạng
  thái; HR thấy nhãn "Ứng viên vừa cập nhật CV" tới khi mở hồ sơ. Không được thì hiện lý do.
- **Nguồn**: nhãn trong danh sách + chi tiết ("HR thêm · Zalo"), lọc theo nguồn, đếm theo nguồn ở Tổng quan. Hồ sơ cũ
  và hồ sơ tự nộp = "Website".
- **Với Sếp duyệt**: CV đổi khi sếp chưa quyết → link sếp hiện "CV vừa cập nhật"; đổi sau khi sếp đã quyết → HR thấy
  "CV đổi sau khi sếp quyết".
- Tra cứu bằng SĐT thấy cả hồ sơ HR thêm (như hồ sơ tự nộp). Hồ sơ HR thêm có email → hiện trong "Hồ sơ của tôi"
  của tài khoản Google cùng email.

**Out of scope:**

- Nhập hàng loạt từ Excel, tự đọc tên/SĐT từ CV, kéo CV từ email, báo cho ứng viên khi HR nhận CV mới.
- Ứng viên chỉ tra cứu bằng SĐT (không đăng nhập) đổi CV.
- Gộp hồ sơ trùng tự động.

## 3. Approach

- Migration 0015 chỉ **thêm**: cột ở `applications` — `source` (enum, mặc định `website`), `referrer`, `added_by`
  (tên HR, null = tự nộp), `consent_by` (tên HR xác nhận), `candidate_cv_changes` (số lần ứng viên đổi),
  `cv_changed_at`, `cv_changed_by` (`candidate` | tên HR), `cv_change_seen` (HR đã mở sau lần ứng viên đổi);
  bảng `cv_changes` (lịch sử: hồ sơ, ai, lúc nào, tên file / link cũ).
- API HR (multipart, cần đăng nhập): `POST /hr/applications` (thêm, 409 `duplicate` kèm hồ sơ cũ),
  `PUT /hr/applications/:id/cv` (thêm / đổi CV), `PATCH /hr/applications/:id/contact` (SĐT / email / nguồn của hồ sơ
  HR thêm). Danh sách nhận `?source=`. Đổi CV → xoá điểm chấm cũ để bộ chấm nền chấm lại.
- API ứng viên: `PUT /candidate/applications/:id/cv` (BR-C1), `CandidateApplicationDto` thêm `canUpdateCv` + lý do.
- Sếp duyệt: `ReviewItemPublicDto.cvChangedAt` so với lúc gửi / lúc quyết để hiện nhãn.
- FE: hộp "Thêm hồ sơ", khối "CV" trong chi tiết (thêm / đổi + lịch sử), nhãn + bộ lọc nguồn, Tổng quan theo nguồn,
  "Cập nhật CV" trong "Hồ sơ của tôi".

## 4. Impact Analysis

- Files: packages/shared (types, validation), apps/api (schema, migration 0015, services apply / hr-applications /
  candidate-account / dashboard / review-public, routes), apps/web (api client + mock, HrApplicantsPage, ApplicantDetail,
  HrDashboardPage, CandidateAccountPage, pages/hr/applicants/\*, review link).
- Public API thay đổi: thêm route; `ApplicationRowDto`, `ApplicationDetailDto`, `CandidateApplicationDto`,
  `DashboardDto`, `ReviewItemPublicDto` thêm trường (không bỏ trường nào).
- Breaking change: không. Hồ sơ cũ = nguồn "Website".

## 5. Test Strategy

- Unit (shared): schema thêm hồ sơ (bắt buộc đồng ý, nguồn, người giới thiệu), quy tắc ứng viên được đổi CV.
- API (PGlite): HR thêm hồ sơ (đủ / thiếu / tin nháp / trùng SĐT + vị trí → 409 kèm hồ sơ cũ / khác vị trí OK), trạng
  thái "Đã xem", không đăng ký nhận tin; đổi CV (file cũ bị xoá, lịch sử, điểm chấm bị xoá); sửa liên hệ chỉ hồ sơ HR
  thêm; ứng viên đổi CV (đúng email, trạng thái, tin đóng, quá 3 lần, hồ sơ người khác → 404); nhãn HR thấy / tắt khi
  mở; lọc nguồn; Tổng quan theo nguồn; nhãn trên link sếp.
- Web: hộp thêm hồ sơ (lỗi tại ô, trùng), đổi CV, nút "Cập nhật CV" của ứng viên (có / không có + lý do).
- Manual: bấm thử LAN 390 / 1440.

## 6. Implementation Steps

- [x] Step 1: Shared — nguồn, kiểu dữ liệu, schema (zod), quy tắc "ứng viên được đổi CV" + test.
- [x] Step 2: DB + API HR — migration 0015, thêm hồ sơ (chặn trùng), thêm / đổi CV + lịch sử, sửa liên hệ, lọc nguồn,
      Tổng quan theo nguồn + test.
- [x] Step 3: API ứng viên + Sếp duyệt — ứng viên đổi CV (BR-C1), nhãn "Ứng viên vừa cập nhật CV", nhãn trên link
      sếp + test.
- [x] Step 4: Web HR — hộp "Thêm hồ sơ", khối CV trong chi tiết, nhãn + lọc nguồn, Tổng quan + test.
- [x] Step 5: Web ứng viên + link sếp — "Cập nhật CV" trong "Hồ sơ của tôi", nhãn "CV vừa cập nhật" + test.
- [x] Step 6: Bấm thử thật (LAN, 390 / 1440), sửa lỗi, typecheck + test + prettier; gợi ý /code-review.

## 7. Risks

- Đồng ý thay ứng viên (Nghị định 13): bắt buộc tích + lưu tên HR; form ghi rõ chỉ tích khi ứng viên chủ động gửi CV.
- Ứng viên spam đổi CV → tối đa 3 lần / hồ sơ, chỉ khi đăng nhập Google đúng email.
- Đổi CV giữa lúc sếp đang duyệt → nhãn trên link sếp; sau khi sếp quyết → cảnh báo cho HR.
- File cũ không xoá được khỏi kho (lỗi mạng) → vẫn lưu CV mới, ghi log, file mồ côi dọn sau (không chặn HR).
- ApplicantDetail.tsx đã 565 dòng → khối CV tách file riêng, không làm file này dài thêm.
