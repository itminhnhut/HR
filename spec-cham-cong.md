# Chấm công

Thay file Excel chấm công của HR. HR chỉ nhập ngoại lệ, tải Excel cùng bố cục khi sếp cần.

## Địa chỉ

- `/hr/cham-cong`: bảng công, `?ky=YYYY-MM` là kỳ chính thức, `?tu&den` là khoảng ngày tự chọn
- `/hr/cham-cong/nhan-vien`: nhân viên
- `/hr/cham-cong/cai-dat`: khu vực, ngày lễ

## Quy tắc tính (`packages/shared/src/timesheet.ts`)

- Kỳ: 26 tháng trước → 25 tháng này. Khoảng tự chọn tối đa 31 ngày, chỉ xem và tải.
- T2–T6 trong thời gian làm việc, đến hôm nay: máy tự chấm `1`. T7, CN: HR điền. Ngày lễ: tự `NL`.
- Mã: `1, M, P, P/2, KL, KL/2, NL, KP`.
- Công thực tế = 1 + M + 0,5 × (P/2 + KL/2).
- Công xét phép = 1 + M + P + P/2 + 0,5 × KL/2.
- Phép có = thử việc → 0, còn lại tồn đầu + 1 nếu công xét phép ≥ 14.
- Phép trả = MIN(nghỉ phép, phép có). Tồn cuối = phép có − phép trả.
- Tổng = thực tế + phép trả + lễ. Hưởng lương = MIN(tổng, chuẩn) + điều chỉnh, không âm. OT = MAX(0, tổng − chuẩn).
- Công chuẩn gợi ý = T2–T6 của kỳ + số thứ Bảy của khu vực, HR sửa được theo từng kỳ.

## Chốt kỳ

- Chỉ chốt được khi kỳ đã hết (từ ngày 25), và theo thứ tự.
- Chốt lưu lại tên, bộ phận, khu vực và phép cuối kỳ. Đổi thông tin nhân viên sau đó không làm đổi kỳ đã chốt.
- Chỉ mở lại được kỳ chốt gần nhất, phải có lý do.
- Mọi thay đổi ghi vào nhật ký kỳ.

## Chưa có trong phiên bản này

- Phạt tiền: không làm. Chỉ có ghi chú và điều chỉnh công có lý do. Cần luật sư xem Đ.127 BLLĐ 2019.

## Cần luật sư xác nhận

Phép thử việc, ngưỡng 14 công, OT gộp phép và lễ, trừ 0,5 công, nội quy, kỳ 26–25.
