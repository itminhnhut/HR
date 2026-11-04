# Spec: Giao diện admin theo shadcn/ui

## 1. Problem

Component admin là kiểu riêng: 7 cỡ chiều cao, ô select gốc của trình duyệt, `window.confirm`, `title` làm chú thích.

## 2. Requirements

- Kích thước, bo góc, vòng focus, trạng thái theo shadcn: nút cao 32/36/40px, bo 6px, focus vòng 3px, tắt thì mờ 50%.
- Điện thoại giữ cao 44px để dễ bấm. Giữ màu của admin. Trang công khai không đổi.
- Select, hộp xác nhận, chú thích, menu dùng component shadcn thật (Radix).

**Out of scope:** dark mode, đổi thang cỡ chữ trên toàn bộ trang.

## 3. Approach

- Component dùng chung (`ui/Button`, `ui/Field`) có thêm class đánh dấu `ui-btn`, `ui-field`; `admin.css` nằm ngoài layer Tailwind nên ghi đè được trong `.hr-admin`, trang công khai không bị ảnh hưởng.
- Component shadcn thật nằm trong `pages/hr/shadcn/`, chỉ admin dùng.

## 4. Đồng bộ toàn admin

- Một lịch duy nhất (`shadcn/Calendar.tsx`) cho hạn nộp, giờ phỏng vấn, báo cáo; ngày giờ ở Sếp duyệt dùng chung ô giờ phỏng vấn.
- Một kiểu nút chọn (`shadcn/toggle.ts`), bo 6px thay cho dạng viên thuốc.
- Tiêu đề hộp thoại `text-lg font-semibold`, khung nội dung `p-6` (điện thoại `p-4`), popover bo 6px, nhãn ô nhập `text-sm font-medium`.
- Thư mời phỏng vấn có sẵn dòng "CV bạn đã nộp → Mở file CV", nên sao chép là có theo: khay sao chép không chở được file đính kèm, chỉ chở được link. Link ký bằng HMAC (`lib/cv-link.ts`), không cần đăng nhập, hạn 30 ngày, mất tác dụng khi đổi CV hoặc xoá hồ sơ. Chỉ với file đã lưu; link dán từ trang tuyển dụng có thể chứa khoá của nhà tuyển dụng nên không đưa vào thư. Nút "Tải CV" vẫn còn cho ai muốn gửi file.
