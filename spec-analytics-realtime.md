# Spec: "Đang truy cập" ở trang Tổng quan

## 1. Problem

HR muốn thấy ngay trong admin có bao nhiêu người đang xem web, không phải mở Google Analytics.

## 2. Requirements

- Khối "Đang truy cập": số người trong 30 phút gần nhất, số người theo từng phút, trang đang xem, thành phố, thiết bị.
- Chỉ HR đã đăng nhập mới xem được. Khoá chỉ nằm trên server.
- Tự cập nhật mỗi phút. Chưa kết nối hoặc Google lỗi thì nói rõ, không hiện số giả.

**Giới hạn của Google (tài liệu Realtime API):** không có nguồn truy cập (Google, Facebook…) và không có đường dẫn trang. Trang
là tiêu đề trang; "đến từ đâu" là thành phố. Muốn xem nguồn: báo cáo thường của Analytics.

**Out of scope:** ghi riêng lượt truy cập vào database, thống kê trang admin (cố ý không theo dõi).

## 3. Approach

API `GET /api/hr/analytics/realtime` gọi `runRealtimeReport` bằng service account chỉ đọc, ký JWT bằng `jose` (đã có), không thêm
thư viện. Kết quả dùng chung 60 giây; lỗi giữ 30 giây. Mỗi lần làm mới gọi 5 báo cáo, chỉ khi có HR đang mở trang.

## 4. Cách kết nối (làm một lần)

1. Google Cloud Console: tạo project, bật **Google Analytics Data API**.
2. Tạo **Service account**, không cần gán vai trò, rồi tạo khoá dạng JSON. Giữ file này như mật khẩu, không gửi qua chat.
3. Google Analytics > Quản trị > **Quyền truy cập vào tài sản**: thêm email của service account, vai trò **Người xem**.
4. Lấy **mã số tài sản**: Quản trị > Chi tiết tài sản (dãy số, không phải `G-...`).
5. Vercel > Environment Variables (Production), từ file JSON:
   - `GA_PROPERTY_ID`: mã số ở bước 4.
   - `GA_CLIENT_EMAIL`: trường `client_email`.
   - `GA_PRIVATE_KEY`: trường `private_key`, dán nguyên cả phần `\n`.
6. Redeploy. Khối sẽ tự chuyển từ "chưa kết nối" sang số liệu. Thử ở máy: đặt 3 biến trong `apps/api/.env`.

## 5. Test

- Đổi JWT, đọc báo cáo, sắp xếp, dùng chung kết quả, lỗi không lộ khoá: `lib/ga-realtime.test.ts` (Google là fake).
- Route cần đăng nhập: `routes/hr-dashboard.test.ts`. Các trạng thái hiển thị: `RealtimePanel.test.tsx`.
- **Chưa thử với Google Analytics thật**: cần khoá ở bước 5.
