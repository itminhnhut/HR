# Spec: Lương

Trạng thái: **chờ HR duyệt**. Bản 08/11/2026, chốt mục 17; sửa 10/11: % KPI theo khối (5.3), KPCĐ mặc định tắt (D03), BHYT tháng HĐ đóng BH bắt đầu (5.4); sửa 11/11 theo code đã làm: khối đọc từ nhân viên khi bản chốt chưa có (10.1), cộng dồn năm thuế (R9), tiền phép chưa nghỉ (5.5), truy lĩnh / truy thu tự động (R6), Tổng quan và liên kết (11.x). Danh mục test: `docs/test-cases-luong.md`.
Người trong spec và test chỉ ghi bằng tên giả (NV A, NV B…). Mọi số tiền là số minh hoạ, không lấy từ file của HR.

## 0. Đọc nhanh

- Lương lấy ngày công từ **bản chốt Chấm công**, HR chỉ gõ những gì Chấm công không có (KPI, giờ làm thêm, thu nhập khác, hỗ trợ, tạm ứng).
- Mọi giá trị có **mặc định**, sửa được **cho tất cả hoặc cho một người**, có **từ tháng**. Tháng nào dùng cấu hình của tháng đó, kể cả khi tải lại Excel sau này.
- Nháp → Rà soát → Duyệt (lần N) → Đã chuyển khoản. Tháng đã duyệt chỉ đọc. Sửa sau duyệt: mở lại (khi chưa chuyển khoản) hoặc truy lĩnh / truy thu ở tháng sau.
- Làm **engine tính thuần** ở `packages/shared` trước, test với **bộ vàng ẩn danh** dựng theo file T10 của HR, rồi mới làm API và màn hình.
- 35 điểm luật và nghiệp vụ đã chốt ở mục 17, mỗi điểm dựa trên văn bản luật, file T10 của HR hoặc quyết định của chủ dự án, kèm khoá cấu hình. Không còn câu hỏi cho chủ dự án. Còn 5 mục kế toán ký xác nhận (17.3), web đã chạy theo mặc định ghi ở đó.

## 1. Vấn đề

HR tính lương bằng một file Excel 53 cột, nhóm A (định mức) → H (chuyển khoản), 12 người ở T10/2026. Mỗi tháng gõ lại ngày công từ bảng công, gõ tay KPI, phụ cấp, bảo hiểm, thuế. Rà file T10:

| Điều thấy trong file | Bằng chứng |
|---|---|
| Cột "Ngày công thực tế" khớp 12/12 với cột **Hưởng lương** của Chấm công trên web, nên lấy thẳng được | So theo người, không theo chuỗi mã (một mã trong file gõ thừa số 0) |
| % KPI là ô gõ ở cả 12 dòng. Soát từng ô (10/11): khối BO bằng đúng *công ÷ chuẩn*, × 90% ở ngày thử việc (thử việc 15/22 → 61,36%; 19,5/22 → 79,77%, khớp tới số lẻ), chính thức đủ công → 100%. Khối KD là số HR đánh giá (0%, 80%, 100%), không theo công, cả thử việc lẫn chính thức | Màu ô trên PDF, tính lại |
| Gross thoả thuận thiếu KPI ở 4 dòng, công thức khác nhau giữa các dòng | Tính lại |
| Một dòng có khoản cộng vào Thu nhập thực tế không đến từ cột nào. File không ghi lý do | Tính lại |
| Làm tròn không theo một quy tắc: cột (33) làm tròn trong công thức, dòng tổng = làm tròn của tổng chưa tròn | Tính lại |
| Không có KPCĐ 2% | Cột (46) trống |
| Khoản ở cột (32) của 2 dòng cộng vào thực nhận, không vào thu nhập chịu thuế, không vào tổng chi phí. File **không ghi** đó là khoản gì | Tính lại |
| Cột "Xăng xe + ĐT" miễn thuế cả hai. NĐ 253/2026 Đ.8 k2 đ chỉ miễn phần khoán văn phòng phẩm, công tác phí, điện thoại, trang phục trong mức được trừ khi tính thuế TNDN; xăng xe trả cố định không có trong danh mục loại trừ nên chịu thuế (Đ.8 k3) | Công báo số 402 ngày 16/07/2026; web vẫn giữ như file: một khoản, miễn toàn bộ (17.3 K2, chốt 09/11/2026) |
| Chuyên cần chia theo ngày như lương, không vào lương đóng BH (lương đóng BH = lương thời gian ở mọi người chính thức) | Tính lại; web giữ như file (câu 16, K3 chốt 09/11/2026) |
| File không có ngày vào, ngày nghỉ, ngày chính thức, ngày chi trả. Các ngày đang có trên web do người nhập suy ra từ ô cuối có số | PDF, CSV, nhật ký Chấm công |

Kiểm lại cách hiểu: một script trên máy (không commit) dựng engine ở chế độ "như file HR" (mục 5.7, 5.9) và tái tạo được **228/228 ô số** của file T10 (12 người × 19 cột, lệch không quá 1 đồng). Vậy công thức ở mục 5 hiểu đúng file; chỗ khác file là chỗ cố ý sửa.

Ngoài ra: ai đăng nhập HR cũng xem được mọi trang. Lương thì không được như vậy.

## 2. Phạm vi

**Must have**

1. **Quyền Lương.** Hai quyền: *Xem, sửa lương* và *Duyệt lương*. Không có quyền thì không thấy menu, trang; API trả 403 không kèm số. Nhật ký lương nằm ở bảng riêng.
2. **Cấu hình có phiên bản, mặc định, ghi đè từng người** (mục 6): khoản lương, tham số luật, quy tắc, loại hợp đồng, tuỳ chọn D01–D12.
3. **Hồ sơ lương** theo ngày hiệu lực: mức từng khoản, loại HĐ, số ngày thử việc, người phụ thuộc (từ tháng, đến tháng), cam kết thuế (ngày ký, năm), đoàn viên, khoản (32) định kỳ, ngân hàng, số tài khoản (mã hoá), email nhận phiếu. Danh sách kiểm trước tháng lương đầu (17.2).
4. **Bảng lương tháng** cùng kỳ Chấm công (26 → 25), lấy công từ bản chốt, ô HR gõ, gõ đè có lý do, Tính lại.
5. **Rà soát** trước khi duyệt (mục 11.3). Cảnh báo, không chặn, trừ chỗ luật hoặc dữ liệu bắt buộc (mục 4.8).
6. **Duyệt, Mở lại, Đã chuyển khoản, Truy lĩnh / truy thu**, mỗi việc có hộp thoại riêng (mục 11.4).
7. **Excel**: tải 1 tháng, nhiều tháng, cả năm; nhập theo đúng cột của file HR (mục 12).
8. **Phiếu lương**: chọn nhiều người, xem, tải Excel, in.
9. **Tổng quan** theo tháng và theo năm, mỗi số ghi rõ *Đã duyệt*, *Nháp* hay *Dự tính*.
10. **Nhật ký**: một tab, mọi thêm, sửa, xoá, duyệt, mở lại, tải, xem phiếu, hiện số tài khoản.
11. **Số dư đầu năm** cho tháng đầu chạy trên web: thu nhập chịu thuế, thuế đã khấu trừ, giờ làm thêm năm, trang phục đã trả, số tháng đã trả, tính theo ngày chi trong năm thuế (câu 34).

**Out of scope** (spec sau): gửi phiếu qua email; file chuyển khoản theo mẫu ngân hàng; thưởng tháng 13 (chỉ chừa chỗ); quyết toán thuế năm và tờ khai BHXH, thuế; xác thực 2 bước; tài khoản nhân viên tự xem lương.

## 3. Quyết định cố định của chủ dự án

Áp dụng ở mọi màn. Mỗi dòng có test ở mục L của danh mục.

| # | Quyết định | Làm thế nào | Ở đâu |
|---|---|---|---|
| Q1 | Mọi giá trị cấu hình được, có mặc định, ghi đè cho một người hoặc cho tất cả | Mỗi dòng cấu hình có *phạm vi* (Tất cả / một người) và *từ tháng* | 6 |
| Q2 | Không có ô chọn "Tự động / Thủ công" | Ô luôn hiện số tính ra; HR gõ đè thì có dấu và lý do; "Bỏ gõ đè" về lại số tính | 6.3 |
| Q3 | Excel của tháng nào dùng cấu hình của tháng đó, không bao giờ bản mới nhất | Tháng đã duyệt đọc bản chụp; nháp lấy phiên bản theo ngày tham chiếu của tháng | 7 (R2, R4, R8) |
| Q4 | Khối ký tên chỉ có trong file Excel | Web và bản in phiếu không có khối ký tên | 12.1 |
| Q5 | Nút sao chép khi rê chuột vào số | Dùng lại `CopyValue` của Chấm công cho mọi ô tiền, mã, tên, STK (4 số cuối) | 11.2 |
| Q6 | Số nối về cấu hình của nó | Tooltip của ô có liên kết "Mở cấu hình" tới đúng phiên bản đã dùng | 11.2 |
| Q7 | Tooltip công thức bằng số thật | Vd "(18) = (6.400.000 + 1.100.000 + 450.000 + 1.000.000) × 90% ÷ 22 = 366.136" | 11.2 |
| Q8 | Tổng quan theo tháng và theo năm | Chọn năm, xem 12 tháng; bấm một tháng xem chi tiết | 11.8 |
| Q9 | Tải một hoặc nhiều tháng, nhiều phiếu | Hộp tải chung cho Bảng lương, Tổng quan, Phiếu lương | 12 |

## 4. Bài học từ Chấm công

Chấm công phải sửa nhiều lần vì những điểm dưới đây chỉ được thêm sau khi chủ dự án hỏi lại. Lương làm đủ ngay từ bản đầu. Mỗi dòng có test ở mục L.

| # | Yêu cầu | Lương làm thế nào |
|---|---|---|
| 4.1 | **Lọc ở mọi danh sách** | Thanh lọc chung trên Bảng lương, Hồ sơ, Phiếu, Nhật ký, Tổng quan: Kỳ (mặc định kỳ hiện tại), Nhân viên, Bộ phận, Khối, Khu vực, Trạng thái, ô Tìm. Bộ lọc nằm trên địa chỉ (`?ky=2026-11&kv=…&tim=…`), dán link mở đúng chỗ. Có nút Xoá lọc; không có kết quả thì nói rõ và có nút xoá tìm |
| 4.2 | **Thêm, sửa, xoá đủ ở mọi nơi**, ghi vào **một** tab Nhật ký | Mỗi đối tượng (khoản, tham số, quy tắc, loại HĐ, hồ sơ, ô tháng, truy lĩnh) có đủ thêm, sửa, xoá hoặc "Ngừng từ tháng" khi đã dùng (R5). Nhật ký ghi icon, câu thường, cũ → mới từng trường, ai, lúc nào (có năm), mã người. Chuyển tab, mở màn không ghi. Nhật ký là tab, không mở modal |
| 4.3 | **Gọn, có nhóm, không tràn, không rớt một nút xuống dòng** | Nút gom theo nhóm (Tính, Duyệt, Tải); nút ít dùng vào menu "Thêm". Kiểm ở 1440, 1280 và 390 px: không tràn ngang trang, không nút nào xuống dòng một mình, chữ không nhỏ hơn 12 px, ô bấm từ 24 px |
| 4.4 | **Dòng nào cũng bấm được về nguồn** | Dòng lương → ô của người đó ở Bảng công (`/hr/cham-cong?ky=…&nv=…`); ô tính → cấu hình đã dùng; dòng nhật ký → đối tượng; dòng Rà soát → ô lỗi; dòng Tổng quan → tháng đó; ô Khối và dòng Rà soát "Thiếu khối" → form người đó ở `/hr/cham-cong/nhan-vien?nv=<id>` (11.3) |
| 4.5 | **Kỳ đã chốt, đã duyệt chỉ đọc**, mở lại rõ ràng, giữ số của chính nó | Dải khoá "Đã duyệt lần N, chỉ xem" như Chấm công; nút Mở lại có hộp lý do; tháng đã duyệt đọc bản chụp, không tính lại |
| 4.6 | **Ghi đè từng người hiện ngay trên dòng** | Ô có ghi đè có dấu chấm màu và tooltip "Riêng NV A từ T12: …"; cột Mã có icon nếu người đó có cấu hình riêng; Hồ sơ có bộ lọc "Có cấu hình riêng" |
| 4.7 | **Mặc định chọn sẵn** | Kỳ hiện tại; người duyệt = HR đang đăng nhập (có quyền Duyệt); người lập biểu = HR đang đăng nhập; ngày chi trả ngày 05 tháng sau; ngày chuyển khoản = ngày chi trả |
| 4.8 | **Cảnh báo thay vì chặn** khi luật không bắt chặn | Chỉ chặn: không có quyền; dưới mức luật (tỷ lệ thử việc < 85%, hệ số làm thêm dưới luật); dữ liệu không xác định được (hai phiên bản cùng ngày, sửa bản chụp đã duyệt, kỳ công chưa chốt); mở lại tháng đã chuyển khoản; người lập tự duyệt khi công ty đặt D14 = không được. Còn lại là cảnh báo, mức đỏ thì Duyệt phải tích "Đã xem" |
| 4.9 | **Rà soát trước khi duyệt** | Nút Rà soát luôn có, cả ở tháng đã duyệt (chỉ xem). Duyệt mở Rà soát trước nếu còn cảnh báo |
| 4.10 | **Điện thoại** | Mục 11.10 |
| 4.11 | **Nhập, xuất Excel đúng cột file HR** | Mục 12 |
| 4.12 | **Test case BA viết trước code, chạy đỏ trước** | Mỗi bước ở mục 15 bắt đầu bằng test lấy từ danh mục, chạy đỏ, rồi mới viết code |

Các điểm khác rút từ code và review Chấm công:

