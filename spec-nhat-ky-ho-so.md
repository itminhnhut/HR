# Spec: Nhật ký chuẩn cho Hồ sơ ứng viên và ghi chú nhiều lần

## 1. Problem

Phần Hồ sơ ứng viên đang ghi lịch sử rời rạc, không giống tab Nhật ký của Chấm công:
- Nhật ký từng hồ sơ ("Nhật ký hồ sơ (n)") chỉ có đổi trạng thái, giờ phỏng vấn, ghi chú, sửa liên hệ và thư đã gửi.
- **Không có trang nhật ký chung** để xem trong ngày ai đã làm gì với những hồ sơ nào.
- **Xoá hồ sơ thì mất luôn mọi dòng nhật ký** của hồ sơ đó, và việc xoá cũng không được ghi lại.
- Một số thao tác không được ghi: thêm hồ sơ, đổi CV, gửi sếp duyệt và kết quả sếp duyệt, chấm CV, quản lý nguồn.

Ghi chú nội bộ chỉ có một ô chữ. HR không ghi được nhiều lần kiểu "T7 gọi chưa được", rồi "T2 gọi chưa được", rồi "Ứng viên hẹn T3".

## 2. Requirements

**A. Nhật ký chung "Nhật ký tuyển dụng"**, giống tab Nhật ký của Chấm công:
- Một trang riêng trong Hồ sơ ứng viên.
- Gom theo ngày, mới nhất trên cùng. Mỗi dòng có icon, việc gì, của hồ sơ nào (bấm để mở hồ sơ), cũ → mới, ai làm, mấy giờ.
- Lọc theo nhóm việc:
  - Hồ sơ: thêm, sửa thông tin, đổi CV, xoá;
  - Trạng thái;
  - Lịch phỏng vấn;
  - Ghi chú;
  - Liên hệ: gọi, Zalo, thư;
  - Sếp duyệt;
  - Chấm CV;
  - Nguồn.
- Tìm theo tên ứng viên, người làm hoặc nội dung. Có nút xem thêm khi dài.
- Không mở modal; bấm tab nhóm thì không ghi nhật ký.
- **Mọi thao tác thêm, sửa, xoá trong phần hồ sơ đều ghi**, kể cả xoá hồ sơ. Dòng nhật ký của hồ sơ đã xoá vẫn giữ tên, ghi "(đã xoá)".
- "Nhật ký hồ sơ (n)" trong từng hồ sơ vẫn giữ như cũ, đọc cùng nguồn.

**B. Ghi chú nhiều lần**, dạng dòng thời gian:
- Ô "Thêm ghi chú", bấm Enter hoặc nút "Ghi" để lưu. Mỗi ghi chú là một dòng có giờ và người ghi, mới nhất trên cùng.
- Sửa hoặc xoá được từng dòng. Có ghi nhật ký, nội dung cũ vẫn giữ trong nhật ký.
- Danh sách hồ sơ hiện ghi chú mới nhất, như dòng ghi chú hiện nay.
- Ghi chú cũ đang có chuyển thành dòng đầu tiên, giữ đúng giờ và người lưu gần nhất. Không mất chữ nào.

**Out of scope:**
- Nhật ký cho Tin tuyển dụng, Mẫu thư, Tài khoản HR.
- Nhắc việc theo ghi chú (vd "gọi lại T3").

## 3. Approach

- Bảng mới `recruitment_log`: `id`, `application_id` (null khi hồ sơ đã xoá), `candidate_name`, `job_title`, `actor`, `action`, `group`, `detail`, `from`, `to`, `at`.
  - Giữ tên ứng viên và vị trí ngay trên dòng log, nên xoá hồ sơ vẫn đọc được.
- Mỗi thao tác ghi qua một hàm chung `logRecruitment(...)`.
  - Chỗ đã ghi `application_activity` hôm nay thì ghi thêm vào bảng mới.
  - Chỗ chưa ghi thì thêm.
- Bảng mới `application_notes`: `id`, `application_id`, `body`, `created_by`, `created_at`, `updated_at`.
  - Migration chép ghi chú cũ thành dòng đầu. Cột `note` cũ giữ lại một thời gian để an toàn, không đọc nữa.
- **API:**
  - `GET /api/hr/recruitment-log?nhom=&tim=&tu=`;
  - `POST`, `PATCH`, `DELETE /api/hr/applications/:id/notes`.
- **Web:**
  - tab hoặc trang "Nhật ký" trong Hồ sơ ứng viên, dùng lại cách trình bày của Nhật ký chấm công;
  - khối "Ghi chú" mới thay ô chữ hiện tại.

## 4. Impact Analysis

- **Schema:** 2 bảng mới, migration chép ghi chú cũ.
- **API:**
  - các service hồ sơ: hr-applications, hr-intake, reviews, cv-match, sources, contact log;
  - route mới cho nhật ký và ghi chú.
- **Web:** trang Hồ sơ ứng viên (thêm Nhật ký), DetailFacts (khối ghi chú), ApplicantList (dòng ghi chú).
- **Public API:** thêm route. `PATCH` hồ sơ với `note` vẫn nhận, và thêm thành một dòng ghi chú để không vỡ chỗ cũ.
- **Breaking change:** không.

## 5. Test Strategy

- Mỗi thao tác trong mục A ghi đúng một dòng: nhóm, cũ → mới, người làm.
- Xoá hồ sơ thì nhật ký còn, ghi "(đã xoá)".
- Lọc nhóm, tìm chữ, xem thêm.
- Ghi chú: thêm, sửa, xoá, thứ tự mới nhất trên cùng, danh sách hồ sơ hiện dòng mới nhất.
- Migration chép ghi chú cũ đúng chữ, đúng giờ, đúng người.
- Thử tay trên web và điện thoại.

## 6. Implementation Steps

- [ ] Step 1: bảng `recruitment_log`, hàm ghi chung, ghi cho các thao tác đang có.
- [ ] Step 2: ghi thêm các thao tác còn thiếu, trong đó có xoá hồ sơ.
- [ ] Step 3: trang Nhật ký tuyển dụng.
- [ ] Step 4: bảng ghi chú, migration chép ghi chú cũ, API ghi chú.
- [ ] Step 5: khối ghi chú dạng dòng thời gian trên web.

## 7. Risks

- **Ghi trùng:** một thao tác có thể ghi 2 nơi (`application_activity` và `recruitment_log`). Gom vào một hàm để không lệch.
- **Dữ liệu cá nhân:** nhật ký giữ tên ứng viên sau khi hồ sơ bị xoá. Hồ sơ bị xoá theo yêu cầu của ứng viên thì xoá luôn tên trong nhật ký, chỉ giữ "Ứng viên đã xoá". Cần bạn chốt (mục 8).

## 8. Đã chốt (DUYỆT)

1. Khi xoá hồ sơ theo yêu cầu ứng viên, nhật ký có giữ tên ứng viên không? → **Không giữ tên**, chỉ ghi "Ứng viên đã xoá (vị trí X)".
2. Sửa ghi chú: ai cũng sửa được ghi chú của người khác, hay chỉ người viết? → **Ai cũng sửa được**, nhật ký giữ bản cũ.
