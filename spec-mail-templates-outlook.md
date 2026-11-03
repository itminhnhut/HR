# Spec: Mẫu thư thiết kế sẵn và gửi qua Outlook

## 1. Problem

HR đã có 3 mẫu thư HTML đúng nhận diện Top Flow (mời phỏng vấn, từ chối hồ sơ, từ chối sau phỏng vấn), nhưng admin chỉ
soạn được chữ thường, tối đa 1.500 ký tự, và chỉ mở được Gmail hoặc ứng dụng mail (không mang được HTML). HR dùng Outlook
trên Microsoft 365 nên hiện không gửi được thư đúng mẫu từ admin.

`topflow.vn` chạy trên Microsoft 365, DMARC `p=reject`. Tài khoản Entra của người gửi hiện không có vai trò quản trị.

Spec này thay quyết định 25/10 trong `spec-email.md` ("web chỉ soạn, không tự gửi"): vẫn miễn phí, vẫn gửi từ hộp thư HR,
nhưng nút Gửi nằm trong admin.

## 2. Requirements

**Must have — Giai đoạn 1 (không phụ thuộc ai):**

- Thư dùng đúng thiết kế của 3 mẫu: logo, khối ngày giờ, khối nổi bật, chữ ký, chân thư.
- 5 mẫu:

  | Mẫu | Nguồn |
  | --- | --- |
  | Mời phỏng vấn trực tiếp | File HR gửi |
  | Mời phỏng vấn online | Dựng cùng kiểu; thay địa điểm bằng link Meet, hình thức "Online" |
  | Từ chối hồ sơ | File HR gửi |
  | Từ chối sau phỏng vấn | File HR gửi (mẫu mới, tách khỏi mẫu chung) |
  | Hẹn gọi điện | File `Mau_Thu_hen_goi_dien_TopFlow.html` của HR, chỉnh: không hứa phỏng vấn trực tiếp, phản hồi trong 24 giờ, "HR sẽ gọi từ số" |

- Tự điền: tên ứng viên, vị trí, thứ, ngày, tháng/năm, giờ, ngày phỏng vấn (từ hồ sơ); địa chỉ, link bản đồ, hotline,
  website, `hr@topflow.vn` (cấu hình công ty); tên, số điện thoại, chức danh, tên gọi khác của HR (Tài khoản HR).
- Ô mới:
  - Tài khoản HR: **Chức danh** ("HR Generalist"), **Tên gọi khác** ("Ms. Lee", không bắt buộc).
  - Hộp soạn thư: **Người trao đổi**, **Thời lượng**, **Địa chỉ**, điền sẵn theo mẫu, sửa được cho từng thư.
- Tiêu đề thư (đề xuất, HR sửa được ở trang Mẫu thư):
  - `[Top Flow] Thư mời phỏng vấn vị trí {Vị trí}`
  - `[Top Flow] Thư mời phỏng vấn online vị trí {Vị trí}`
  - `[Top Flow] Phản hồi hồ sơ ứng tuyển vị trí {Vị trí}`
  - `[Top Flow] Cảm ơn bạn đã tham gia phỏng vấn vị trí {Vị trí}`
  - Hẹn gọi điện: `[Top Flow] Thư hẹn trao đổi qua điện thoại vị trí {Vị trí}`.
- Trang Mẫu thư: HR sửa tiêu đề, phần chữ mở đầu, khối nổi bật, phần chữ kết. **Khung thiết kế cố định**, HR không sửa
  HTML. Có xem trước đúng như thư thật và nút "Dùng lại mẫu gốc".
- Hộp soạn thư trong hồ sơ: xem trước thư đã điền; ô thiếu dữ liệu vẫn tô vàng như hiện nay. Mẫu gợi ý tự chọn:
  bị từ chối và đã có lịch phỏng vấn → Từ chối sau phỏng vấn; bị từ chối, chưa phỏng vấn → Từ chối hồ sơ.
- Nút **"Sao chép thư đẹp"**: chép thư HTML (kèm bản chữ thường) để dán vào Outlook. Ghi vào lịch sử liên hệ.
- Giữ "Mở Gmail", "Mở ứng dụng mail", "Sao chép" bằng bản chữ thường sinh từ cùng nội dung, cho Gmail/Zalo.
- Sửa nội dung so với file gốc:
  - 2 mẫu từ chối: thay câu "lưu hồ sơ vào nguồn ứng viên" bằng "Nếu bạn muốn công ty giữ hồ sơ cho các vị trí sau, hãy
    phản hồi thư này." (đang mâu thuẫn với chính sách xóa sau 30 ngày).
  - Từ chối sau phỏng vấn: "đến văn phòng ... tham gia" → "tham gia" (đúng cả khi phỏng vấn online).
  - Từ chối hồ sơ: link cơ hội mới ghi cả `topflow.vn` và `www.lee-hr.com` (không để `www.lee-hr.com` đứng một mình).