| # | Điểm | Lương làm thế nào |
|---|---|---|
| 4.13 | Xem một tháng (GET) từng tạo dòng trong DB | Xem bảng lương không ghi gì. `payroll_periods` khoá theo (năm, tháng), chỉ tạo khi HR gõ hoặc tính |
| 4.14 | Đếm người lẫn người đã nghỉ | Mọi số đếm tách "đang làm / đã nghỉ trong kỳ" |
| 4.15 | Nhật ký thiếu mã người, thiếu năm | Mọi dòng có mã và tên người, ngày dạng dd/mm/yyyy |
| 4.16 | Đỏ dùng cho quá nhiều thứ | Đỏ chỉ cho lỗi và cảnh báo đỏ. Trạng thái dùng màu riêng: Nháp xám, Đã duyệt xanh lá, Đã chuyển khoản xanh dương, Chờ chốt công vàng |
| 4.17 | Trạng thái lỗi, rỗng không giải thích | `?ky` sai thì nói khoảng hợp lệ; tháng chưa chốt công nói "Chờ chốt công, gõ trước KPI và tạm ứng được"; tháng tương lai nói "Dự tính" |
| 4.18 | Nối theo chuỗi mã làm rơi người (mã gõ thừa số 0) | Nối theo `employee_id`. Nhập Excel mà mã không khớp thì gợi ý người gần giống, không tự nối |
| 4.19 | Chốt lại xoá bản chốt cũ | Lương trỏ tới một **lần chốt** bất biến, có mã từng ngày (mục 10.1) |
| 4.20 | Ngày vào, nghỉ, chính thức do người nhập suy ra | Rà soát cảnh báo khi ngày dùng để tách đoạn, tính BH hay 10% chưa được HR xác nhận |
| 4.21 | Kỳ T10 do script chốt dưới tên HR | Tháng lương đầu tiên nhắc HR xác nhận lại lần chốt kỳ công |
| 4.22 | Cả dòng sáng khi rê, dòng đã bấm giữ viền; dòng cuối không bị thanh cuộn che; chữ của băng nhóm bám cột đứng yên | Dùng lại lưới và cách làm của Bảng công |
| 4.23 | Hai người cùng sửa | Bảng có số phiên bản; người lưu sau nhận "Bảng đã đổi bởi … lúc …, tải lại" |

## 5. Công thức

### 5.1 Đầu vào từ Chấm công

| Lương cần | Chấm công hôm nay (nhánh `main`) | Phải thêm |
|---|---|---|
| (17) Công hưởng lương | `totals.paid` của bản chốt | – |
| Công chuẩn | `snapshot.norm` | – |
| Làm Chủ nhật, làm lễ | `totals.sundayWorked`, `totals.holidayWorked` (lưu lúc chốt) | – |
| OT ngày | `totals.overtime` | – |
| Thai sản, ốm, không lương, phép vượt | `totals.maternity`, `sick`, `unpaidLeave`, `leaveOverdrawn` (theo kỳ 26 → 25) | Số theo **tháng dương lịch** cho quy tắc BH: dựng từ mã từng ngày của lần chốt |
| Phép còn khi nghỉ việc | `snapshot.leaveClosing` | – |
| Tách đoạn khi lên chính thức | `paidBySegment` trong `packages/shared/src/timesheet.ts` | Ngày chính thức trong bản chốt |
| Ngày vào, nghỉ | `snapshot.joinedOn`, `leftOn` | Cờ "HR đã xác nhận" |
| Loại NV, khối | `staffLabel` dạng chữ; chưa có khối | `staff_kind_id`, khối trong bản chốt |
| Lần chốt, mã từng ngày | Chốt lại thì xoá bản cũ; mã ngày không lưu | `timesheet_closings`, `timesheet_closing_rows` (10.1) |

Giờ làm thêm ngày thường: Chấm công không có, HR gõ.

### 5.2 Ký hiệu

`TV` = tỷ lệ thử việc (mặc định 90%) nếu đang thử việc, 100% nếu chính thức; nhân theo **từng khoản** có bật "× tỷ lệ thử việc". `Chuẩn` = công chuẩn của kỳ. `Ngày` = (17).

### 5.3 Công thức từng cột

Số cột theo file HR. Cột (11) "Xăng xe + ĐT" là một khoản như file (17.3 K2); công ty trả riêng thì tách thành (11a) Xăng xe và (11b) Điện thoại (câu 3, mục 17).

| Cột | Công thức |
|---|---|
| (16) Gross thoả thuận | Σ mức các khoản + KPI 100%. Chỉ để xem |
| (18) Lương 1 ngày | Σ(khoản *chia theo ngày* × TV của khoản) ÷ Chuẩn. Giữ số đầy đủ |
| Khoản cố định | Khoản tắt "chia theo ngày": trả đủ × TV của khoản (D11) |
| (19) % KPI | HR gõ thì lấy số gõ. Chưa gõ thì theo khối của người đó (quy tắc "% KPI theo khối", ghi đè cho tất cả hoặc từng người): **khối BO** = Σ(Ngày × tỷ lệ) ÷ Chuẩn, tỷ lệ TV ở ngày thử việc, 100% ở ngày chính thức (BO chính thức thiếu công: mặc định, chưa có dữ liệu thực tế xác nhận); **khối KD** và người chưa có khối = HR gõ, chưa gõ thì 0% và Rà soát đỏ "Chưa gõ % KPI". Tháng có tách đoạn: D06 |
| (20) Thưởng hiệu suất | KPI × (19) |
| (25) Tiền làm thêm | Giờ ngày thường × (18) ÷ giờ một ngày × 150% + Công ngày nghỉ ngoài (17) × (18) × 200% + Công CN đã nằm trong (17) × (18) × 100% (D12) + Công ngày lễ × (18) × 300%. (18) ở đây chỉ gồm khoản bật "vào lương làm thêm" (mặc định mọi khoản chia theo ngày) |
| (26) Thu nhập thực tế | Tròn((18) × Ngày + khoản cố định) + (20) + (24) + (25) |
| (27) Lương đóng BHXH, BHYT | Σ khoản *tính BH*, kẹp trong [lương tối thiểu vùng, 20 × lương cơ sở]. Hiện cả khi tháng chỉ đóng BHYT |
| Lương đóng BHTN | Σ khoản *tính BH*, kẹp trong [lương tối thiểu vùng, 20 × lương tối thiểu vùng]. Không có cột riêng, hiện ở tooltip (30) |
| (28) (29) (30) | 8% × (27) / 1,5% × (27) / 1% × lương đóng BHTN, theo trạng thái BH của tháng (5.4) |
| (31) Đoàn phí | 0,5% × (27) nếu là đoàn viên và tháng có đóng BHXH |
| (32) Hỗ trợ / Hoàn ứng / Tạm ứng | Hỗ trợ + Hoàn ứng − Tạm ứng. Ba ô gõ riêng, điền sẵn từ khoản (32) định kỳ của hồ sơ; khoản không chọn loại là Hỗ trợ (câu 4); chi tiết ghi ở cột Ghi chú. **Thêm 10/11/2026:** khoản định kỳ loại "Công ty trả thay BH" không gõ số tiền, mỗi tháng tự cộng = (28) + (29) + (30) của tháng đó; mặc định không tính thuế, không vào (34), (48) như file T10; bật "Tính thuế" thì như Hỗ trợ |
| (33) Miễn thuế | Phần đã trả của khoản miễn thuế (khoản chia theo ngày: mức × TV × Ngày ÷ Chuẩn), mỗi khoản không quá trần của nó (cơm: trần tiền ăn tháng; điện thoại: mức ghi trong HĐLĐ / quy chế; trang phục: phần còn lại của trần năm) + tiền làm thêm trong giới hạn giờ, gồm cả phần 100% của công CN đã nằm trong (17) (D05, D12) + thu nhập khác đánh dấu miễn thuế + tiền phép chưa nghỉ trong mức luật (D08) |
| (34) Chịu thuế | (26) + Hỗ trợ − (33) |
| (37) Giảm trừ BH | (28) + (29) + (30) |
| (38) Tính thuế | MAX(0, (34) − giảm trừ bản thân − NPT × giảm trừ NPT − (37)) |
| (40) Thuế | Theo cách thuế của tháng: *lũy tiến* 5 bậc trên (38); *10%* × cơ sở D02 (mặc định (26) + Hỗ trợ) khi cơ sở từ ngưỡng (D02, D10); *không khấu trừ* khi có cam kết (D09): cam kết ký riêng trong hồ sơ, hoặc cam kết kèm hợp đồng của loại HĐ (mục 17.1 câu 10, đổi 10/11/2026); công thức ô ghi rõ "Cam kết theo hợp đồng" / "Cam kết ký ngày …" / "khấu trừ 10%" |
| (41) Tổng khấu trừ | (28) + (29) + (30) + (31) + (40) |
| (42) Thực nhận | (26) − (41) + (32) |
| (43) (44) (45) (46) | 17,5% × (27) / 3% × (27) / 1% × lương đóng BHTN / KPCĐ 2% × (27) khi bật D03 (mặc định tắt), theo trạng thái BH |
| (47) | (43) + (44) + (45) + (46) |
| (48) Tổng chi phí | (26) + Hỗ trợ + (47). Hoàn ứng, tạm ứng không phải chi phí lương |

- **Làm lễ**: lấy `holidayWorked` của bản chốt. Ngày lễ đã nằm trong (17); (25) cộng thêm 300%, tổng 400% (BLLĐ Đ.98). **Không** lấy MIN với OT, vì OT bằng 0 với người đi làm đủ.
- **Làm Chủ nhật** (D12): mỗi công CN được trả tổng 200% (BLLĐ Đ.98 k1 b; Đ.107 k1, Đ.111 k2: CN là ngày nghỉ hằng tuần theo nội quy, làm ngày đó là làm thêm; không có điều nào cho bù với ngày thường đã nghỉ). Điền sẵn: công ngày nghỉ ngoài (17) = MIN(`sundayWorked`, OT ngày), trả 200%; công CN đã nằm trong (17) = `sundayWorked` − số đó, cộng thêm 100%. HR gõ đè được; Rà soát báo "CN bù ngày thường". Cả hai loại tính vào giờ làm thêm (D05).
- **OT do thứ Bảy thừa, phép, lễ**: không tự thành tiền. Rà soát báo "OT 1 ngày chưa có giờ làm thêm".
- **Rà soát lương đóng BH dưới sàn** kiểm Σ khoản tính BH **trước** khi kẹp.
- **Đoàn phí** không cần trần riêng: (27) ≤ 20 × lương cơ sở nên 0,5% × (27) luôn ≤ 10% lương cơ sở.

### 5.4 Bảo hiểm theo tháng dương lịch

Tháng BH của tháng lương T là tháng dương lịch T (Luật BHXH 2024 Đ.33 k1 b: đóng hằng tháng). "Ngày làm việc" = T2–T6 của tháng (D07). Một cách đếm, hai trường hợp:

**Ngày không hưởng lương** = ngày làm việc trong tháng mà người đó không nhận tiền lương từ công ty theo HĐ đóng BH: KL, KP, phép vượt, ốm (BHXH trả), thai sản, và mọi ngày trước ngày vào, sau ngày nghỉ, hoặc thuộc HĐ không đóng BH (HĐ thử việc riêng).

| Mã | Khi nào | Quy tắc mặc định | Nguồn |
|---|---|---|---|
| BH-1 | Tháng có ngày vào, ngày nghỉ, hoặc đổi sang / khỏi HĐ đóng BH | Ngày không hưởng lương (gồm ngày ngoài HĐ đóng BH) từ 14 trở lên thì không đóng BHXH, BHTN tháng đó; dưới 14 thì đóng đủ | Luật BHXH 2024 Đ.33 k5 đọc theo chữ. Không còn văn bản riêng cho vào, nghỉ giữa tháng (QĐ 595/QĐ-BHXH hết hiệu lực 01/5/2026, QĐ 366/QĐ-BHXH thay thế không có quy tắc này). Kế toán ký xác nhận (17.3) |
| BH-2 | Cả tháng thuộc HĐ đóng BH | Ngày không hưởng lương từ 14 trở lên thì không đóng BHXH, BHTN | Luật BHXH 2024 Đ.33 k5, Đ.34 k3; Luật Việc làm 2025 Đ.33 k4 |

- Ngoại lệ: tháng đầu làm việc hoặc tháng đầu trở lại làm việc mà nghỉ ốm từ 14 ngày thì vẫn đóng BHXH (Đ.33 k6). Hai bên thoả thuận vẫn đóng thì đóng trên căn cứ tháng gần nhất (Đ.33 k5, D15).
- Tháng không đóng BHXH: KPCĐ = 0 (D03, vì KPCĐ tính trên quỹ lương đóng BHXH). BHYT theo D04: ốm hoặc thai sản từ 14 ngày thì BHXH đóng BHYT, bảng lương ghi 0 (Luật BHYT Đ.12 k2 b sửa bởi Luật 51/2024); trường hợp khác vẫn đóng như file T10. Riêng **tháng HĐ đóng BH bắt đầu** (vào làm, hoặc HĐLĐ nối sau HĐ thử việc riêng) mà quy tắc 14 ngày loại BHXH thì không đóng cả BHYT, (27) trống, đóng đủ từ tháng sau: BHYT bằng 4,5% tiền lương tháng làm căn cứ đóng BHXH (NĐ 188/2025 Đ.6 k1 a), tháng đó chưa phát sinh đóng BHXH (Luật BHXH 2024 Đ.33 k5); D04 chỉ giữ BHYT cho người đã thuộc HĐ đóng BH từ đầu tháng. QĐ 366/QĐ-BHXH không nói riêng trường hợp này: cần xác nhận với cơ quan BHXH (17.3 K4). Trạng thái BH hiện ở cột Ghi chú: "Chỉ BHYT · 15 ngày không hưởng lương".
- Ngày 26–31 nằm ở kỳ công sau: tính tạm từ ô đã nhập của kỳ sau, ghi "tạm". Kỳ sau chốt mà kết quả đổi thì tạo dòng **điều chỉnh BH** ở tháng nháp kế tiếp (R6, loại thứ ba).
- BH không chia theo ngày công: tháng có đóng thì đóng trên đủ (27).
- Trần BHTN = 20 × lương tối thiểu vùng, khác trần BHXH, BHYT = 20 × lương cơ sở.

### 5.5 Nghỉ việc, thuế 10%, cam kết

- **Tiền phép chưa nghỉ** (BLLĐ Đ.113 k3; NĐ 145/2020 Đ.67 k3: căn cứ là "tiền lương theo hợp đồng lao động của tháng trước liền kề tháng người lao động thôi việc"): mặc định = Σ khoản bật "lương theo HĐ" của hồ sơ ngày cuối tháng trước ÷ công chuẩn kỳ trước × số ngày phép còn (`leaveClosing`). "Lương theo HĐ" mặc định = lương thời gian, PC trách nhiệm, chuyên cần; không gồm cơm, xăng xe, điện thoại, nhà ở, trang phục, KPI (BLLĐ Đ.90 k1; TT 10/2020 Đ.3 k5). Số chia không có trong luật, nên dùng công chuẩn như (18) của file T10. **Miễn thuế** trong mức này (NĐ 253 Đ.26 k2); HR bật thêm khoản thì phần vượt chịu thuế (Đ.26 k3). Vào (24) thành dòng riêng "Tiền phép chưa nghỉ", không vào lương đóng BH. Trả trong 14 ngày làm việc (BLLĐ Đ.48 k1): Rà soát nhắc hạn.
  - **Cách làm thật (11/11):** tự tính khi **ngày làm việc cuối nằm trong kỳ công**. Hồ sơ đọc ở ngày cuối kỳ trước; người chưa có hồ sơ lúc đó thì đọc hồ sơ ngày nghỉ và dùng công chuẩn kỳ này. Công chuẩn kỳ trước lấy từ lần chốt kỳ trước, không có thì lấy kỳ này.
  - HR gõ đè số tiền ở Đầu vào tháng (hộp sửa (24)): **trống = tự tính, 0 = không trả**. Phần gõ cao hơn mức luật chịu thuế; người không nghỉ trong kỳ mà HR gõ thì chịu thuế toàn bộ. Rà soát vàng khi số gõ khác số tính (11.3).
