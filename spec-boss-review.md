# Spec: Sếp duyệt ứng viên trước khi phỏng vấn

## 1. Problem

HR lọc được nhiều ứng viên nhưng sếp muốn tự chọn ai được phỏng vấn. Hiện HR gửi CV qua Zalo, sếp trả lời rời rạc,
không lưu vết, HR có thể hẹn nhầm người sếp chưa duyệt.

## 2. Requirements

**Must have:**

- HR chọn nhiều ứng viên ở trang "Hồ sơ ứng viên" → "Gửi sếp duyệt" → điền: **tiêu đề**, **người gửi**
  (vd "Ngọc Anh (Phòng Nhân sự)"), **gửi cho** (vd "anh Minh"), **hạn phản hồi**, lời nhắn; mỗi ứng viên:
  HR đề xuất (Nên PV / Cân nhắc) + nhận xét (điền sẵn từ ghi chú hồ sơ).
- Hệ thống tạo **link riêng** `/duyet/<mã>`: sếp mở là xem, **không cần đăng nhập**.
- Trang sếp (mobile trước): tiêu đề, người gửi, hạn, lời nhắn; tiến độ "Đã quyết x/y"; lọc Tất cả / Chưa quyết /
  Duyệt / Không / Hỏi HR; thẻ ứng viên: tên, vị trí, ngày nộp, % khớp CV, so với yêu cầu (✓ ✕ ?), đề xuất và
  nhận xét HR, lời nhắn ứng viên, xem CV (chữ chìm "Bản xem của <gửi cho>"); 3 nút Duyệt PV / Không / Hỏi HR
  (Không và Hỏi HR bắt buộc ghi lý do), tự lưu, đổi ý được tới khi HR hẹn lịch; câu trả lời của HR hiện dưới
  câu hỏi; nút "Báo HR: đã xem xong". **Không** hiện SĐT, email.
- Trang HR "Đợt duyệt" (danh sách + chi tiết): quyết định, lý do, giờ; nút theo kết quả (Hẹn PV / Gửi tin cảm ơn /
  Trả lời sếp); link: copy, copy tin nhắn Zalo, gia hạn, khoá; thêm / bỏ ứng viên chưa quyết; nhật ký (mở link,
  xem CV, quyết định, đổi ý, xem xong, HR gia hạn / khoá / trả lời / bỏ qua). Tự cập nhật mỗi 15 giây.
- **Khoá hẹn phỏng vấn**: ứng viên đã gửi sếp (đợt chưa bị khoá) mà sếp chưa "Duyệt PV" thì không chuyển được sang
  "Hẹn phỏng vấn"; HR được **bỏ qua** khi gấp, bắt buộc ghi lý do, ghi vào nhật ký cho sếp thấy.
- An toàn link: mã ngẫu nhiên 32 byte; hết hạn = hạn phản hồi + 5 ngày; HR khoá / gia hạn bất cứ lúc nào; trang
  `noindex`, không Analytics, không Clarity; chỉ thấy ứng viên trong đợt.

**Out of scope (để sau):**

- Email / Zalo tự động cho sếp, nhắc quá hạn tự động.
- Bật/tắt "bắt buộc sếp duyệt" theo từng tin (bản này: chỉ khoá với ứng viên đã gửi sếp).
- Kinh nghiệm / học vấn / nơi ở của ứng viên: form ứng tuyển không thu; HR ghi trong nhận xét nếu cần.
- Nhiều cấp duyệt, demo mode (bản demo báo "không hỗ trợ").

## 3. Approach

- 3 bảng mới (migration 0014): `review_batches` (mã link, tiêu đề, người gửi, gửi cho, lời nhắn, hạn phản hồi,
  hết hạn, khoá, sếp mở lúc, xem xong lúc), `review_items` (đợt × hồ sơ: đề xuất + nhận xét HR, quyết định + lý
  do của sếp, trả lời của HR), `review_events` (nhật ký). Xoá hồ sơ → xoá item (cascade), nhật ký giữ dòng nhưng
  bỏ liên kết.
- API HR `/api/hr/reviews…` (cần đăng nhập). API sếp `/api/review/:token…` (không đăng nhập, mã sai → 404, đợt
  khoá/hết hạn → chỉ đọc). CV sếp xem qua `/api/review/:token/items/:id/cv` (chỉ hồ sơ trong đợt).
- Khoá hẹn PV kiểm ở `updateApplication` (BE), FE hiện lý do + "Vẫn hẹn (ghi lý do)".
- FE: trang công khai `/duyet/:token` (layout riêng, không menu site), trang HR `/hr/duyet` và `/hr/duyet/:id`,
  chế độ chọn nhiều ở "Hồ sơ ứng viên".

## 4. Impact Analysis

- Files: packages/shared (types, validation), apps/api (schema, migration, services/reviews*, routes, hr-applications),
  apps/web (api client + mock, router, HrLayout menu, HrApplicantsPage, ApplicantDetail, pages/review/_,
  pages/hr/reviews/_, analytics UNTRACKED_PATHS).
- Public API thay đổi: thêm route mới; `PATCH /hr/applications/:id` thêm `reviewBypassReason`, trả 409
  `needs_review` khi bị khoá.
- Breaking change: không (ứng viên chưa gửi sếp không bị ảnh hưởng).

## 5. Test Strategy

- Unit/integration API (PGlite): tạo đợt (hợp lệ / thiếu / ứng viên đang chờ ở đợt khác), sếp xem không lộ SĐT
  email, quyết định + lý do bắt buộc, đổi ý, khoá khi đã hẹn PV, link hết hạn / bị khoá, CV chỉ trong đợt, khoá hẹn
  PV + bỏ qua có lý do, nhật ký, gia hạn / khoá / thêm / bỏ / trả lời.
- Web: chọn nhiều + gửi, trang sếp (quyết định, lý do bắt buộc, link hết hạn), trang HR đợt duyệt, khoá hẹn PV.
- Manual: bấm thử điện thoại + máy tính qua LAN, ảnh chụp 390 / 1440.

## 6. Implementation Steps

- [x] Step 1: Shared — kiểu dữ liệu + validation (zod) + test.
- [x] Step 2: DB + API — migration 0014, service, route HR + route sếp, khoá hẹn PV + test.
- [x] Step 3: Web HR — chọn nhiều + hộp "Gửi sếp duyệt", trang Đợt duyệt (danh sách + chi tiết), menu, khoá hẹn PV
      trong chi tiết hồ sơ.
- [x] Step 4: Web sếp — trang `/duyet/:token` + xem CV, không Analytics/Clarity, noindex.
- [x] Step 5: Bấm thử thật (LAN, 390/1440), sửa lỗi, typecheck + test + prettier; gợi ý /code-review.

## 7. Risks

- Link bị chuyển tiếp: ai có link xem được tới khi hết hạn → có hạn, khoá được, không SĐT/email, chữ chìm.
- Sếp đổi ý sau khi HR đã hẹn → API chặn (409), sếp thấy "HR đã hẹn lịch".
- Hồ sơ bị xoá (30 ngày sau đóng tin) giữa chừng → item biến mất, nhật ký ghi "Hồ sơ đã xoá".
- Hai HR cùng gửi một ứng viên → chặn: một hồ sơ chỉ ở một đợt đang chờ (chưa quyết hoặc "Hỏi HR").