**Giai đoạn 2: bỏ (user chốt 2026-11-03).** Tạo thư nháp cần `Mail.ReadWrite`, quyền mở được cả hộp thư, không đáng rủi ro so với một lần
Ctrl+V. HR dùng "Sao chép & mở Outlook", dán rồi bấm Gửi trong Outlook.

**Out of scope:**

- Gửi hàng loạt, gửi tự động khi đổi trạng thái, đọc thư trả lời trong admin, biết ứng viên đã mở thư.
- Tính năng nguồn ứng viên (giữ hồ sơ quá 30 ngày có đồng ý).
- Đính kèm file vào thư. Brevo, file `.eml`, SMTP bằng mật khẩu.
- Đổi địa chỉ văn phòng hiển thị trên website (đề xuất riêng sau spec này).

## 3. Approach

**Dựng thư:** hàm thuần trong `packages/shared/src/mail/` nhận mẫu + giá trị + nguồn logo, trả HTML kiểu bảng theo đúng file
gốc và bản chữ thường. Mọi giá trị đều **escape** (tên ứng viên là dữ liệu ngoài), link `mailto:` mã hoá tiêu đề. Xem trước
bằng `iframe` `sandbox` + `srcDoc`.

**Logo:** giai đoạn 1 nhúng base64 ngay trong thư (xem trước và bản sao chép, đúng file của mẫu); cần thử dán thật vào Outlook và nhận trên Gmail vì Gmail có thể không hiện ảnh `data:`. Nếu Gmail không hiện logo sau khi dán từ Outlook thì đổi sang ảnh trên site `https://www.lee-hr.com/images/mail/*.png` (cùng file).

**Soạn thư:** drawer bên phải (`Dialog variant="side"`): form trái, xem trước phải, nút gửi luôn ở chân; điện thoại mở toàn màn hình với 2 tab Soạn / Xem trước. Người gửi và nội dung thư gấp lại khi đã đủ, tự mở khi còn thiếu.

**Dữ liệu (migration 0018):**

- Enum `template_key` thêm `rejection_interview`; `contact_channel` thêm `copy_html`.
- `message_templates` thêm `callout_title`, `callout`, `closing`. `body` là phần mở đầu. Mẫu đã lưu đổi về mẫu gốc mới
  (trước khi chạy kiểm tra prod; nếu HR đã sửa thì báo trước, không tự ghi đè).
- `hr_users` thêm `job_title` (mặc định `HR Generalist`, xoá được, không bắt buộc), `alias`.

## 4. Impact Analysis

- Files: `packages/shared` (mail, message-templates, types, validation), `apps/api` (schema, migration, message-templates,
  tài khoản HR, contact log), `apps/web` (ComposeMessage, trang Mẫu thư, Tài khoản
  HR, mock, `public/images/mail`).
- Public API: thêm trường và route `/api/hr/...`; trường cũ giữ nguyên, API công khai không đổi.
- Breaking change: không. Nội dung mẫu đã lưu đổi sang mẫu mới.

## 5. Test Strategy

- Unit (shared): dựng đủ 5 mẫu, ô thiếu; escape tên chứa `<script>`, `&`, dấu tiếng Việt; thứ/ngày/giờ theo giờ Việt Nam;
  `mailto:` mã hoá đúng; bản chữ thường đủ nội dung; không còn `{{` hay `data:image` trong HTML.
- API (PGlite): migration giữ hồ sơ, lịch sử liên hệ; lưu/đặt lại mẫu; chức danh HR.
- Web: chọn mẫu gợi ý đúng; xem trước; nút sao chép ghi lịch sử; mở Outlook sau khi chép xong.
- Manual: dán và gửi thử tới hộp thư thử (không phải ứng viên thật) rồi xem trên Outlook desktop, Outlook web, Gmail, điện
  thoại.

## 6. Implementation Steps

**Giai đoạn 1**

- [ ] Step 1: Shared — dựng thư HTML + chữ thường, 5 mẫu mặc định, escape + test.
- [ ] Step 2: DB + API — migration 0018, mẫu nhiều phần, chức danh HR, kênh lịch sử mới + test.
- [ ] Step 3: Web — trang Mẫu thư, hộp soạn thư có xem trước, ô mới, "Sao chép thư đẹp" + test.
- [ ] Step 4: Kiểm tra dev, gợi ý /code-review, deploy (sao lưu Neon, migrate), **HR thử dán vào Outlook thật**.

## 7. Risks

- **Outlook desktop hiển thị khác trình duyệt** (bỏ bo góc, sai khoảng cách): file gốc đã dùng bảng; phải thử trên Outlook
  thật, chỉnh ở Step 4. Bo góc mất trên Outlook desktop là chấp nhận được.
- **Dán vào Outlook có thể mất định dạng hoặc phải bấm tải ảnh:** chưa kiểm chứng. Thử dán thật ở Step 4; logo sai trên Gmail thì
  đổi sang ảnh trên site.
- **App không biết HR đã bấm Gửi chưa:** lịch sử chỉ ghi đã soạn thư.
- **SMTP bằng mật khẩu tắt mặc định từ 12/2026:** đã loại, không ảnh hưởng.