- **10%** (NĐ 253 Đ.50 k2): áp cho HĐ dưới 3 tháng hoặc không HĐ, và khi trả cho người đã chấm dứt HĐ, mọi loại HĐ (D10), nếu lần chi từ 5.000.000. Cơ sở (D02) = mọi khoản thu nhập từ tiền lương của lần chi: (26) + Hỗ trợ, không trừ BH, giảm trừ gia cảnh. Dưới ngưỡng: 0, trừ khi người đó yêu cầu (ô gõ đè).
- **Cam kết** (cùng khoản): người đó *ước tính tổng thu nhập chịu thuế cả năm sau giảm trừ gia cảnh chưa đến mức phải nộp* và tự chịu trách nhiệm về cam kết; "căn cứ vào cam kết của cá nhân, tổ chức trả thu nhập không khấu trừ thuế". Có cam kết thì không khấu trừ (D09). Rà soát hiện ước tính năm của web và cảnh báo khi vượt; web không tự bỏ cam kết, HR quyết. Cuối năm vẫn nộp danh sách người chưa khấu trừ.
- HĐ từ 3 tháng: lũy tiến (cùng khoản).

### 5.6 Tách đoạn giữa kỳ

- Lên chính thức, tăng lương giữa kỳ: chia (17) theo ngày hiệu lực bằng `paidBySegment` của Chấm công (phép trả theo thứ tự ngày, phần vượt chuẩn bị cắt ở cuối, điều chỉnh công vào đoạn sau). Mỗi đoạn tính bằng mức và TV của đoạn, công chuẩn giữ của kỳ.
- Mức KPI 100% đổi giữa kỳ: không tách, dùng mức của ngày cuối kỳ hoặc ngày nghỉ việc (câu 24).
- Đổi khu vực giữa kỳ: như Chấm công, một khu vực và một công chuẩn cho cả kỳ (khu vực trong bản chốt; file T10 có một khu vực mỗi dòng). Vùng lương tối thiểu theo nơi đơn vị, chi nhánh hoạt động (NĐ 293/2025 Đ.3 k3), tức khu vực đó, ở ngày 01 của tháng BH (câu 22).
- Ngày chính thức tự điền = ngày vào + số ngày thử việc của người đó (mặc định theo loại HĐ, câu 33); HR sửa được và phải xác nhận (câu 35).

### 5.7 Làm tròn (D01)

Mặc định (câu 25): lương 1 ngày và % KPI giữ số đầy đủ. Mọi ô tiền làm tròn tới đồng **ngay khi tính** (nửa đồng làm tròn ra xa số 0), ô sau tính từ ô đã tròn. Vì vậy (42) = (26) − (41) + (32) đúng tới đồng trên mọi dòng, dòng tổng = Σ các ô, tổng thực nhận = tổng chuyển khoản. Lựa chọn khác "như file HR": tính bằng số đầy đủ, (33) làm tròn trong công thức, dòng tổng = Tròn(Σ chưa tròn). Hai cách có thể lệch 1 đồng (bộ vàng, mục K3).

### 5.8 Tham số luật mặc định (có ngày áp dụng, sửa được)

| Tham số | Giá trị | Nguồn |
|---|---|---|
| Giảm trừ bản thân / người phụ thuộc | 15.500.000 / 6.200.000 từ 01/01/2026 | NQ 110/2025/UBTVQH15 |
| Biểu thuế | 5 bậc: ≤10 tr 5%, 10–30 tr 10%, 30–60 tr 20%, 60–100 tr 30%, >100 tr 35%, cả năm 2026 | Luật 109/2025/QH15 Đ.9, Đ.29 |
| Trần tiền ăn miễn thuế | 730.000; 1.200.000 từ 01/7/2026 | NĐ 253/2026 Đ.8 k2 g, Đ.69 k1 b |
| Trần trang phục bằng tiền miễn thuế | 5.000.000/người/năm thuế, cộng dồn | NĐ 253 Đ.8 k2 đ dẫn sang mức được trừ thuế TNDN: VBHN 19/VBHN-BTC (04/6/2026, gộp NĐ 320/2025) Đ.10 k8 đ |
| Ngưỡng khấu trừ 10% | 2.000.000; 5.000.000 từ 01/7/2026. Đ.69 k1 a cho phần tiền lương áp từ kỳ thuế 2026; hiện không đổi số nào vì T1–T6 đã chi xong | NĐ 253/2026 Đ.50 |
| Lương cơ sở | 2.340.000; 2.530.000 từ 01/7/2026 | NĐ 161/2026 |
| Lương tối thiểu vùng I–IV | 5.310.000 / 4.730.000 / 4.140.000 / 3.700.000 từ 01/01/2026. HCM, HN mặc định vùng I | NĐ 293/2025 |
| BH người lao động | 8% / 1,5% / 1% | Luật BHXH 2024 Đ.33 k1; NĐ 188/2025 Đ.6 k1 a (BHYT 4,5%, NLĐ một phần ba); NĐ 374/2025 Đ.4 k1 |
| BH công ty | 17,5% (3% + 14% + 0,5% TNLĐ-BNN) / 3% / 1% | Luật BHXH 2024 Đ.34 k1; NĐ 58/2020 Đ.4 k1 sửa bởi NĐ 158/2025 Đ.43 k2; NĐ 188/2025 Đ.6 k1 a; NĐ 374/2025 Đ.4 k2 |
| Trần lương đóng | BHXH, BHYT: 20 × mức tham chiếu, đang bằng lương cơ sở. BHTN: 20 × lương tối thiểu vùng | Luật BHXH 2024 Đ.31 k1 đ, Đ.141 k13; Luật BHYT Đ.14 k5; Luật Việc làm 2025 Đ.34 k2 |
| KPCĐ | 2% quỹ lương đóng BHXH, kể cả chưa có công đoàn cơ sở; chỉ miễn khi giải thể, phá sản | Luật Công đoàn 2024 Đ.29 k1 b, Đ.30 (VBHN 90/VBHN-VPQH); NĐ 105/2026 Đ.2, Đ.4, Đ.11. Công ty tạm không tính theo file lương: D03 mặc định tắt (chốt 09/11/2026) |
| Đoàn phí | 0,5% lương đóng BHXH, tối đa 10% lương cơ sở, chỉ đoàn viên | QĐ 61/QĐ-TLĐ (29/7/2025) |
| Tỷ lệ thử việc | 90% (luật tối thiểu 85%) | BLLĐ Đ.26 |
| Thử việc tối đa | 180 ngày quản lý doanh nghiệp, 60 ngày việc cần cao đẳng trở lên, 30 ngày trung cấp, 6 ngày làm việc việc khác | BLLĐ Đ.25 |
| Hệ số làm thêm | 150% / 200% / 300% (tối thiểu theo luật; 300% chưa kể lương ngày lễ) | BLLĐ Đ.98 k1 |
| Giới hạn làm thêm | 40 giờ/tháng, 200 giờ/năm (300 giờ cho ngành ở Đ.107 k3); ngày nghỉ, lễ tối đa 12 giờ/ngày và vẫn tính vào tổng tháng, năm | BLLĐ Đ.107 k2, k3; NĐ 145/2020 Đ.60 k4 |

### 5.9 Khoản lương mặc định

| Khoản | Chia theo ngày | × TV | Tính BH và lương theo HĐ | Thuế mặc định |
|---|---|---|---|---|
| Lương thời gian | Có | Có | **Có** | Chịu thuế |
| PC trách nhiệm | Có | Có | **Có** (câu 16) | Chịu thuế |
| Tiền cơm | Có | Có | Không | Miễn tới trần tiền ăn |
| Xăng xe + ĐT | Có | Có | Không | **Miễn toàn bộ**, một khoản như file T10 (17.3 K2, chốt 09/11/2026). Công ty trả riêng: Xăng xe chịu thuế (câu 1), Điện thoại miễn tới mức HĐLĐ / quy chế (câu 2) |
| Trang phục | Có | Có | Không | Miễn tới trần năm 5.000.000 (câu 2) |
| Nhà ở / Sinh hoạt | Có | Có | Không | Chịu thuế |
| Chuyên cần | Có | Có | Tính BH: **Không**; lương theo HĐ: Có (câu 16, K3) | Chịu thuế |
| KPI 100% | Không (cột riêng) | Theo (19) | Không | Chịu thuế |

- Cờ "chia theo ngày", "× TV" như file T10 (mọi khoản). Mọi khoản chia theo ngày bật "vào lương làm thêm" (câu 20).
- "Tính BH" và "lương theo HĐ" (dùng cho tiền phép) là hai cờ riêng, cùng mặc định trừ chuyên cần (vào lương theo HĐ, không vào lương đóng BH: câu 16, K3). Căn cứ: lương đóng BH và tiền lương theo HĐ gồm mức lương, phụ cấp lương, khoản bổ sung có mức cụ thể trả mọi kỳ; không gồm cơm, xăng xe, điện thoại, nhà ở, các khoản hỗ trợ khác và thưởng (Luật BHXH 2024 Đ.31 k1 b; NĐ 158/2025 Đ.7 k1; TT 10/2020 Đ.3 k5; CV 1198/CTL&BHXH-BHXH ngày 05/9/2025).
- Muốn trả xăng xe và điện thoại riêng: sửa danh sách khoản ở Cấu hình (`khoan.danh-sach`) thành Xăng xe chịu thuế và Điện thoại miễn tới mức (`thue` = `regulated`); vẫn đổi được cách thuế của "Xăng xe + ĐT" cho mọi người hoặc một người (`khoan.xang-dt.thue`).
- Cấu hình T10 "như file HR" dùng cho bộ vàng: "Xăng xe + ĐT" miễn thuế như mặc định, cơm và trang phục miễn hết, chỉ lương thời gian tính BH, KPCĐ tắt, khoản (32) là hoàn ứng, cơ sở 10% là (26).

## 6. Cấu hình: mặc định, ghi đè, phiên bản

### 6.1 Mô hình chung

Mỗi giá trị cấu hình là một dòng: **khoá** (vd `khoan.xang.thue`), **phạm vi** (*Tất cả* hoặc *một người*), **từ tháng** (hoặc ngày áp dụng với tham số luật), **giá trị**, **nguồn / lý do**, người tạo, lúc tạo.

- Giá trị dùng cho người P ở tháng T = dòng *một người* của P có hiệu lực ở T; không có thì dòng *Tất cả*.
- "Đổi cho tất cả" = thêm dòng *Tất cả* từ tháng X. "Đổi cho một người" = thêm dòng *một người*. "Bỏ ghi đè" = thêm dòng ngừng từ tháng X (dòng cũ giữ cho các tháng trước).
- Rà soát cảnh báo khi một ghi đè cho kết quả trái luật đã biết (vd tắt BH cho người có HĐ đóng BH).
- Đổi mức mặc định của khoản: hỏi "Áp cho N người đang dùng mức mặc định, từ ngày …?". Người có mức riêng không đổi.

### 6.2 Danh mục cấu hình

| Nhóm | Gồm | Ghi đè một người |
|---|---|---|
| Khoản lương | Tên, mức mặc định, chia theo ngày, × TV, tính BH, lương theo HĐ, vào lương làm thêm, cách thuế, mức miễn hoặc trần năm, thứ tự cột, ngừng từ tháng | Có (mức ở Hồ sơ; cờ ở Cấu hình) |
| Tham số luật | Mục 5.8 | Có cho vùng lương tối thiểu; còn lại chỉ *Tất cả* |
| Quy tắc | Tỷ lệ thử việc, giờ một ngày, giờ mỗi công làm thêm ngày nghỉ, hệ số làm thêm, giới hạn giờ năm, ngày chi trả mặc định, tháng đầu trên web, % KPI theo khối (BO công thức, KD HR gõ), KPI chính thức chia theo ngày, Gross gồm KPI, mức KPI khi đổi giữa kỳ | Có |
| Loại hợp đồng | Đóng BH, cách thuế (lũy tiến / 10%), HĐ dưới 3 tháng, số ngày thử việc mặc định, thứ tự khi xếp dòng | Có |
| Tuỳ chọn | D01–D12 (mục 9) | Theo cột "Ghi đè" của mục 9 |
| Khu vực | Vùng lương tối thiểu theo tháng | – |

### 6.3 Không có ô "Tự động / Thủ công"

Ô nào web tính được (đóng BH tháng này, % KPI khối BO, làm CN, thuế…) luôn hiện số tính ra. HR gõ đè ngay trên ô: bắt buộc lý do; ô có dấu; tooltip ghi số tính và số gõ; Rà soát liệt kê; "Bỏ gõ đè" trả về số tính. Gõ đè chỉ cho tháng đó. Muốn lâu dài thì ghi đè cấu hình cho người đó.

## 7. Theo thời gian: tháng nào dùng cấu hình nào

**R1. Cái gì có phiên bản.** Mọi thứ làm đổi một số hay một chữ trên bảng lương đều có phiên bản. Đổi là thêm dòng mới, dòng cũ giữ nguyên.

| Nhóm | Có phiên bản theo |
|---|---|
| Tham số luật (cả biểu thuế là một phiên bản) | Ngày áp dụng |
| Khoản lương, quy tắc, loại HĐ, tuỳ chọn, ghi đè từng người | Tháng lương áp dụng từ |
| Hồ sơ từng người: mức từng khoản, loại HĐ, ngày chính thức, đoàn viên | Ngày hiệu lực |
| Người phụ thuộc (từ tháng, đến tháng), cam kết thuế (ngày ký, năm) | Tháng, năm thuế |
| Ngân hàng, số tài khoản, email nhận phiếu | Ngày đổi |
| Mã, tên, chức danh, bộ phận, khối, khu vực, loại NV, công chuẩn, ngày công, mã từng ngày | Lần chốt kỳ công |
| Cách tính (code `payroll.ts`) | Số phiên bản công thức |

**R2. Tháng lương và ngày tham chiếu.** Tháng lương T/YYYY = kỳ công 26/(T−1) → 25/T. Mỗi tháng có **ngày chi trả** (mặc định ngày 05 tháng T+1, sửa được trước khi duyệt). Mỗi loại cài đặt lấy phiên bản theo một ngày tham chiếu cố định, không bao giờ theo hôm nay hay ngày tải.

