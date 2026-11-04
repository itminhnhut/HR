# Spec: Kết quả sau phỏng vấn, lý do loại, hiệu quả nguồn, báo cáo theo ngày

## 1. Problem

Web chỉ ghi tới "Hẹn phỏng vấn". Không biết ai đậu, vì sao loại, nguồn nào tuyển được người. Hai biểu đồ ở Tổng quan cố định
30 ngày, không chọn được khoảng khác.

## 2. Requirements

- **Trạng thái mới:** "Đạt, chờ nhận việc" và "Đã nhận việc". Chỉ ghi được khi hồ sơ đã có giờ phỏng vấn; giữ lại ngày phỏng vấn.
- **"Chờ kết quả":** không phải trạng thái, tự suy ra khi giờ hẹn đã qua. Có tab riêng, có nhắc ở Tổng quan.
- **Lý do loại:** bắt buộc một lý do khi chuyển "Chưa phù hợp", "Khác" phải ghi rõ. Chỉ dùng nội bộ, không hiện cho ứng viên, không
  đưa vào thư. Cố ý không có tuổi, giới tính, hôn nhân, sức khoẻ. Hồ sơ loại từ trước để trống, không bắt nhập lại.
- **Ứng viên thấy:** "Đạt" vẫn là "Mời phỏng vấn" (HR báo trước); "Đã nhận việc" có nhãn riêng; lý do không bao giờ hiện.
- **Báo cáo:** nút hiện khoảng ngày, mở danh sách chọn nhanh và lịch 2 tháng (tối đa 366 ngày), áp dụng cho cả 3 báo cáo. Hiệu quả nguồn tính hồ sơ nộp
  trong khoảng đã chọn, theo bước xa nhất từng đạt; chỉ hiện % khi nguồn có từ 30 hồ sơ.
- **Dòng hồ sơ:** tên + giới tính, tuổi có icon + %; vị trí (bỏ phần ngoặc ở cuối) + ngày nộp ngắn; nhãn. Giới tính, tuổi chỉ lấy đúng theo CV, không đoán theo tên, không lọc, không tính vào %.

**Out of scope:** quản lý từng vòng phỏng vấn, thư mời nhận việc, chi phí mỗi nguồn.

- **Không xoá hồ sơ theo 30 ngày** (chủ sản phẩm chốt 04/11): bỏ nút xoá hàng loạt; hồ sơ của tin kết thúc quá 30 ngày có nhãn "Hết hạn". Xoá
  từng hồ sơ khi ứng viên yêu cầu vẫn giữ. Trang Chính sách đổi thành "lưu đến khi bạn yêu cầu xóa", `POLICY_VERSION` đổi theo.
- **Thêm hồ sơ không cần tích xác nhận đồng ý** (chủ sản phẩm chốt 04/11). Bản ghi không còn ghi người xác nhận, `policyVersion` là
  `hr-added`, để không tự nhận là đã có đồng ý.
- **So sánh tin:** chọn nhiều tin (tối đa 6, theo số màu), mỗi tin một cột, một màu. Số của từng ngày chỉ hiện khi rê chuột.

## 3. Approach

- Bảng `application_status_log`: mỗi bước một dòng, không có tên, SĐT, email và không có khoá ngoại tới hồ sơ. Xoá hồ sơ thì số thống
  kê vẫn còn; id còn lại không trỏ tới đâu.
- "Hoàn tác" xoá dòng log vừa ghi, nên bấm nhầm không làm sai số.
- Migration `0019` thêm giá trị enum, bảng log, và ghi lại những gì đã biết của hồ sơ cũ (ngày nộp, đã hẹn, đã loại). Hồ sơ cũ không có
  lịch sử chi tiết hơn. Migration không dùng giá trị enum mới vì Postgres cấm dùng trong cùng transaction.

## 4. Test

`routes/hr-outcomes.test.ts`, `applicants/OutcomeActions.test.tsx`, `dashboard/PeriodPicker.test.tsx`.

## 5. Trước khi deploy

- Backup Neon rồi chạy migration.
- Nhờ luật sư xem: lưu hồ sơ không thời hạn (ứng viên cũ đã đồng ý với mốc 30 ngày), thêm hồ sơ không xác nhận đồng ý, đọc giới tính và tuổi từ CV.
