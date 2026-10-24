# Spec: Tra cứu hồ sơ bằng SĐT, ứng tuyển có/không đăng nhập, nộp lại do HR duyệt

Chủ sản phẩm duyệt ngày 2026-10-24 (theo phân tích BA `docs/ba/2026-10-24-phan-tich-nghiep-vu-mvp.md`, câu Q1 và Q3).

## 1. Problem

- Ứng viên không đăng nhập không có cách xem hồ sơ của mình đã tới đâu.
- Khi bấm "Ứng tuyển", ứng viên không được chọn đăng nhập để điền sẵn và theo dõi; tài khoản lưu 1 CV nhưng lúc nộp
  không dùng được.
- Nộp lại trong 30 ngày đang tự đưa hồ sơ về "Mới", làm mất quyết định HR đã đặt.

## 2. Requirements

**Must have:**

- **Tra cứu hồ sơ** `/tra-cuu-ho-so`, không cần đăng nhập, chỉ cần số điện thoại:
  - Hiện hồ sơ nộp bằng số đó trong **90 ngày** gần nhất: tên vị trí (link tới tin), ngày nộp, trạng thái ứng viên được
    thấy (Đã gửi / HR đã xem / Mời phỏng vấn / Đạt / Đã đóng). Không hiện họ tên, email, CV, ghi chú HR.
  - Giới hạn: **5 lần / 15 phút / máy (IP)** và **10 lần / ngày / số**; quá thì 429 "thử lại sau".
  - `noindex`, có trong `robots.txt` Disallow. Gọi bằng POST để số không nằm trên URL.
  - Lối vào: menu, chân trang, màn hình "Đã gửi hồ sơ".
  - Form nộp hồ sơ ghi rõ: "Bạn có thể tra cứu trạng thái hồ sơ bằng số điện thoại này."
- **Ứng tuyển có/không đăng nhập**:
  - Chưa đăng nhập: bước đầu hỏi "Đăng nhập Google (điền sẵn, dùng CV đã lưu, theo dõi hồ sơ)" hoặc "Nộp không cần
    đăng nhập". Đăng nhập xong quay lại đúng form.
  - Đã đăng nhập: form điền sẵn; nếu tài khoản có CV thì mặc định "Dùng CV đã lưu: <tên file>", vẫn chọn được tải file
    khác hoặc dán link. BE chép file CV của tài khoản thành file riêng của hồ sơ (đổi/xoá CV tài khoản không làm hỏng hồ
    sơ đã nộp).
- **Nộp lại trong 30 ngày (BR-07)**: cập nhật nội dung hồ sơ cũ nhưng **giữ trạng thái và ghi chú HR**; đánh dấu "Ứng
  viên vừa cập nhật". Nhãn hiện ở danh sách và chi tiết hồ sơ phía HR, tắt khi HR mở hồ sơ.

**Out of scope:** captcha (cần khoá Cloudflare Turnstile), giới hạn số lần nộp theo IP, phần tuân thủ đợt 3.

## 3. Approach

- Bảng `rate_limit_hits (key, at)`: mỗi lần tra thêm 1 dòng; đếm theo cửa sổ thời gian; dọn dòng cũ hơn 1 ngày.
- `applications.candidate_updated_at`: thời điểm ứng viên nộp lại; HR mở hồ sơ thì xoá về null.
- `POST /api/applications/lookup { phone }` → `{ applications: LookupItemDto[] }`.
- `POST /api/applications` nhận thêm `useSavedCv=true` khi đã đăng nhập.

## 4. Test Strategy

BE (PGlite, gọi HTTP): chỉ trả trường cho phép; 90 ngày; giới hạn đúng ngưỡng theo IP và theo số; số sai 422; nộp lại
giữ trạng thái + bật nhãn, HR mở thì tắt nhãn; dùng CV đã lưu tạo file riêng, đổi CV tài khoản không ảnh hưởng; không
có CV đã lưu thì báo thiếu CV. Test hợp đồng FE↔BE cho tra cứu và CV đã lưu. Test mock tương ứng.

## 5. Implementation Steps

- [x] Step 1: Tra cứu hồ sơ (BE + FE + lối vào + robots).
- [x] Step 2: Ứng tuyển có/không đăng nhập + dùng CV đã lưu.
- [x] Step 3: Nộp lại giữ trạng thái, nhãn "Ứng viên vừa cập nhật".