| Loại | Ngày tham chiếu | Đổi giữa kỳ thì |
|---|---|---|
| Mức lương, loại HĐ, ngày chính thức từng người | Từng ngày trong kỳ | Tách đoạn (5.6) |
| Khoản lương, quy tắc, loại HĐ, tuỳ chọn, ghi đè | Tháng lương T | Cả kỳ một phiên bản |
| BH, KPCĐ, đoàn phí, lương cơ sở, lương tối thiểu vùng, trần | Ngày 01 của tháng dương lịch T | Cả tháng một mức. Luật đổi 01/7 thì tháng lương T7 dùng mức mới cả tháng (câu 30) |
| Giảm trừ, biểu thuế, trần tiền ăn, ngưỡng 10%, người phụ thuộc, cam kết | Ngày chi trả. Năm thuế = năm của ngày chi trả | Cả tháng một mức (câu 29) |

**R3. Nháp tính theo phiên bản đúng tháng.** Tính lại khi mở, khi bấm Tính lại, khi có phiên bản mới chạm đúng tháng đó. Phiên bản từ tháng sau không đổi nháp tháng trước. Số đổi so với lần tính trước thì thanh báo nói vì sao ("Trần tiền cơm đổi từ 01/10, 3 người đổi thuế"), nhật ký ghi số dòng đổi.

**R4. Duyệt là đóng băng.** Duyệt lưu **bản duyệt lần N** bất biến: từng dòng đủ cột (số đã tròn), số HR gõ và ô gõ đè (số tính, số gõ, lý do), mọi phiên bản đã dùng (giá trị, áp dụng từ, nguồn), ghi đè từng người, các đoạn tách, thông tin người như lúc duyệt, lần chốt kỳ công, ngày chi trả, tháng BH, năm thuế, phiên bản công thức, người duyệt, giờ duyệt. Từ 11/11 mỗi dòng lưu thêm `year` (cộng dồn năm: trước tháng này / tháng này góp), `leavePayout` (tiền phép chưa nghỉ), và bản duyệt lưu `retro` (khoản truy lĩnh / truy thu đã nhận, R6). Excel, phiếu, Tổng quan, tổng hợp năm của tháng đó chỉ đọc bản chụp.

**R5. Phiên bản đã dùng ở tháng đã duyệt thì không sửa, không xoá.** Chỉ thêm phiên bản mới. Gõ sai: **Sửa lỗi** tạo bản thay thế cùng ngày áp dụng (bản cũ ghi "đã thay") rồi chạy R6. Đã dùng thì không xoá, chỉ **Ngừng từ tháng X**. Chưa dùng, hoặc chỉ dùng ở nháp: sửa, xoá tự do.

**R6. Thay đổi hồi tố** (ngày áp dụng rơi vào tháng đã duyệt). Lúc lưu, web mở hộp **Thay đổi chạm tháng đã duyệt** (11.4): tháng nháp tự tính lại; tháng đã duyệt hiện chênh lệch từng người (tính thử, không ghi). HR chọn:
- (a) **Mặc định**: truy lĩnh / truy thu / điều chỉnh BH ở tháng nháp kế tiếp, mỗi dòng ghi tháng gốc, lý do; tiền lương chịu thuế ở tháng chi.
- (b) Mở lại tháng đã duyệt gần nhất, khi chưa chuyển khoản (R7).
- (c) Chỉ ghi nhận: mặc định cho thuế khi luật đổi cả năm, NPT đăng ký muộn; điều chỉnh khi quyết toán.

**Cách làm thật (bước 17, 11/11) — thay cho bước "HR chọn (a)/(b)/(c)" lúc lưu:**
- (a) là **tự động**: tháng đã duyệt được tính lại "như bây giờ" (đọc lần chốt công mới nhất nếu kỳ công đã chốt lại), so từng ô tiền với bản duyệt. Phần chênh chưa được tháng đã duyệt nào chuyển đi sẽ tự vào **tháng mở kế tiếp**, theo từng người.
- (b) vẫn là Mở lại (R7). (c) = HR **"Bỏ ra"** khoản đó ở tháng nhận, kèm lý do. HR cũng gõ thay được số web tính (11.4).
- Lưu ở đâu: khoản đã chuyển nằm trong bản duyệt của tháng nhận (`snapshot.retro`); số HR gõ / bỏ ra nằm ở `payroll_month_inputs.retro` (migration 0049). Không có bảng `payroll_retro`.
- Giới hạn: chỉ so **6 tháng đã duyệt liền trước** tháng mở; người có chênh nhưng không có dòng lương ở tháng nhận thì chỉ liệt kê, HR xử lý tay; Excel và phiếu lương chưa có dòng riêng cho truy lĩnh (chỉ có ở Ghi chú).
- **CẦN CHỦ DỰ ÁN CHỐT — thuế của phần truy lĩnh:** (a) ở trên ghi "chịu thuế ở tháng chi". Code đang cộng phần chênh **theo từng ô của tháng gốc** (thu nhập, BH, thuế, chi phí công ty) vào tháng nhận: thuế của phần chênh tính theo biểu của tháng gốc và kê ở tháng chi, **không** gộp vào thu nhập tháng nhận để tính lũy tiến lại. Chưa chốt cách nào đúng.

Tháng gốc mang nhãn "Có thay đổi sau duyệt, xử lý ở T…" trên web, Excel và Tổng quan.

**R7. Mở lại.** Người có quyền Duyệt, có lý do, chỉ tháng đã duyệt gần nhất, chỉ khi chưa đánh dấu Đã chuyển khoản. Về Nháp, tính lại theo R3, hiện chênh so với bản lần N. Duyệt lại thành lần N+1; bản N vẫn tải được từ Nhật ký, mang chữ "đã thay bởi lần N+1". Kỳ công mở lại: lương **nháp** chuyển "Chờ chốt công" (giữ số HR gõ); lương **đã duyệt** không đổi, gắn nhãn "Kỳ công đã mở lại"; chốt lại khác số thì đi R6.

**R8. Mọi đầu ra nói rõ nó dùng gì.** Excel và phiếu có dấu ở đầu: "Bản duyệt lần N · duyệt lúc … bởi … · tải lúc … bởi …" hoặc "BẢN NHÁP · tính lúc … · số còn đổi". Sheet **Tham số áp dụng** liệt kê kỳ công, ngày chi trả, tháng BH, năm thuế, công chuẩn, lần chốt, phiên bản công thức, từng tham số, khoản, quy tắc, loại HĐ, tuỳ chọn, ghi đè từng người, đoạn tách, ô gõ đè, nhãn hồi tố. Tổng quan tách *Đã duyệt / Nháp / Dự tính*.

**R9. Thứ tự tháng.** Duyệt tháng T khi T−1 còn nháp: **cảnh báo**, không chặn ("Số cộng dồn năm dùng nháp T−1; T−1 đổi thì T hiện chênh và đi R6"). Tháng đầu trên web nhận số dư đầu năm.

**Cộng dồn năm thuế (11/11).** Số cộng dồn năm của tháng M = số dư đầu năm + các tháng lương trước đó cùng năm thuế (năm của ngày chi trả), lấy từ **bản duyệt gần nhất** của từng tháng; tháng còn nháp thì lấy số nháp (Rà soát vàng, 11.3). Các số cộng dồn: trang phục đã miễn, giờ làm thêm, thu nhập chịu thuế (cho ước tính cam kết). Thuế đã khấu trừ và BH đã trừ ghi kèm để làm tổng hợp năm. Dùng ở (33), tiền làm thêm miễn thuế (D05) và ước tính cam kết (5.5).

## 8. Tự tính, có ô sửa: đối chiếu file T10

Cột "File T10" chỉ ghi điều có trong file. Ngày vào, nghỉ, chính thức **không có** trong file của HR.

| Quy tắc | File T10 | Web tính | HR sửa ở |
|---|---|---|---|
| Thuế theo ngày chi trả | File không ghi ngày trả | Phiên bản thuế theo ngày chi trả | Ô Ngày chi trả |
| BH theo tháng dương lịch | 1 người chính thức nghỉ việc trong tháng chỉ bị trừ BHYT | BH-1, BH-2 (5.4) từ mã từng ngày | Gõ đè ô (28)–(30) có lý do; D15 |
| Tiền phép khi nghỉ việc | 2 người nghỉ việc đều còn 0 ngày phép (một người nghỉ quá phép nửa ngày, Chấm công đã không trả) | 5.5, lương theo HĐ, miễn thuế | Gõ đè số tiền |
| Khấu trừ 10% | 1 người thử việc nghỉ việc bị trừ đúng 10% thu nhập thực tế; 4 người thử việc đang làm không bị trừ. File không ghi lý do. Người chính thức nghỉ việc có thu nhập dưới ngưỡng nên file không cho biết cách làm với HĐ dài | 5.5; mặc định không có cam kết, nên HĐ dưới 3 tháng chi từ 5 tr bị khấu trừ | Cam kết ở Hồ sơ (17.2); gõ đè ô Thuế |
| Đổi HĐ giữa tháng | Không có trường hợp đã biết ngày | Tách đoạn (5.6), BH-1 | Ngày chính thức ở Chấm công |

## 9. Tuỳ chọn tính lương (D01–D15)

Mỗi tuỳ chọn là một dòng cấu hình (mục 6): mặc định cho tất cả, ghi đè từng người khi cột "Ghi đè" ghi Có, có từ tháng.

| Mã | Tuỳ chọn | Mặc định | Ghi đè |
|---|---|---|---|
| D01 | Làm tròn | Tròn từng ô ngay khi tính (5.7). Khác: như file HR | Không |
| D02 | Cơ sở và ngưỡng 10% | Mọi khoản thu nhập từ tiền lương của lần chi: (26) + Hỗ trợ, không trừ BH, giảm trừ. Khác: (26) như file T10; chỉ phần chịu thuế (34) | Có |
| D03 | KPCĐ | Tắt, như file T10 (chốt 09/11/2026); Rà soát có dòng vàng nhắc Luật Công đoàn 2024 Đ.29 khi đang tắt. Bật: 2% × (27) khi tháng có đóng BHXH; chỉ BHYT thì 0 | Có |
| D04 | BHYT tháng không đóng BHXH vì 14 ngày | Ốm hoặc thai sản từ 14 ngày: 0 (BHXH đóng). Nghỉ không lương, nghỉ việc giữa tháng: vẫn đóng (như file T10). Tháng HĐ đóng BH bắt đầu mà không đóng BHXH: không đóng (5.4). Khác: không đóng | Có |
| D05 | Miễn thuế làm thêm | Toàn bộ tiền làm thêm trong 40 giờ/tháng và 200 giờ/năm (NĐ 253 Đ.26 k1); một công ngày nghỉ, lễ = giờ một ngày (8); phần vượt chịu thuế (Đ.26 k3) | Có |
| D06 | % KPI tháng lên chính thức | HR gõ; web gợi ý Σ(công đoạn × TV đoạn) ÷ chuẩn | Có |
| D07 | Ngày làm việc cho quy tắc 14 ngày | T2–T6 của tháng dương lịch (Chấm công chỉ lưu số thứ Bảy làm việc, không lưu ngày; đếm T2–T6 chỉ có thể đếm thiếu ngày không hưởng lương, nên không bỏ sót tháng phải đóng). Khác: thêm các thứ Bảy làm việc của khu vực | Có |
| D08 | Tiền phép khi nghỉ việc | 5.5: khoản "lương theo HĐ" ÷ công chuẩn kỳ trước × ngày còn, miễn thuế | Có |
| D09 | Cam kết thuế | Không khấu trừ khi có cam kết; Rà soát cảnh báo khi ước tính năm vượt mức | Có |
| D10 | Trả sau ngày nghỉ việc | 10% khi từ ngưỡng, mọi loại HĐ (NĐ 253 Đ.50 k2). Khác: chỉ HĐ dưới 3 tháng; lũy tiến | Có |
| D11 | Khoản không chia theo ngày | Trả đủ × TV nếu bật ở khoản | Theo khoản |
| D12 | Làm Chủ nhật | Mỗi công CN tổng 200%: ngoài (17) trả 200%, đã nằm trong (17) cộng 100% (5.3). Khác: "đổi ngày nghỉ theo nội quy", CN trong (17) không cộng | Có |
| D13 | Thứ tự dòng | Khu vực → loại HĐ (thứ tự ở Cấu hình › Loại HĐ: không thời hạn, 12 tháng, thử việc) → khối (BO, KD) → mã | Không |
| D14 | Người lập tự duyệt | Được, nhật ký ghi cùng người. Khác: không được (chặn) | Không |
| D15 | Vẫn đóng BH tháng có từ 14 ngày không hưởng lương | Không. Khác: có, khi hai bên thoả thuận (Luật BHXH 2024 Đ.33 k5) | Có |

## 10. Dữ liệu

### 10.1 Chấm công (thêm, không đổi cách tính công)

- `timesheet_closings` (một dòng mỗi lần chốt: `close_no`, lúc, người, lễ, khu vực, công chuẩn) và `timesheet_closing_rows` (mỗi người: mã, tên, chức danh, bộ phận, **khối**, khu vực, `staff_kind_id`, loại, ngày vào, **ngày chính thức**, ngày nghỉ, công chuẩn, `totals`, **mã từng ngày**). `ON DELETE RESTRICT`, không sửa, không xoá (trigger). `closePeriod` ghi thêm một lần chốt mỗi khi chốt; `timesheet_snapshots` giữ như cũ cho Chấm công.
- Backfill kỳ đang chốt: `close_no = 1`, chép từ snapshot, dựng mã từng ngày từ ô và lễ đã chốt, rồi so lại `timesheetTotals`; lệch thì ghi cờ "không dựng lại được", không đoán.
- `employees`: thêm khối (BO / KD) và cờ "HR đã xác nhận" cho ngày vào, nghỉ, chính thức.
- **Khối dùng cho tháng lương (11/11):** tháng nháp, bản chốt chưa có khối thì đọc khối hiện tại của nhân viên, cột Ghi chú của dòng nói rõ; bản chốt có khối thì giữ khối của bản chốt; tháng đã duyệt giữ bản duyệt. Không cần mở lại kỳ công để bổ sung khối.
- **Màn Chấm công › Nhân viên (11/11):** ô Khối trong form kèm dòng giải thích; cột Khối; lọc Khối (BO / KD / Thiếu khối, `?khoi=none`); đổi khối cho nhiều người; gợi ý theo bộ phận (tên có "kinh doanh" / "sale" → KD, còn lại BO; nhân viên cũ chỉ gợi ý, không tự lưu); `?nv=<id>` mở sẵn form của người đó.
- `reopenPeriod`: trong cùng giao dịch, báo cho Lương (nháp → Chờ chốt công; đã duyệt → nhãn), ghi một dòng vào nhật ký lương. Người không có quyền Lương chỉ thấy câu chung, không có số.
- `timesheet_region_zones`: vùng lương tối thiểu theo khu vực, từ tháng.

### 10.2 Lương

