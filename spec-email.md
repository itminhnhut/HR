# Spec: Mẫu email cho HR, gửi bằng mail của chính HR

Chủ sản phẩm (25/10): thư gửi từ hộp mail của HR, web chỉ soạn sẵn theo mẫu; chỉ dùng thứ miễn phí.

## 1. Problem

HR phải tự gõ lại thư mời phỏng vấn / thư cảm ơn cho từng người: tên, vị trí, giờ, địa chỉ, link Meet… dễ sai và mất
thời gian. Mẫu tin Zalo hiện có nằm cứng trong code, HR không sửa được.

## 2. Requirements

**Must have:**

- **Trang "Mẫu thư" (`/hr/mau-thu`)**: HR sửa các mẫu: _Mời phỏng vấn trực tiếp_, _Mời phỏng vấn online_, _Cảm ơn /
  chưa phù hợp_, _Hẹn gọi điện_. Mỗi mẫu có tiêu đề + nội dung, chèn ô thông tin bằng nút bấm (không phải gõ ký hiệu):
  `{Tên ứng viên}`, `{Vị trí}`, `{Giờ phỏng vấn}`, `{Địa chỉ}`, `{Link Meet}`, `{Tên HR}`, `{SĐT HR}`, `{Công ty}`. Có
  sẵn nội dung mặc định, có nút "Dùng lại mẫu gốc". Dùng chung cho email và Zalo.
- **Thông tin người gửi** (trong trang Tài khoản HR, mỗi HR tự điền): tên hiển thị, số điện thoại/Zalo, email thật
  (Gmail…) dùng để gửi. Điền vào `{Tên HR}`, `{SĐT HR}`.
- **Trong chi tiết hồ sơ**: nút "Soạn thư" mở hộp thư: chọn mẫu → thư đã điền sẵn, ô nào còn thiếu thì tô vàng
  (vd chưa có giờ phỏng vấn) → HR sửa nếu muốn → bấm:
  - **"Mở Gmail"**: mở Gmail của HR với người nhận, tiêu đề, nội dung điền sẵn, HR bấm Gửi trong Gmail.
  - **"Mở ứng dụng mail"** (mailto, cho điện thoại / Outlook).
  - **"Sao chép"** (dán vào Zalo hoặc nơi khác).
- **Phỏng vấn online**: chọn _Trực tiếp_ / _Online_; Online có ô dán link Meet và nút "Tạo lịch Google + Meet" mở sẵn
  Google Calendar đúng giờ, đúng tên ứng viên (HR bấm "Thêm Google Meet" rồi lưu, dán link lại). Thư mời có thêm dòng
  "Thêm vào lịch của bạn: <link Google Calendar>".
- **Ghi nhận đã liên hệ**: bấm Mở Gmail / mailto / Sao chép thì lưu vào hồ sơ "Đã soạn thư Mời phỏng vấn lúc 10:30 ·
  Phòng Nhân sự" (web không biết HR có bấm Gửi thật hay không, nên ghi là "đã soạn").
- Ứng viên không có email: nút "Mở Gmail"/mailto khoá, vẫn sao chép được để gửi Zalo.

**Out of scope:** web tự gửi email (cần dịch vụ gửi + DNS), tự tạo Google Meet bằng API, đọc thư trả lời trong web.

## 3. Approach

- Không thêm dịch vụ ngoài. "Mở Gmail" = link `https://mail.google.com/mail/?view=cm&to=…&su=…&body=…`; mailto cho
  ứng dụng khác. Nội dung là chữ thường (Gmail compose không nhận HTML/đính kèm qua link).
- Bảng `message_templates` (key, subject, body), mặc định trong `packages/shared`; thay ô thông tin ở FE.
- `hr_users`: thêm `display_name` (đã có `name`), `phone`, `contact_email`.
- `applications`: thêm `interview_mode` (`onsite` | `online`), `meeting_url`.
- Bảng `contact_log` (application_id cascade, template_key, channel `gmail|mailto|copy`, hr_name, created_at).
- Thay mẫu Zalo cứng trong `ApplicantDetail` bằng hộp soạn thư này.

## 4. Impact Analysis

- Files: `packages/shared` (mẫu mặc định, hàm điền ô, types), `apps/api` (migration 0007, routes mẫu thư, hồ sơ, tài
  khoản HR, contact_log), `apps/web` (trang Mẫu thư, hộp Soạn thư, Tài khoản HR, mock).
- Public API: thêm endpoint/trường. Breaking: không.

## 5. Test Strategy

- Unit: điền ô thông tin, báo ô thiếu, link Gmail/mailto/Google Calendar mã hoá đúng tiếng Việt, giờ VN.
- Integration: lưu/đọc/đặt lại mẫu; HR cập nhật thông tin người gửi; ghi contact_log, xoá theo hồ sơ.
- Thủ công: bấm "Mở Gmail" trên máy và điện thoại, thư hiện đúng dấu tiếng Việt.

## 6. Implementation Steps

- [x] Step 1: Mẫu thư (shared + BE + trang `/hr/mau-thu`), thông tin người gửi trong Tài khoản HR.
- [x] Step 2: Hộp Soạn thư trong hồ sơ (Gmail / mailto / sao chép), Trực tiếp/Online + link Meet + link Google
      Calendar, ghi nhận đã liên hệ.

## 7. Risks

- Link Gmail quá dài (> ~2.000 ký tự) có thể bị cắt → giới hạn nội dung mẫu 1.500 ký tự, báo khi vượt.
- HR đăng nhập nhiều tài khoản Google → Gmail mở tài khoản mặc định; thêm ghi chú "kiểm tra người gửi trước khi bấm Gửi".
