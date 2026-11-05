# Chấm công

Thay file Excel chấm công của HR. HR chỉ nhập ngoại lệ, tải Excel cùng bố cục khi sếp cần.

## Địa chỉ

- `/hr/cham-cong`: bảng công, `?ky=YYYY-MM` là kỳ chính thức, `?tu&den` là khoảng ngày tự chọn
- `/hr/cham-cong/nhan-vien`: nhân viên
- `/hr/cham-cong/nghi`: nghỉ, đi muộn
- `/hr/cham-cong/nhat-ky`: nhật ký mọi thao tác
- `/hr/cham-cong/cau-hinh?muc=bo-phan|loai-nv|khu-vuc|ngay-le|ly-do|nguoi-duyet`: cấu hình; địa chỉ cũ `/cai-dat` vẫn mở

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

- Chỉ chốt được khi kỳ đã hết (từ ngày 25), và theo thứ tự, không bỏ qua tháng nào.
- Kỳ đầu tiên là tháng sớm nhất HR đã nhập ô. Chỉ xem một tháng cũ thì không bắt chốt tháng đó.
- Chốt lưu lại tên, bộ phận, khu vực, loại nhân viên, phép, ngày lễ và tên khu vực. Đổi về sau không làm đổi kỳ đã chốt.
- Chỉ mở lại được kỳ chốt gần nhất, phải có lý do. Kỳ mở lại vẫn giữ thông tin người như lúc chốt, nhưng lấy ngày lễ mới nhất.
- Mọi thay đổi ghi vào nhật ký kỳ.

## Nghỉ

- Tab Nghỉ, đi muộn: nhập người, ngày, lý do, người duyệt, bàn giao, ghi chú. Có người duyệt thì tự điền T2–T6 qua nhiều kỳ; chưa có thì chờ, bảng công chưa đổi. Sửa, huỷ được, nhật ký ghi trước → sau. Đi muộn lưu là chấm M, không cần duyệt. HR tự thêm lý do và chọn cách tính. Chọn lý do thì tự điền sẵn cách tính, số ngày, từ ngày, đến ngày; HR đổi được trên dòng đang nhập. Người duyệt chọn từ danh sách HR đặt sẵn, gõ tên mới cũng được. Lý do và người duyệt cấu hình ở drawer mở từ tab này (`?cau-hinh=1`).
- CL: cưới, tang theo Đ.115 k1, có lương, không trừ phép. TS, OM: BHXH trả, không tính công, vẫn tính để cộng phép (NĐ 145 Đ.65). Tang và cưới của người thân theo Đ.115 k2: KL.
- Lễ: tự NL. Rơi vào CN thì nghỉ bù ngày làm việc kế tiếp (Đ.111 k3). Đợt nghỉ dài nhập theo khoảng ngày, bỏ CN trong đợt.
- Đi làm ngày lễ hoặc CN: tính 1 công như thường, có cột riêng và cảnh báo trong Rà soát, tiền làm lễ tính ngoài (Đ.98).
- Cột mới trên bảng và file Excel chỉ hiện ở tháng có người dùng.

## Quyết định tạm, chờ công ty xác nhận

- Web là bảng công, chưa tính tiền lương.
- Thử việc: chỉ hiện số công từng mức trong Rà soát, không tính %, không cộng bù phép.
- T7 là ngày làm việc, lễ rơi vào T7 thay 1 T7 định mức, OT chỉ do lễ thì cảnh báo.
- Phép không ứng, cuối năm giữ nguyên. Nghỉ không lương dài qua lễ vẫn NL.
- Trả phép theo số T10: người có phép đầu 0,5 nghỉ 3 ngày, đủ 14 công, được trả 1,5 ngày. Công thức ô AS của T11 khác, có vẻ sai.

## Chưa có trong phiên bản này

- Phạt tiền: không làm. Chỉ có ghi chú và điều chỉnh công có lý do. Cần luật sư xem Đ.127 BLLĐ 2019.

## Cần luật sư xác nhận

Phép thử việc, ngưỡng 14 công, OT gộp phép và lễ, trừ 0,5 công, nội quy, kỳ 26–25.

## Cấu hình và liên kết

- Bộ phận, loại nhân viên, khu vực nằm trong database. Thêm hoặc sửa thì bộ lọc, form nhân viên và bảng công đổi ngay.
- Đổi tên bộ phận, khu vực, loại: mọi người trong đó theo tên mới; kỳ đã chốt giữ tên lúc chốt.
- Chỉ xoá được mục không còn ai. Hai loại mặc định (Chính thức, Thử việc) chỉ đổi tên, không xoá, không đổi cách tính phép.
- Mỗi loại tính phép theo một trong hai cách của bảng công: như chính thức hoặc như thử việc.
- Số người của mỗi loại đếm theo loại đang hiện hôm nay: người chưa chọn loại tính vào loại mặc định, người đã qua ngày chính thức tính vào Chính thức.
- Mọi thay đổi ghi nhật ký.

## Hiển thị

- Cột chữ của bảng công rộng theo chữ dài nhất, không cắt.
- Mã, tên, số tổng, phép và công hưởng lương có nút sao chép khi rê chuột.
- Rê chuột vào dòng nào thì cả dòng sáng lên, kể cả cột tổng và cột đứng yên. Bấm vào thì dòng đó giữ viền xanh để dò ngang.

## Nhật ký

- Một tab duy nhất `/hr/cham-cong/nhat-ky`, hiện thẳng trên trang. Lọc theo nơi thao tác `?nhom=bang-cong|nghi|nhan-vien|cau-hinh`, tìm `?tim=`, xem thêm từng 100 dòng.
- Mọi thao tác thêm, sửa, xoá bên trong tab đều ghi: ai, lúc nào, làm gì. Bấm chuyển tab, mở màn hình, xuất Excel không ghi.
- Lần sửa ghi cũ → mới từng trường. Lưu mà không đổi gì thì không ghi. Một thay đổi chạm nhiều kỳ chỉ hiện một dòng.
- Bộ phận hoặc người duyệt gõ mới ngay trên form cũng được ghi.