| Bảng | Nội dung |
|---|---|
| `hr_users` | Thêm `can_payroll`, `can_approve_payroll` (Duyệt cần có Xem, sửa). Lần đầu cấp bằng `PAYROLL_ADMINS` (email) khi chưa ai có quyền; sau đó bỏ qua. Luôn còn ít nhất một người có cả hai quyền |
| `payroll_settings` | Mọi dòng cấu hình của mục 6: khoá, phạm vi (`employee_id` null = tất cả), từ tháng hoặc ngày áp dụng, giá trị (jsonb), nguồn, `superseded_by`, người, lúc. Unique một dòng sống cho mỗi (khoá, phạm vi, ngày) |
| `payroll_components` | Khoản lương; thuộc tính theo phiên bản nằm ở `payroll_settings` |
| `payroll_profiles`, `payroll_profile_amounts` | Hồ sơ theo ngày hiệu lực: mức từng khoản, loại HĐ (thử việc riêng / thử việc trong HĐLĐ / 12 tháng / không thời hạn / dưới 3 tháng), số ngày thử việc, việc quản lý doanh nghiệp (cho trần 180 ngày), đoàn viên, khoản (32) định kỳ (loại, số tiền, từ tháng, đến tháng) |
| `payroll_dependants`, `payroll_tax_commitments` | NPT (từ tháng, đến tháng, số người); cam kết (năm, ngày ký) |
| `payroll_first_month_checks` | Danh sách kiểm trước tháng lương đầu (17.2): mục, người, HR đã xác nhận, lúc, bởi |
| `payroll_bank_accounts` | Ngân hàng, STK mã hoá AES-GCM bằng `PAYROLL_KEY` (biến môi trường), số phiên bản khoá, 4 số cuối lưu riêng, email nhận phiếu, ngày đổi |
| `payroll_opening` | Số dư đầu năm thuế (theo ngày chi, câu 34): thu nhập chịu thuế, thuế đã khấu trừ, giờ làm thêm năm, trang phục đã trả trong năm, số tháng đã trả |
| `payroll_periods` | Khoá (năm, tháng); trạng thái `waiting` / `draft` / `approved` / `paid`; ngày chi trả; lần chốt kỳ công đang dùng; bản duyệt hiện tại; ngày chuyển khoản; `row_version` |
| `payroll_inputs` (trong code: `payroll_month_inputs`) | Số HR gõ mỗi tháng và ô gõ đè (số tính, số gõ, lý do bắt buộc). Thêm 11/11: cột `leave_payout` (migration 0048: trống = tự tính, 0 = không trả) và `retro` (migration 0049: số HR gõ thay / bỏ ra cho khoản truy lĩnh web tính) |
| `payroll_draft_lines` | Kết quả nháp lần tính trước, để R3 so được |
| `payroll_runs`, `payroll_lines`, `payroll_run_supersessions` | Bản duyệt lần N (ngày chi trả, tháng BH, năm thuế, phiên bản công thức, phiên bản đã dùng, tổng) và từng dòng; bất biến (trigger) |
| ~~`payroll_retro`~~ | **Không tạo** (11/11). Khoản đã chuyển nằm trong bản duyệt của tháng nhận (`snapshot.retro`); số HR gõ nằm ở `payroll_month_inputs.retro` (R6) |
| `payroll_log` | Nhật ký lương riêng (không dùng `timesheet_log`): nhóm, người làm, việc, chi tiết cũ → mới, tháng ảnh hưởng, lúc. Chỉ thêm |

- Tiền là `bigint` đồng đã tròn; số chưa tròn (lương 1 ngày, %) là `numeric`. Không dùng `real`.
- Công thức thuần ở `packages/shared/src/payroll.ts`, không đụng database, test như `timesheet.ts`.

## 11. Màn hình

### 11.1 Khung chung

`/hr/luong`, chỉ người có quyền mới thấy. Cùng khuôn Chấm công. Tab: **Tổng quan · Bảng lương · Hồ sơ lương · Phiếu lương · Cấu hình · Nhật ký**. Mỗi tab có thanh lọc chung (4.1). Trên mỗi tab, chip trạng thái của tháng đang chọn: *Chờ chốt công / Nháp · tính lúc … / Đã duyệt lần N · lúc · bởi / Đã chuyển khoản dd/mm*.

### 11.2 Bảng lương `?ky=YYYY-MM`

- Lưới như Bảng công: băng nhóm A–H, cột Mã, Tên đứng yên, cột vừa chữ, sao chép, rê sáng cả dòng.
- Thanh trên, gom 3 nhóm: [Tính lại · Rà soát (số cảnh báo)] [Duyệt · Mở lại · Đã chuyển khoản] [Tải Excel ▾]. Ngày chi trả nằm cạnh chip trạng thái. Nút không dùng được thì ẩn ở tháng đã duyệt.
- **Tooltip ô tính**: công thức bằng số thật, phiên bản đã dùng ("Trần tiền ăn 1.200.000 · từ 01/07/2026 · NĐ 253"), liên kết "Mở cấu hình". Ô lấy từ Chấm công có liên kết "Xem ở Bảng công".
- **Ô gõ đè**: dấu tam giác góc ô, tooltip số tính và số gõ, lý do. **Ghi đè cấu hình riêng**: chấm màu, tooltip "Riêng NV A từ T12".
- Chú giải dưới lưới đếm số ô gõ đè, số người có cấu hình riêng, số cảnh báo.
- Tháng đã duyệt: dải khoá "Đã duyệt lần N, chỉ xem. Muốn sửa: Mở lại hoặc Truy lĩnh / truy thu ở T+1". Khi tính lại "như bây giờ" ra số khác: dải "Số hiện tại khác bản đã duyệt — chênh lệch chuyển sang tháng MM" (R6).
- **Hộp sửa (24)** có mục "Tiền phép chưa nghỉ": công thức + ô số tiền (trống = tự tính, 0 = không trả; người không nghỉ trong kỳ vẫn nhập được) (5.5).
- **Ngăn nguồn** của (33), tiền làm thêm và (40) có bảng "Cộng dồn năm thuế" (R9).
- Ô Khối là liên kết sang form người đó ở Chấm công › Nhân viên (11.3).

### 11.3 Rà soát

Danh sách cảnh báo, mỗi dòng bấm tới ô. Mức đỏ (phải tích "Đã xem" trước khi Duyệt) và vàng.

| Mức | Cảnh báo |
|---|---|
| Đỏ | Người có công mà chưa có hồ sơ (dòng 0 đồng); thực nhận âm; lương thời gian dưới lương tối thiểu vùng; thiếu khối hoặc loại HĐ; ngày dùng để tách đoạn, tính BH hoặc 10% chưa được HR xác nhận; tháng đầu trên web chưa xác nhận lần chốt kỳ công; tháng đầu trên web còn mục chưa xác nhận ở danh sách kiểm 17.2; số ngày thử việc vượt mức BLLĐ Đ.25 |
| Vàng | Lệch hơn 10% so với tháng trước, kèm nguyên nhân đã biết; (17) lớn hơn chuẩn; gõ đè khác số tính; HĐ dưới 3 tháng nhận từ 5 tr mà không có cam kết (sẽ khấu trừ 10%); cam kết có ước tính năm vượt mức; còn phép khi nghỉ việc và hạn trả 14 ngày làm việc; thiếu STK; OT ngày chưa có giờ làm thêm; CN bù ngày thường; làm thêm vượt 40 giờ/tháng hoặc 200 giờ/năm; trang phục chạm trần năm; ghi đè cấu hình trái luật; tháng trước còn nháp (chỉ còn hiện khi tháng trước thuộc năm thuế khác); hồi tố chưa xử lý |
| Vàng (11/11) | Cộng dồn năm: "Tháng MM chưa duyệt — số cộng dồn năm đang lấy bản nháp"; "Tháng MM chưa có bảng lương — số cộng dồn năm chưa gồm tháng này"; "Tháng MM duyệt trước khi web ghi số cộng dồn…". Tiền phép: "Tiền phép chưa nghỉ gõ X thấp hơn / cao hơn số tính Y". Truy lĩnh: "Có truy lĩnh/truy thu từ tháng MM"; "Truy lĩnh / truy thu từ Tmm/yyyy: HR bỏ ra / HR gõ X, số tính Y" |

- **"Thiếu khối" (đỏ)** chỉ còn khi cả bản chốt lẫn nhân viên đều chưa có khối. Cách sửa: Chấm công › Nhân viên › ô Khối, không cần mở lại kỳ công. Dòng này và ô Khối trên lưới mở form người đó ở `/hr/cham-cong/nhan-vien?nv=<id>` (`&khoi=none` lọc "Thiếu khối").
- `/hr/luong?ky=…&rs=1` mở sẵn Rà soát; đóng thì bỏ `rs`.

### 11.4 Hộp thoại

| Hộp | Nội dung | Mặc định | Không cho bấm khi |
|---|---|---|---|
| **Duyệt** | Số người, tổng thực nhận, tổng chi phí, cảnh báo còn lại theo mức, ngày chi trả, người duyệt | Người duyệt = HR đang đăng nhập | Kỳ công chưa chốt; chưa Tính lại sau thay đổi cuối; còn cảnh báo đỏ chưa tích "Đã xem" |
| **Mở lại** | Bản lần N (lúc, bởi, tổng thực nhận); "Sau khi mở: về Nháp, tính lại theo cấu hình của tháng này, gồm X thay đổi hồi tố; bản lần N vẫn giữ"; ô Lý do bắt buộc | – | Đã chuyển khoản (gợi ý nút "Tạo truy lĩnh / truy thu ở T+1"); không phải tháng duyệt gần nhất (ghi tháng gần nhất); không có quyền Duyệt |
| **Đã chuyển khoản** | Ngày chuyển khoản, số người, tổng thực nhận của bản lần N, ghi chú. Cảnh báo: ngày chuyển khoản qua mốc tham số thuế khác ngày chi trả; có người thiếu hoặc đổi STK sau duyệt | Ngày = ngày chi trả | Chưa duyệt. Sau khi đánh dấu: không mở lại được; "Bỏ đánh dấu" cần lý do, có nhật ký |
| **Thay đổi chạm tháng đã duyệt** (R6) | Mở khi lưu thay đổi có ngày áp dụng rơi vào tháng đã duyệt, hoặc khi chốt lại kỳ công khác số. Danh sách tháng (trạng thái, số người đổi, tổng chênh); bảng chênh từng người (cột, cũ → mới, chênh thực nhận, chênh BH công ty); chọn (a) / (b) / (c) | (a) truy lĩnh / truy thu / điều chỉnh BH ở tháng nháp kế tiếp; (c) cho thuế đổi cả năm và NPT muộn. Lý do điền sẵn từ thay đổi, sửa được | (b) ẩn khi tháng đã chuyển khoản hoặc không phải tháng gần nhất |
| **Truy lĩnh / truy thu** (thêm tay trên tháng nháp) | Người, tháng gốc, loại, số tiền, chịu thuế, lý do bắt buộc. **Hiện có (11/11):** chỉ gõ thay hoặc "Bỏ ra" khoản web tự tính; số gõ vào (32), ngoài thuế và BH, lý do bắt buộc. **Chưa có:** thêm tay một khoản không do web tính | Chịu thuế = Có với tiền lương, Không với BH | – (truy thu lớn hơn thực nhận: cảnh báo, gợi ý chia nhiều tháng) |
| **Xoá** | Dùng hộp xác nhận chung, nói rõ cái gì bị xoá và ảnh hưởng tháng nào | – | Đã dùng ở tháng duyệt: đổi thành "Ngừng từ tháng" |

Gõ đè ô và nhật ký không dùng modal: gõ đè là ô sửa ngay trên lưới có ô lý do; nhật ký là tab.

### 11.5 Hồ sơ lương

Danh sách người lấy từ Chấm công (lọc đủ như 4.1, thêm "Thiếu hồ sơ", "Có cấu hình riêng"). Bấm một người: mức từng khoản theo ngày hiệu lực (ô ngày, chọn tháng thì điền ngày 26 của tháng trước và báo "tháng này sẽ tách 2 đoạn" khi khác đầu kỳ), loại HĐ, số ngày thử việc, NPT, cam kết, đoàn viên, khoản (32) định kỳ, ngân hàng (STK 4 số cuối, "Hiện đủ" có nhật ký), cấu hình riêng của người đó (danh sách ghi đè, có từ tháng). Băng báo người có ở Chấm công mà chưa có hồ sơ, nút tạo điền sẵn mức mặc định. Trước tháng lương đầu, băng "Danh sách kiểm (n mục chưa xác nhận)" mở danh sách 17.2, mỗi mục bấm tới đúng ô của người đó.

### 11.6 Cấu hình `?muc=khoan-luong|tham-so|quy-tac|loai-hd|tuy-chon|khu-vuc`

Menu trái như Chấm công. Mỗi giá trị hiện: giá trị đang áp, từ tháng, nguồn, nhãn *Sắp áp dụng / Đã thay*, số người có ghi đè (bấm ra danh sách). Chọn "Xem cấu hình áp dụng cho tháng …" thì cả trang hiện đúng phiên bản của tháng đó. Quyền lương cấp ở trang Tài khoản HR, không có mục riêng ở đây.

Dòng nguồn của tham số trên web và sheet "Tham số áp dụng" **ẩn chữ nội bộ** ("spec x.y", "câu N", mã D/R, "(17.3)"); "file T10" ghi thành "Theo file lương của HR"; không còn gì thì ghi "Quy chế công ty" (11/11).

### 11.7 Phiếu lương

Chọn nhiều người (lọc 4.1), xem cùng lúc, tải Excel (mỗi người một sheet), in vừa trang. Phiếu có thu nhập, làm thêm, khấu trừ, thực nhận (BLLĐ Đ.95 k3), STK 4 số cuối, dấu bản. Tháng nháp: chữ NHÁP chìm trên từng phiếu. Không có khối ký tên.

### 11.8 Tổng quan

- Chọn năm; xem theo **tháng** (biểu đồ 12 cột và bảng) hoặc theo **năm** (các năm có dữ liệu).
- Mỗi số có nhãn trạng thái: **Đã duyệt** (đặc), **Nháp** (sọc), **Dự tính** (viền chấm). Ba loại cộng riêng; ô tổng năm ghi rõ "Đã duyệt X · Nháp Y · Dự tính Z", không có một số gộp không nhãn.
- Tháng duyệt đọc bản chụp; nháp là số tạm; tháng chưa chốt công là Dự tính = mức hồ sơ của tháng đó × đủ công, KPI 100%, không làm thêm, tham số của tháng đó. Tháng trước khi có web: "Chưa có dữ liệu".
- Lọc khối, khu vực theo thuộc tính của chính tháng đó. Bảng tháng có ô chọn để tải 1 hoặc nhiều tháng.
- **Đã làm (bước 26, 11/11):** địa chỉ `?xem=thang|nam&nam=YYYY`. Xem theo năm là **T1–T12, mỗi tháng một dòng** (không phải mỗi năm một dòng); tổng năm tách "Đã duyệt · n tháng" và "Nháp · n tháng". Tháng chờ chốt công ghi "chưa có số" vì API chưa trả Dự tính. Mỗi số bấm được về dòng tổng Bảng lương của tháng đó.
- **Chưa làm:** Dự tính, biểu đồ 12 cột, so tháng trước, tooltip truy lĩnh, thưởng T13, ô chọn tháng để tải Excel (L-G03, L-G04, L-G08, L-G09, L-G12, L-G13).

