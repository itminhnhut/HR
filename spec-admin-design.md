# Giao diện admin: hệ thiết kế chung

Áp dụng cho mọi trang `/hr`. Trang công khai giữ nguyên, trừ logo.

## Nguyên tắc

1. **Sáng, dễ nhìn:** nền sáng, menu trắng, tiêu đề không chân (sans-serif), bo góc 8–12 px.
2. **Một màu một nghĩa:** không dùng tím. Màu lấy từ 9 họ trong `pages/hr/design/tone.ts`.
3. **Trạng thái luôn có chữ và icon:** màu không bao giờ là tín hiệu duy nhất.
4. **Rộng hết màn hình:** không giới hạn chiều rộng trang. Biểu mẫu dài xếp 2 cột từ 1280 px.
5. **Hiệu ứng ngắn:** 120–180 ms, có phản hồi khi rê và khi bấm; tắt theo cài đặt giảm chuyển động của máy.

## Dùng gì ở đâu

| Việc | Dùng | Không tự viết |
| --- | --- | --- |
| Màu của admin | `.hr-admin` trong `admin.css`, bật bằng `useAdminTheme` | Mã màu rời trong trang |
| Một khu vực (icon, màu) | `design/sections.ts` | Icon riêng ở menu hoặc tiêu đề |
| Tiêu đề trang | `PageHeading` (tự lấy icon theo khu vực) | `<h1>` tự style |
| Tiêu đề khối | `SectionTitle` | `<h2>` trần |
| Tab | `FilterTabs`, hoặc `tabClass` + `TabCount` cho tab của drawer | Tab tự style |
| Trạng thái | `Pill` | Chấm tròn, pill tự viết |
| Icon trong ô màu | `IconTile` | |
| Đầu bảng | `TABLE_HEAD_CELL` | |
| Nút chính | `Button` mặc định (xanh dương trong admin) | Đổi màu nút tại chỗ |
| Logo | `ui/Logo.tsx`; nền tối dùng `onDark` (bản chữ trắng, sóng sáng) | Đặt logo lên nền trắng, tự đổi màu |

## Màu theo khu vực

| Khu vực | Màu | Icon |
| --- | --- | --- |
| Tổng quan | blue | layout |
| Tin tuyển dụng | orange | briefcase |
| Hồ sơ ứng viên | sky | inbox |
| Sếp duyệt | green | checkSquare |
| Tin tức | rose | newspaper |
| Mẫu tin | teal | fileText |
| Mẫu thư | amber | mail |
| Tài khoản HR | slate | users |

## Màu theo trạng thái

- **Hồ sơ:** Mới sky, Đã xem slate, Hẹn phỏng vấn orange, Chưa phù hợp rose.
- **Chấm CV:** Đạt green, Không đạt red, Không chấm slate.
- **Tin tuyển dụng:** Đang tuyển green, Sắp hết hạn và Bản nháp amber, Hết hạn rose, Đã đóng slate.
- **Liên hệ:** Gọi green, Zalo blue, Soạn thư amber, Xem CV teal, Xoá red.

## Tổng quan

- Lịch hẹn phỏng vấn: FullCalendar giao diện Forma xanh, mở ở tháng hiện tại, mỗi người hiện giờ và tên (cam: sắp tới, xám:
  đã qua). Điện thoại: danh sách có ô ngày. Người chưa có giờ hiện đủ tên bên dưới, mọi người đang hẹn đều có mặt.

## Biểu đồ

- Biểu đồ đường theo nguồn dùng 6 màu cố định ở `dashboard/sourceSeries.ts`, đã qua kiểm tra mù màu (ΔE 13,5).
- Màu đi theo nguồn, không theo thứ hạng. Nguồn quá 6 màu gom vào "Khác".
- Luôn có chú thích kèm tổng số; rê chuột hoặc dùng phím trái, phải để xem từng ngày.

## Kiểm tra khi thêm màn hình mới

- Chữ thường đạt tương phản từ 4,5:1, chữ lớn từ 3:1.
- Chụp ở 1680, 1440 và 390 px; không tràn ngang, không có khoảng trống lớn.

## Giới hạn

- Logo SVG được dựng lại theo ảnh logo: 3 dải sóng vẽ tay, chữ dùng nét Times New Roman. Có file gốc của công ty (AI, SVG)
  thì thay vào `src/assets/logo`. Thư gửi ứng viên vẫn dùng ảnh PNG cũ vì Outlook không hiện SVG.