### 11.9 Nhật ký

Một tab, hiện thẳng trên trang. Lọc `?nhom=bang-luong|ho-so|cau-hinh|tai-xem|quyen|cham-cong`, `?tim=`, theo kỳ, theo người; xem thêm từng 100 dòng. Mỗi dòng: icon theo việc (thêm, sửa, xoá, duyệt, mở lại, chuyển khoản, tải, xem), chip nhóm, câu thường có mã người ("Sửa Tiền cơm của NV A: 1.100.000 → 1.150.000, từ T12/2026"), người làm, dd/mm/yyyy HH:mm, liên kết tới đối tượng. Chi tiết dài mở ngay trong dòng. Từ dòng duyệt tải được bản lần N. Lọc "Nhân viên" bằng ô chọn nổi (một người), không dùng select của trình duyệt (11/11).

### 11.10 Điện thoại (390 px)

Thanh tab cuộn ngang, tab đang chọn luôn trong tầm nhìn. Thanh lọc gom vào nút "Lọc (n)". Bảng lương hiện dạng **một người một thẻ** (tên, công, thu nhập, khấu trừ, thực nhận; bấm mở đủ cột theo nhóm). Nút thao tác gom vào "Thêm". Màn đầu thấy được ít nhất thẻ đầu tiên.

## 12. Excel

### 12.1 Tải

- Tải 1 tháng, nhiều tháng, cả năm; từ Bảng lương, Tổng quan, Phiếu lương (một hộp chung). Mỗi sheet theo bản của đúng tháng đó (Q3).
- Bố cục theo file HR: nhóm A–H, cột đánh số theo file, dòng tổng, A4 ngang. Nhóm A có một cột cho mỗi khoản lương của tháng đó, theo thứ tự cấu hình (mặc định một cột (11) Xăng xe + ĐT như file, 17.3 K2; công ty trả riêng thì (11a), (11b), câu 3). Dòng xếp theo D13.
- Khối ký tên Người lập biểu, Kế toán trưởng, Giám đốc, ngày = ngày chi trả, chỉ trong Excel.
- Dấu bản (R8), sheet Tham số áp dụng, sheet Tổng hợp khi nhiều tháng (cộng số đã có, không tính lại; tên, khu vực theo tháng gần nhất, ghi chú nếu khác). Tuỳ chọn ẩn nhóm H.
- Tên file: `Bang-luong-10-2026-lan-2.xlsx`, `Bang-luong-11-2026-NHAP.xlsx`, `Bang-luong-2026-T08-T10.xlsx`.

### 12.2 Nhập

- Đọc file có đúng tiêu đề cột của file HR (dòng tiêu đề và dòng số cột). Nối người theo Mã NV → `employee_id`; mã không có thì gợi ý người gần giống, HR chọn.
- Ba kiểu nhập: **Đầu vào tháng** ((19), (21)–(24), (32) tách thành hỗ trợ / hoàn ứng / tạm ứng); **Hồ sơ** ((8)–(15), (49)–(51), có ngày hiệu lực); **Số dư đầu năm**.
- Cột "Xăng xe + ĐT": vào thẳng khoản Xăng xe + ĐT (mặc định). Công ty đã tách hai khoản thì đưa hết vào Xăng xe và cảnh báo "Sửa nếu có Điện thoại".
- Xem trước: bảng cũ → mới từng ô, lỗi từng dòng. Chưa bấm "Lưu" thì không ghi gì. Lưu là một dòng nhật ký có số ô đổi, mở ra từng ô.

## 13. Impact Analysis

- `apps/api`: schema, migration, routes `hr-payroll*`, services `payroll*`, quyền ở `lib/hr-auth.ts`. Chấm công: bảng lần chốt, khối, xác nhận ngày, gọi Lương khi mở lại kỳ.
- `packages/shared/src/payroll.ts` (mới); dùng lại `paidBySegment`, `restDayWork` của `timesheet.ts`.
- `apps/web/src/pages/hr/payroll/` (mới); dùng lại `CopyValue`, `PeriodPicker`, `ExportMonthsDialog`, `LogTab`, lưới shadcn-grid của Chấm công; trang Tài khoản HR (ô cấp quyền); menu quản trị.
- Public API: thêm API mới, API cũ giữ nguyên. Breaking change: không; migration chỉ thêm bảng, cột có mặc định.

## 14. Test Strategy

Danh mục: `docs/test-cases-luong.md`. Mỗi tình huống có mã L-xx; test tự động đặt tên theo mã. Test viết trước code và chạy đỏ trước (4.12).

- **Unit** (`payroll.test.ts`): từng công thức mục 5, quy tắc BH-1, BH-2, 10%, cam kết, tiền phép, tách đoạn, làm tròn hai chế độ, tham số theo ngày áp dụng (tháng 6 và 7/2026).
- **Ma trận** 64 đường (mục K2) và **bộ vàng** 12 người ẩn danh (mục K3) ở hai chế độ, kiểm từng ô.
- **Đối chiếu file thật**: script chạy trên máy với file T10 thật, so từng ô ở chế độ "như file HR". Script và file thật không commit.
- **Integration** (API, PGlite): 403 mọi route; chỉ tính khi kỳ công đã chốt; mở lại kỳ công; duyệt khoá số; đổi mọi thứ sau duyệt không làm đổi tháng đã duyệt; nhật ký cũ → mới; GET không ghi DB.
- **Web**: lọc, gõ đè có dấu, ghi đè hiện trên dòng, tooltip công thức, liên kết, hộp thoại, Excel đọc lại đúng bố cục.
- **Thủ công**: chạy T11 song song với Excel của HR, so từng ô; Chrome ở 1440, 1280, 390.

## 15. Implementation Steps

Mỗi bước 1 commit, gồm test của bước đó. Bắt đầu bằng test lấy từ danh mục, chạy đỏ, rồi viết code tới khi xanh. Không sang bước sau khi bước này chưa xanh.

**Engine thuần (`packages/shared`), chưa có UI**

- [ ] **1. Kiểu dữ liệu, làm tròn, tham số theo ngày.** `payroll.ts`: kiểu đầu vào / đầu ra, `roundDong`, `paramsOn(ngày)`, `settingFor(khoá, người, tháng)` (mặc định → ghi đè). Test: L-K1-21, L-A03, L-A04, L-L01.
- [ ] **2. Thu nhập (16)–(26).** Lương 1 ngày theo cờ từng khoản, khoản cố định, KPI, làm thêm, lễ 300%. Test: L-D01–L-D09, L-D34, L-K1-19, L-K1-20.
- [ ] **3. Bảo hiểm (27)–(31), (43)–(47).** Sàn trần hai mức, BH-1, BH-2 từ mã từng ngày theo tháng dương lịch, D03, D04, D15, ngoại lệ ốm tháng đầu. Test: L-K1-01–L-K1-11, L-K1-23, L-K1-24, L-D16–L-D21.
- [ ] **4. Thuế (33)–(40).** Miễn thuế có trần (cả trần trang phục năm), làm thêm, tiền phép, giảm trừ, lũy tiến, 10% với cơ sở D02, cam kết và ước tính năm. Test: L-K1-12–L-K1-17, L-K1-22, L-D22–L-D31.
- [ ] **5. Thực nhận, chi phí, dòng tổng; ma trận.** Test: L-D37, 64 đường L-K2.
- [ ] **6. Bộ vàng chế độ cấu hình mặc định.** Test: L-K3-S01–S12 và dòng tổng.
- [ ] **7. Chế độ "như file HR" và cấu hình T10.** Test: L-K3-F01–F12. Script đối chiếu file thật chạy trên máy, không commit.
- [ ] **8. Tách đoạn và gợi ý KPI.** Dùng `paidBySegment`. Test: L-D03, L-D06, L-C23, L-B05.
- [ ] **9. Rà soát thuần.** Hàm trả danh sách cảnh báo (mức, mã, ô). Test: các ca Rà soát ở C, D, E, L.

**API**

- [ ] **10. Quyền Lương.** Cột quyền, `PAYROLL_ADMINS`, 403 mọi route, `payroll_log` riêng. Test: L-H01–L-H13.
- [ ] **11. Chấm công: lần chốt bất biến.** `timesheet_closings`, mã từng ngày, backfill, RESTRICT. Test: L-C02, L-C05, L-C06, L-L28.
- [ ] **12. Chấm công: khối, ngày chính thức, xác nhận ngày, báo Lương khi mở lại.** Test: L-C03, L-C04, L-C07, L-B26, L-L29, L-L30.
- [ ] **13. Cấu hình có phiên bản và ghi đè.** `payroll_settings`, tham số luật, khoản, quy tắc, loại HĐ, tuỳ chọn, vùng. Test: L-A01–L-A33, L-L01, L-L02.
- [ ] **14. Hồ sơ lương.** Mức theo ngày hiệu lực, loại HĐ, số ngày thử việc, khoản (32) định kỳ, NPT, cam kết, ngân hàng mã hoá, số dư đầu năm, danh sách kiểm 17.2. Test: L-B01–L-B28, L-E07.
- [ ] **15. Tháng lương nháp.** Lấy công từ lần chốt, ô gõ, gõ đè có lý do, nháp lần trước, `row_version`, GET không ghi. Test: L-C01–L-C24, L-E14, L-L22, L-L23.
- [ ] **16. Duyệt, Mở lại, Đã chuyển khoản.** Bản duyệt lần N, R9 cảnh báo, D14. Test: L-E01–L-E17, L-L31, L-M01–L-M06.
- [ ] **17. Hồi tố, truy lĩnh / truy thu.** Tháng ảnh hưởng, chênh tính thử, (a) (b) (c). Test: L-A08, L-B07, L-E11, L-I06, L-M07–L-M10.

**Web**

- [ ] **18. Khung `/hr/luong`, thanh lọc chung, quyền ẩn menu.** Test: L-L05–L-L07, L-H01, L-H03.
- [ ] **19. Lưới Bảng lương.** Nhóm, cột đứng yên, tooltip số thật, sao chép, liên kết cấu hình và Bảng công, dấu gõ đè và ghi đè. Test: L-L03, L-L04, L-L08–L-L14.
- [ ] **20. Rà soát và các hộp thoại.** Test: L-L19, L-M01–L-M12.
- [ ] **21. Hồ sơ lương và Cấu hình** (thêm, sửa, xoá, ngừng, xem theo tháng). Test: L-L02, L-L17, L-A32.
- [ ] **22. Nhật ký một tab.** Test: L-I01–L-I11, L-L15–L-L18.
- [ ] **23. Excel tải.** 1 tháng, nhiều tháng, cả năm, sheet Tham số, Tổng hợp. Test: L-F01–L-F17, L-F23, L-K1-18, L-L33, L-L34.
- [ ] **24. Excel nhập** với xem trước. Test: L-L24–L-L27.
- [ ] **25. Phiếu lương.** Test: L-F18–L-F22.
- [ ] **26. Tổng quan tháng và năm.** Test: L-G01–L-G13, L-L32.
- [ ] **27. Bố cục và điện thoại.** Test: L-L20, L-L21, L-L35 ở 1440, 1280, 390.
- [ ] **28. Đối chiếu và chạy song song.** Script so file T10 thật trên máy; chạy T11 song song với Excel của HR; sửa chỗ lệch, cập nhật danh mục.

## 16. Risks

- **Lộ lương**: chặn ở API, không chỉ ẩn nút. Nhật ký, Excel tải về cũng là dữ liệu lương. Dữ liệu thật không vào code, test, docs, commit.
- **Luật đổi giữa năm** (đã xảy ra 01/7/2026): mọi mức có ngày áp dụng; tháng đã duyệt giữ bản chụp.
- **Điểm luật văn bản chưa nói rõ** (BH tháng vào, nghỉ giữa tháng; BHYT tháng không đóng BHXH; chuyên cần trong lương đóng BH; cơ sở 10%; mức khoán điện thoại, trang phục): web chạy theo mặc định an toàn ở mục 17, kế toán ký xác nhận ở 17.3 trước khi bỏ Excel.
- **Khác file T10 về số tiền**: lương đóng BH tăng ở người có PC trách nhiệm (vào lương đóng; chuyên cần thì không, như file); người HĐ dưới 3 tháng chưa có cam kết bị khấu trừ 10% khi nhận từ 5 tr. Rà soát tháng đầu ghi rõ từng nguyên nhân.
- **Khác file Excel cũ**: tháng đầu lệch ở chỗ file đang sai hoặc khác luật (hỗ trợ, lương đóng BH, KPI gõ tay, Gross, làm tròn). Rà soát nói rõ vì sao lệch.
- **Chấm công chưa lưu lần chốt và mã từng ngày**: Lương phụ thuộc bước 11, 12.
- **Giờ làm thêm** HR phải gõ; Chấm công chỉ có công.
- **Chuyển khoản, phiếu email chưa có**: HR dùng file tải về tới spec sau.

## 17. Đã chốt (BA)

BA chốt cả 35 điểm, không còn câu hỏi cho chủ dự án. Mỗi điểm dựa trên văn bản luật còn hiệu lực năm 2026, file T10 của HR, hoặc quyết định của chủ dự án (mục 3), và là một dòng cấu hình có mặc định, sửa được cho tất cả hoặc cho một người, có từ tháng (Q1, Q3). Điểm nào là dữ kiện về từng người thì thành trường ở Hồ sơ lương và vào danh sách kiểm 17.2.

Cột **Mức**: *Luật* = đã đọc văn bản; *File* = theo cách file T10 làm; *Dữ kiện* = trường từng người; *Chưa có văn bản* = không tìm được văn bản nói thẳng, web dùng mặc định an toàn và kế toán ký ở 17.3.

### 17.1 Quyết định

| # | Quyết định | Căn cứ | Khoá cấu hình / trường | Mức |
|---|---|---|---|---|
| 1 | **Đổi 09/11/2026 (17.3 K2)**: mặc định trả "Xăng xe + ĐT" một khoản, miễn toàn bộ như file. Công ty trả xăng xe riêng, cố định hằng tháng: chịu thuế toàn bộ. Có quy chế khoán công tác phí thì đổi cách thuế của khoản | NĐ 253/2026 Đ.8 k3 (phụ cấp chịu thuế trừ danh mục loại trừ, không có xăng xe); Đ.8 k2 đ chỉ có văn phòng phẩm, công tác phí, điện thoại, trang phục; Đ.8 k4 c chỉ có xe đưa đón của đơn vị | `khoan.xang_xe.thue` = chịu thuế | Luật |
| 2 | Điện thoại: miễn tới mức ghi trong HĐLĐ / quy chế, mặc định = mức của người đó ở hồ sơ. Trang phục bằng tiền: miễn tới 5.000.000/người/năm thuế, cộng dồn. Phần vượt chịu thuế | NĐ 253 Đ.8 k2 đ: mức khoán "phù hợp với việc xác định chi phí được trừ khi tính thuế thu nhập doanh nghiệp"; VBHN 19/VBHN-BTC (gộp NĐ 320/2025) Đ.10 k8 b (khoản trả NLĐ phải ghi điều kiện và mức trong HĐLĐ, thoả ước hoặc quy chế), k8 đ (trang phục bằng tiền tối đa 5 tr/người/năm); điện thoại không có trần số. Mặc định điện thoại trả gộp trong "Xăng xe + ĐT", miễn toàn bộ (17.3 K2); cách trên áp khi công ty trả điện thoại riêng | `khoan.xang-dt.thue` = miễn; trả riêng: `khoan.dien-thoai.muc-quy-che` = mức hồ sơ; `khoan.trang_phuc.tran_nam` = 5.000.000 | Luật; việc HĐLĐ / quy chế ghi mức: 17.3 |
| 3 | **Đổi 09/11/2026 (17.3 K2)**: giữ "Xăng xe + ĐT" một khoản, một cột (11) như file. Muốn tách thành hai khoản, hai cột thì tách ở Cấu hình › Khoản lương | Người dùng chốt "như file"; tách khi hai khoản khác cách thuế (câu 1, 2). Nhóm A của file T10 có một cột cho mỗi khoản | `khoan.*` (danh mục, thứ tự cột) | Luật, File |
| 4 | Khoản (32) là dữ kiện từng người: hồ sơ có "khoản (32) định kỳ" (loại, số tiền, từ tháng, đến tháng), điền sẵn vào ô tháng. Ô tháng tách Hỗ trợ / Hoàn ứng / Tạm ứng; khoản mới không chọn loại thì là **Hỗ trợ**: chịu thuế, vào chi phí, vào cơ sở 10%. Hoàn ứng chỉ khi trả lại tiền NLĐ đã chi cho công ty, có chứng từ. **Thêm 10/11/2026 (theo file T10):** loại "Công ty trả thay BH" (`insurance-paid`): tự tính = BH người lao động của tháng, có từ tháng / đến tháng, áp được cho một hoặc nhiều người; "Tính thuế" mặc định tắt như file; khi tắt, Rà soát báo vàng (không chặn) dẫn NĐ 253 Đ.8; mỗi người mỗi tháng chỉ một khoản loại này | NĐ 253 Đ.8 k1, k2 k: mọi khoản NSDLĐ chi cho NLĐ là thu nhập từ tiền lương, trừ danh mục ở Đ.8 k4. File: 2 dòng có (32) đúng bằng phần BH người lao động của dòng đó, không ghi tên khoản | Hồ sơ `khoan_32_dinh_ky`; `thang.khoan_32.loai_mac_dinh` = Hỗ trợ; 17.2 | Dữ kiện, Luật |
| 5 | % KPI khi HR không gõ đi theo khối (sửa 10/11): khối BO = công ÷ chuẩn, × TV ở ngày thử việc; khối KD = HR gõ. Gõ đè có lý do | File, soát từng ô 12 dòng: khối BO thử việc 15/22 → 61,36%, 19,5/22 → 79,77%, đúng công ÷ chuẩn × 90% tới số lẻ; khối KD là 0%, 80%, 100% do HR đánh giá, không theo công | "% KPI theo khối" = BO công thức, KD HR gõ; ghi đè cho tất cả hoặc từng người | File |
| 6 | KPI chính thức: khối KD HR gõ %, không chia theo ngày công. Khối BO: công ÷ chuẩn, đủ công ra 100% (sửa 10/11) | File: dòng chính thức khối KD thiếu công vẫn nhận nguyên % gõ; khối BO chính thức đều đủ công, 100%. BO chính thức thiếu công: mặc định, chưa có dữ liệu thực tế xác nhận | `kpi.chia_ngay_chinh_thuc` = Không; "% KPI theo khối" | File |
| 7 | Gross (16) = Σ khoản + KPI 100%, chỉ để xem | File: 8/12 dòng gồm KPI; 4 dòng thiếu KPI, không ảnh hưởng tiền | `gross.gom_kpi` = Có | File |
| 8 | KPCĐ mặc định **tắt** như file T10 (chốt 09/11/2026, "theo file + tự động"); HR bật cho công ty hoặc từng người thì 2% × (27). Đang tắt: Rà soát vàng, không chặn. Công ty tạm không tính theo file lương | Luật Công đoàn 2024 Đ.29 k1 b (VBHN 90/VBHN-VPQH): "đóng bằng 2% quỹ tiền lương làm căn cứ đóng bảo hiểm xã hội bắt buộc", không điều kiện có công đoàn cơ sở; Đ.30 và NĐ 105/2026 Đ.11 chỉ miễn khi giải thể, phá sản | D03 | Luật |
| 9 | HĐ thử việc riêng: không BHXH, BHTN. Thử việc ghi trong HĐLĐ: đóng như HĐLĐ. Ai ký loại nào là dữ kiện | NĐ 158/2025 Đ.3 k5: "người lao động làm việc theo hợp đồng thử việc ... không thuộc đối tượng tham gia bảo hiểm xã hội bắt buộc"; Luật Việc làm 2025 Đ.31 k2; Luật BHXH 2024 Đ.2 k1 a. File: 5/5 dòng thử việc không BH | Hồ sơ `loai_hd`, mặc định với loại NV Thử việc = HĐ thử việc riêng; `loai_hd.*.dong_bh`; 17.2 | Luật, Dữ kiện |
| 10 | Cam kết thuế là dữ kiện từng người. **Đổi 10/11/2026 (chủ dự án: cam kết nằm trong hợp đồng thử việc; file T10 không trừ 10% người thử việc đang làm):** loại HĐ có thuộc tính "Cam kết thuế kèm hợp đồng" (`loai-hd.<id>.cam-ket-kem-hd`), bật sẵn cho HĐ thử việc / dưới 3 tháng, nên mặc định không khấu trừ 10% mà HR không phải nhập gì. Tắt được cho tất cả, một hoặc nhiều người: khi đó trừ 10% tới khi có cam kết ký riêng (nhập từng người hoặc "Thêm cam kết thuế cho nhiều người"). Rà soát (vàng, không chặn): số người đang dựa vào cam kết kèm hợp đồng kèm điều kiện của luật; "Thu nhập ước tính cả năm vượt mức được cam kết — nên khấu trừ 10%"; "Chưa có cam kết thuế — đang khấu trừ 10%"; "Cần ký lại cam kết thuế năm YYYY" ở tháng lương đầu tiên chi trong năm mới. Người đã nghỉ việc vẫn theo D10 (Q4 của bản rà soát BA chưa quyết) | NĐ 253 Đ.50 k2 | Hồ sơ `cam_ket_thue` (năm, ngày ký); 17.2 | Dữ kiện |
| 11 | Ước tính năm vượt mức: web chỉ cảnh báo, không tự bỏ cam kết | NĐ 253 Đ.50 k2: "Cá nhân làm cam kết phải chịu trách nhiệm về bản cam kết của mình ... Căn cứ vào cam kết của cá nhân, tổ chức trả thu nhập không khấu trừ thuế" | D09 | Luật |
| 12 | Trả cho người đã chấm dứt HĐ, lần chi từ 5 tr: 10%, mọi loại HĐ | NĐ 253 Đ.50 k2: "(bao gồm cả trường hợp trả tiền lương, thu nhập khác cho người lao động đã chấm dứt hợp đồng lao động) mà mức chi trả thu nhập từ 05 triệu đồng/lần trở lên thì phải khấu trừ ... theo tỷ lệ 10%"; trả lời của Thuế tỉnh Bắc Ninh trên cổng hỏi đáp Bộ Tài chính (câu hỏi 27/8/2026) | D10 | Luật |
| 13 | Cơ sở 10% = (26) + Hỗ trợ của lần chi, không trừ BH, giảm trừ gia cảnh; ngưỡng 5 tr xét từng lần chi trên cùng cơ sở | NĐ 253 Đ.50 k2: "10% trên thu nhập trước khi trả thu nhập cho cá nhân"; Thuế tỉnh Bắc Ninh: BH, giảm trừ gia cảnh "không trừ khi thực hiện khấu trừ tạm thời theo tỷ lệ 10%". Văn bản không nói có loại khoản miễn thuế ra không, nên lấy cơ sở lớn hơn | D02 | Luật (BH, giảm trừ); Chưa có văn bản (khoản miễn thuế): 17.3 |
| 14 | Tháng vào, nghỉ, đổi sang / khỏi HĐ đóng BH: đếm ngày không hưởng lương, gồm ngày ngoài HĐ đóng BH; từ 14 thì không đóng BHXH, BHTN, dưới 14 đóng đủ | Luật BHXH 2024 Đ.33 k5: "mà không hưởng tiền lương từ 14 ngày làm việc trở lên trong tháng thì người lao động không phải đóng bảo hiểm xã hội tháng đó"; Luật Việc làm 2025 Đ.33 k4. Không văn bản còn hiệu lực nói riêng tháng vào, nghỉ: QĐ 595/QĐ-BHXH hết hiệu lực 01/5/2026, QĐ 366/QĐ-BHXH không có quy tắc này. Đọc theo chữ thì đóng nhiều tháng hơn cách cũ "làm dưới 14 ngày thì không đóng", nên an toàn hơn | BH-1 (5.4), D07, D15 | Chưa có văn bản (đã tìm Luật BHXH 2024, NĐ 158/2025, QĐ 595, QĐ 366, NĐ 188/2025): 17.3 |
| 15 | Tháng không đóng BHXH: ốm hoặc thai sản từ 14 ngày thì BHXH đóng BHYT, bảng lương ghi 0; nghỉ không lương, nghỉ việc giữa tháng thì vẫn đóng BHYT như file T10; tháng HĐ đóng BH bắt đầu mà không đóng BHXH thì không đóng BHYT (sửa 10/11) | Luật BHYT Đ.12 k2 b sửa bởi Luật 51/2024 và Luật BHXH 2024 Đ.119 k2: người nghỉ ốm, thai sản từ 14 ngày làm việc trong tháng do cơ quan BHXH đóng BHYT. Nghỉ không lương: Luật BHYT Đ.12 k5 c xếp vào nhóm tự đóng nhưng không nói theo tháng; vẫn đóng để thẻ không bị hở. Tháng HĐ đóng BH bắt đầu: NĐ 188/2025 Đ.6 k1 a tính BHYT trên tiền lương tháng đóng BHXH, Luật BHXH 2024 Đ.33 k5 cho tháng đó không đóng BHXH nên chưa có căn cứ đóng BHYT; QĐ 366/QĐ-BHXH cần xác nhận với cơ quan BHXH | D04 | Luật (ốm, thai sản); Chưa có văn bản (còn lại): 17.3 |
| 16 | Lương đóng BH = lương thời gian + PC trách nhiệm. Chuyên cần **không** vào lương đóng BH (chốt 09/11/2026, K3): trả theo tỷ lệ ngày đi làm nên là khoản biến động theo quá trình làm việc. Không gồm cơm, xăng xe, điện thoại, nhà ở, trang phục, KPI. HR bật lại "tính BH" của chuyên cần cho mọi người hoặc một người ở Cấu hình | Luật BHXH 2024 Đ.31 k1 b; NĐ 158/2025 Đ.7 k1 b (phụ cấp bù "tính chất phức tạp công việc"), c (khoản bổ sung "xác định được mức tiền cụ thể ... trả thường xuyên, ổn định", trừ khoản "phụ thuộc hoặc biến động theo năng suất lao động, quá trình làm việc và chất lượng thực hiện công việc"); TT 10/2020 Đ.3 k5 và CV 1198/CTL&BHXH-BHXH (05/9/2025): phúc lợi ghi mục riêng không tính. File T10: lương đóng BH = lương thời gian ở mọi người chính thức, chuyên cần chia theo ngày đi làm | `khoan.*.tinh_bh` | Luật + File; K3 |
| 17 | "Ngày làm việc" để đếm 14 ngày: T2–T6 | Luật đếm theo ngày làm việc của công ty (ngày nghỉ hằng tuần ghi trong nội quy, BLLĐ Đ.111 k2). Chấm công chỉ lưu số thứ Bảy làm việc, không lưu ngày; đếm T2–T6 chỉ có thể đếm thiếu ngày không hưởng lương, không bỏ sót tháng phải đóng | D07 | Luật |
| 18 | Tiền phép chưa nghỉ = khoản "lương theo HĐ" (lương thời gian, PC trách nhiệm, chuyên cần) của hồ sơ ngày cuối tháng trước ÷ công chuẩn kỳ trước × ngày còn; miễn thuế | BLLĐ Đ.113 k3; NĐ 145/2020 Đ.67 k3: "tiền lương theo hợp đồng lao động của tháng trước liền kề tháng người lao động thôi việc"; BLLĐ Đ.90 k1; TT 10/2020 Đ.3 k5; NĐ 253 Đ.26 k2 (miễn), k3 (phần vượt chịu thuế). Số chia luật không nói: dùng công chuẩn như (18) của file T10 | D08; `khoan.*.luong_hd` | Luật; số chia: File |
| 19 | Mỗi công CN tổng 200%, kể cả khi bù ngày thường đã nghỉ | BLLĐ Đ.98 k1 b ("vào ngày nghỉ hằng tuần, ít nhất bằng 200%"); Đ.107 k1 (làm thêm là làm ngoài thời giờ làm việc bình thường theo nội quy); Đ.111 k2. Không điều nào cho bù với ngày thường | D12 | Luật |
| 20 | Lương giờ làm thêm = (18) ÷ 8, (18) gồm mọi khoản chia theo ngày | NĐ 145/2020 Đ.55 k1 a: lương giờ thực trả không gồm tiền ăn giữa ca, xăng xe, điện thoại, đi lại, nhà ở...; đó là mức tối thiểu (BLLĐ Đ.98 k1 "ít nhất"), nên tính cả các khoản này vẫn hợp lệ và không thấp hơn luật. BLLĐ Đ.105 k1: tối đa 8 giờ/ngày. Rà soát đỏ nếu tắt lương thời gian hoặc phụ cấp lương | `quy_tac.gio_mot_ngay` = 8; `khoan.*.vao_lam_them` = Có | Luật |
| 21 | Một công làm thêm ngày nghỉ, lễ = 8 giờ khi cộng vào 40 giờ/tháng, 200 giờ/năm | BLLĐ Đ.107 k2; NĐ 145/2020 Đ.60 k4 (ngày nghỉ, lễ tối đa 12 giờ/ngày; không điều nào loại khỏi tổng). File nhập hai cột này theo công | D05; `lam_them.gio_moi_cong` = giờ một ngày; `lam_them.gioi_han_nam` = 200 | Luật, File |
| 22 | Đổi khu vực giữa kỳ: cả kỳ theo khu vực trong bản chốt, không tách | File: một khu vực, một công chuẩn mỗi dòng. NĐ 293/2025 Đ.3 k3: vùng theo nơi đơn vị, chi nhánh hoạt động | Khu vực trong bản chốt (5.6) | Luật, File |
| 23 | Tăng lương, lên chính thức giữa kỳ: tách đoạn theo ngày, chung công chuẩn | BLLĐ Đ.26 (85% chỉ cho thời gian thử việc), Đ.27 k1 (đạt thì thực hiện HĐLĐ). File: một công chuẩn mỗi khu vực (dòng 5–6) | `paidBySegment` (5.6) | Luật, File |
| 24 | Mức KPI 100% đổi giữa kỳ: dùng mức ngày cuối kỳ (hoặc ngày nghỉ việc), không tách | File: cột (15) một mức mỗi dòng. KPI là thưởng theo quy chế (BLLĐ Đ.104) | `kpi.muc_doi_giua_ky` = ngày cuối kỳ | File |
| 25 | Làm tròn từng ô tiền khi tính, ô sau dùng số đã tròn, dòng tổng = Σ ô | File: mọi ô tiền hiện số đồng tròn, dòng "TỔNG CỘNG" là tổng cột; chỗ lệch 1 đồng trong file đến từ số lẻ ẩn (K3). Chế độ "như file HR" vẫn có | D01 | File |
| 26 | Thứ tự dòng: khu vực → loại HĐ → khối → mã | File: 12/12 dòng xếp theo khu vực (HCM rồi HN), trong khu vực theo loại HĐ (không thời hạn, 12 tháng, thử việc), trong đó BO trước KD; trong nhóm không theo quy tắc nào nên dùng mã | D13 | File |
| 27 | Ngày chi trả mặc định ngày 05 tháng T+1, sửa trước khi duyệt. Thuế theo ngày chi; ngày chuyển khoản thực qua mốc tham số thì cảnh báo | BLLĐ Đ.97 k2: thời điểm trả do hai bên thoả thuận, cố định theo chu kỳ. File để trống ngày (dòng ký "ngày ...... tháng ......"). Mọi mốc tham số hiện có đổi vào ngày 01, nên ngày nào trong tháng T+1 cũng ra cùng số | `ky.ngay_chi_tra` | Chưa có văn bản (dữ kiện của công ty): 17.3 |
| 28 | Người lập được tự duyệt trên web, nhật ký ghi cùng người; Excel giữ ba dòng ký | Duyệt trên web chỉ khoá số. Chứng từ là Bảng thanh toán tiền lương có chữ ký người lập, kế toán trưởng, giám đốc: file (dòng ký) và TT 99/2025 Phụ lục II, mẫu 01-LĐTL (mẫu tham khảo, Đ.9 k1) | D14 = được | File |
| 29 | Thuế, NPT, cam kết theo ngày chi trả; lương T12 chi tháng 1 thuộc năm thuế sau | NĐ 253 Đ.46 k3: "Thời điểm xác định thu nhập tính thuế từ tiền lương, tiền công là thời điểm người sử dụng lao động trả tiền lương"; Đ.66 k1 a: kỳ tính thuế theo năm dương lịch | R2 | Luật |
| 30 | BH tháng lương T dùng mức có hiệu lực ngày 01 tháng dương lịch T | Luật BHXH 2024 Đ.33 k1 b (đóng hằng tháng), Đ.31 k1 đ (trần "20 lần mức tham chiếu tại thời điểm đóng"), Đ.141 k13 (mức tham chiếu = lương cơ sở); Luật Việc làm 2025 Đ.34 k2 | R2 | Luật |
| 31 | Đã chuyển khoản thì không mở lại; sửa bằng truy lĩnh, truy thu ở tháng sau | NĐ 253 Đ.46 k3: thuế tính ở lúc trả, khoản đã trả không tính lại được, phần chênh là lần chi mới. Quyết định Q3 của chủ dự án | R7 | Luật |
| 32 | HĐLĐ 12 tháng: đóng BH, thuế lũy tiến | Luật BHXH 2024 Đ.2 k1 a (HĐLĐ từ đủ 1 tháng); NĐ 253 Đ.50 k2 đoạn cuối (HĐLĐ từ 3 tháng: lũy tiến). File: 3 dòng HĐ 12 tháng có BH, lũy tiến | `loai_hd.hdld_12t` | Luật, File |
| 33 | Số ngày thử việc mặc định 60 cho loại HĐ thử việc, sửa từng người; Rà soát đỏ khi vượt BLLĐ Đ.25 (180 nếu đánh dấu việc quản lý doanh nghiệp). Ngày chính thức tự điền chỉ là gợi ý, phải xác nhận (câu 35) | BLLĐ Đ.25: 60 ngày là trần cho việc cần cao đẳng trở lên; chức danh trong file là việc văn phòng, kỹ thuật | `loai_hd.thu_viec.so_ngay` = 60; hồ sơ `so_ngay_thu_viec`; 17.2 | Luật, Dữ kiện |
| 34 | Tháng đầu trên web T11/2026. Số dư đầu năm = mọi lần chi lương trong năm 2026 trước lần chi đầu trên web, theo ngày chi (gồm lương T12/2025 nếu chi trong năm 2026) | File T10 là tháng Excel cuối. Năm thuế theo ngày chi (NĐ 253 Đ.46 k3, Đ.66 k1 a) | `luong.thang_dau` = 2026-11; `payroll_opening` | Luật, File |
| 35 | Ngày vào, nghỉ, chính thức là dữ kiện: mỗi ngày có cờ "HR đã xác nhận", mặc định chưa; Rà soát đỏ khi ngày chưa xác nhận được dùng | File không có ngày nào; ngày trên web do người nhập suy ra (mục 1) | Cờ xác nhận ở `employees` (10.1); 17.2 | Dữ kiện |

### 17.2 Danh sách kiểm trước tháng lương đầu

Dữ kiện từng người, không phải câu hỏi. Web chạy ngay theo mặc định; tháng lương đầu có Rà soát đỏ tới khi HR xác nhận từng mục (11.3, 11.5).

| Mục | Trường | Mặc định khi HR chưa nhập | Rà soát |
|---|---|---|---|
| Loại HĐ từng người | Hồ sơ `loai_hd` | Loại NV Thử việc → HĐ thử việc riêng; Chính thức → HĐLĐ không thời hạn | Đỏ |
| Số ngày thử việc, việc quản lý doanh nghiệp | Hồ sơ | 60; không | Đỏ khi vượt BLLĐ Đ.25 |
| Ngày vào, nghỉ, chính thức | `employees` + cờ xác nhận | Chưa xác nhận | Đỏ khi ngày được dùng |
| Cam kết thuế năm 2026 | `payroll_tax_commitments` | Không có: HĐ dưới 3 tháng chi từ 5 tr bị khấu trừ 10% | Vàng |
| Người phụ thuộc | `payroll_dependants` | 0 (file: 0 cho cả 12 dòng) | – |
| Đoàn viên | Hồ sơ | Không | – |
| Khoản (32) định kỳ | Hồ sơ `khoan_32_dinh_ky` | Không có; khoản mới là Hỗ trợ | Vàng khi Excel tháng trước có (32) cho người đó |
| Mức điện thoại, trang phục theo HĐLĐ / quy chế | Mức khoản ở hồ sơ | Mức đang có ở hồ sơ | – |
| Trang phục đã trả và số dư đầu năm | `payroll_opening` | 0 | Đỏ ở tháng đầu |
| Lần chốt kỳ công T10 do script chốt | 4.21 | Chưa xác nhận | Đỏ |

### 17.3 Cần kế toán ký xác nhận

Chỉ những điểm văn bản không nói thẳng và thuộc trách nhiệm kê khai, khấu trừ hoặc thoả thuận của công ty. Web đã chạy theo mặc định ghi ở cột phải; ký xác nhận hoặc đổi ở Cấu hình.

| # | Điểm | Vì sao kế toán ký | Mặc định web đang dùng |
|---|---|---|---|
| K1 | Ngày trả lương cố định (câu 27) | BLLĐ Đ.97 k2: do công ty và NLĐ thoả thuận | Ngày 05 tháng T+1 |
| K2 | "Xăng xe + ĐT" một khoản, miễn thuế toàn bộ như file T10 (câu 1–3); chốt 09/11/2026 ("như file"). HĐLĐ hoặc quy chế ghi mức xăng xe + ĐT, trang phục | Điều kiện để phần này không chịu thuế (NĐ 253 Đ.8 k2 đ; VBHN 19/VBHN-BTC Đ.10 k8 b); xăng xe trả cố định không có trong danh mục loại trừ (Đ.8 k3), công ty chịu trách nhiệm kê khai | Xăng xe + ĐT miễn toàn bộ, chia theo ngày như lương; trang phục tới 5 tr/năm. Tách lại được ở Cấu hình (Xăng xe chịu thuế, Điện thoại miễn tới mức ở hồ sơ) |
| K3 | Chuyên cần không vào lương đóng BH (câu 16); chốt 09/11/2026 | Công ty kê khai lương đóng BH. Chuyên cần trả theo tỷ lệ ngày đi làm, nên thuộc khoản NĐ 158/2025 Đ.7 k1 c loại ra ("phụ thuộc hoặc biến động theo … quá trình làm việc"); file T10 thật cũng đóng BH trên lương thời gian ở mọi người chính thức | Không tính BH (PC trách nhiệm vẫn tính); bật lại được ở Cấu hình cho mọi người hoặc một người |
| K4 | BH tháng vào, nghỉ, đổi HĐ giữa tháng và BHYT tháng không đóng BHXH (câu 14, 15) | Không còn văn bản riêng sau QĐ 366/QĐ-BHXH | Đếm ngày không hưởng lương gồm ngày ngoài HĐ, từ 14 thì không đóng BHXH, BHTN; BHYT vẫn đóng trừ ốm, thai sản từ 14 ngày và trừ tháng HĐ đóng BH bắt đầu mà không đóng BHXH (NĐ 188/2025 Đ.6 k1 a, Luật BHXH 2024 Đ.33 k5; QĐ 366/QĐ-BHXH không nói riêng, cần xác nhận với cơ quan BHXH) |
| K5 | Cơ sở 10% có loại khoản miễn thuế ra không (câu 13) | Công ty là người khấu trừ; NĐ 253 Đ.50 k2 không nói | (26) + Hỗ trợ, không loại khoản nào |

### 17.4 Nguồn đã đọc

- NĐ 253/2026/NĐ-CP, Công báo số 402 ngày 16/07/2026 (Đ.8, 26, 46, 50, 66, 69); Luật Thuế TNCN 109/2025/QH15 Đ.4 k8: https://luatvietnam.vn/thue/luat-thue-thu-nhap-ca-nhan-2025-so-109-2025-qh15-422733-d1.html
- VBHN 19/VBHN-BTC (thuế TNDN, gộp NĐ 320/2025, NĐ 141/2026): https://luatvietnam.vn/thue/van-ban-hop-nhat-19-vbhn-btc-2026-quy-dinh-chi-tiet-thi-hanh-luat-thue-thu-nhap-doanh-nghiep-436630-d5.html
- Trả lời của cơ quan thuế trên cổng hỏi đáp Bộ Tài chính: https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/164621 (10%), https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/165313 (làm thêm)
- Luật BHXH 41/2024/QH15 (Đ.2, 31, 33, 34, 119, 141): https://hcc.nghean.gov.vn/tin-tong-hop/toan-van-luat-so-41-2024-qh15-bao-hiem-xa-hoi-1457.html
- NĐ 158/2025/NĐ-CP (Đ.3 k5, Đ.7): https://atld.vn/law/3772/content; CV 1198/CTL&BHXH-BHXH: https://luatvietnam.vn/lao-dong/cong-van-1198-ctlbhxh-bhxh-2025-ve-tien-luong-dong-bao-hiem-xa-hoi-bat-buoc-410642-d6.html
- Luật BHYT sửa bởi Luật 51/2024/QH15 (Đ.12, 14): https://hcc.nghean.gov.vn/tin-tong-hop/toan-van-luat-sua-doi-bo-sung-mot-so-dieu-cua-luat-bao-hiem-y-te-1910.html
- Luật Việc làm 74/2025/QH15 (Đ.31, 33, 34): https://hethongphapluat.com/luat-viec-lam-2025/dieu-31; NĐ 374/2025/NĐ-CP: https://hethongphapluat.com/nghi-dinh-374-2025-nd-cp-huong-dan-luat-viec-lam-ve-bao-hiem-that-nghiep.html
- QĐ 366/QĐ-BHXH thay QĐ 595/QĐ-BHXH từ 01/5/2026: https://luatvietnam.vn/lao-dong/quyet-dinh-366-qd-bhxh-2026-quy-trinh-thu-bao-hiem-xa-hoi-y-te-that-nghiep-434265-d1.html
- Luật Công đoàn 2024 (VBHN 90/VBHN-VPQH): https://vnuf.edu.vn/wp-content/uploads/2025/10/VBHN_90-VBHN-VPQH.pdf; NĐ 105/2026/NĐ-CP: https://hethongphapluat.com/nghi-dinh-105-2026-nd-cp-huong-dan-luat-cong-doan-ve-tai-chinh-cong-doan.html
- BLLĐ 2019 (Đ.25–27, 48, 90, 97, 98, 105, 107, 111, 113): https://hethongphapluat.com/bo-luat-lao-dong-2019.html; NĐ 145/2020/NĐ-CP (Đ.55, 60, 67): https://hethongphapluat.com/nghi-dinh-145-2020-nd-cp-huong-dan-bo-luat-lao-dong-ve-dieu-kien-lao-dong-va-quan-he-lao-dong.html; TT 10/2020/TT-BLĐTBXH Đ.3 k5
- NĐ 293/2025/NĐ-CP (Đ.3): https://luatvietnam.vn/lao-dong/nghi-dinh-293-2025-nd-cp-ve-muc-luong-toi-thieu-cho-nguoi-lao-dong-hop-dong-418212-d1.html; TT 99/2025/TT-BTC: https://luatvietnam.vn/doanh-nghiep/thong-tu-99-2025-tt-btc-huong-dan-che-do-ke-toan-doanh-nghiep-tu-01-01-2026-417085-d1.html
