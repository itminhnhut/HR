# Rà soát LUỒNG bảng lương so với file tháng 10 của HR

Ngày 11/11/2026. Người rà: BA (không sửa code). Người sửa: Code. Danh sách việc nhỏ: `docs/.ra-soat-flow.md`.
Bản rà công thức và luật làm trước đó: `docs/luong-ra-soat-ba.md` (không làm lại ở đây).

Cách rà: mở web bản dev (dữ liệu production mới nhất + tháng 10 nạp từ file), chỉ xem, không lưu gì; đọc code; tải thử
Excel tháng 10 rồi so cấu trúc với file của HR. Không chép tên, mã hay số tiền của ai vào tài liệu này.

## 1. Kết luận ngắn

- **Số tháng 10 trên web khớp file HR ở mọi cột (8)–(48) của cả 12 dòng**, trừ 3 chỗ đã biết từ lần rà trước:
  (16) Gross ở 4 dòng file quên cộng KPI (web đúng); dòng 12 có một khoản cộng không rõ nguồn (đang chờ hỏi HR);
  dòng 8 lệch 1 đồng do làm tròn.
- **Lưới trên web giờ đúng với file**: cùng chữ cái nhóm (A, B, B2, B3, C, D, E, F, G, H), cùng tên cột, cùng số cột
  (4)–(48), có thêm Chức danh, Số NPT, Bậc thuế; dòng tổng cộng đúng các cột file cộng.
- **Excel tải về đúng khung file HR**: 53 cột cùng thứ tự, cùng tên nhóm và số cột, dòng TỔNG CỘNG, 3 ô chữ ký ở
  đúng cột.
- **Dễ dùng hơn**: Rà soát gọn (30 dòng → 12 dòng), xác nhận được ngày vào / nghỉ việc, dòng nào cũng nói phải làm gì và dẫn tới chỗ sửa; số nào bấm cũng
  ra nguồn; ô gõ được có bút chì; nhập % KPI / thu nhập khác / (32) cho nhiều người một lần.

**Kết quả lượt này:** BA ghi 26 việc nhỏ (F01–F26); Code sửa cả 26; BA xem lại từng việc trên trình duyệt hoặc đọc
diff: **26/26 ĐẠT** (F20 phải làm lại một lần vì họ tên dài bị cắt). Một phần của F24 và vài ý nhỏ để sau, ghi ở mục 5.
Code chưa commit; test do Code chạy, BA không chạy test. BA không bấm Lưu / Duyệt nên các bản sửa có ghi dữ liệu
(F11, F15, F25, F26) mới được xem tới bước hỏi lại, phần ghi dựa vào test của Code.

## 2. Từng bước của luồng

| Bước | Đúng với file chưa | Dễ dùng chưa | Đã sửa trong lượt này | Còn lại |
|---|---|---|---|---|
| 1. Chốt công → tháng lương sẵn sàng | Đúng: kỳ công 26 → 25, công chuẩn HCM 22 / HN 24 như file | Giờ rõ: tháng chưa chốt nói bước tiếp và có nút "Mở Chấm công kỳ này" | F14 | Tháng chưa chốt công chưa có số dự tính |
| 2. Nhân viên & khối | Đúng: cột "Bộ phận" của file chính là Khối BO / KD | Khối sửa ở Chấm công › Nhân viên, bấm ô Khối là tới. Giờ xác nhận được ngày vào / chính thức / nghỉ việc | F25 (ô tích "Đã kiểm tra, ngày này đúng"), F19 (bỏ câu về Khối khỏi Ghi chú, Excel, phiếu) | HR sửa Chức danh cho khớp chữ của file (mục 3) |
| 3. Hồ sơ lương | Mức của 12 người khớp file (nhóm A) | Danh sách giờ thấy Gross, NPT, cách thuế, (32) định kỳ, tài khoản; có người đã nghỉ còn dòng lương; danh sách kiểm xác nhận được cả người một lần | F15, F20, F12 (mức điền sẵn theo file) | Mức lương chưa sửa được cho nhiều người một lần; danh sách chưa phân biệt cam kết Kèm HĐ / Ký riêng và chưa có tên khoản (32) |
| 4. Cấu hình | Mặc định theo file tháng 10 (KPCĐ tắt, cam kết kèm HĐ thử việc, KPI theo khối, tỷ lệ BH) | Hết mã D01…, chữ dễ hiểu hơn; có vùng lương của từng khu vực | F12, F13, F24 phần 1 | Chưa thêm / đổi tên / ngừng được khoản lương và loại HĐ (F24 phần 2, chờ chủ dự án) |
| 5. Bảng lương tháng (lưới) | Đúng: nhóm cột, tên cột, số cột, cột (4) (7) (39), dòng tổng như file; SỐ khớp 12/12 dòng | Ô gõ được có bút chì; mở ô (32) thấy phần định kỳ + phần riêng tháng; nhập (19), (24), (32) cho nhiều người; bấm số ra "Trong đó" | F01, F02, F03, F04, F16, F08, F09, F10, F11, F26 | Sửa / xoá dòng (24), (32) của nhiều người cùng lúc; tên từng khoản định kỳ trong ô (32) |
| 6. Rà soát cảnh báo | Vàng nhắc đúng 2 chỗ file khác luật (KPCĐ tắt, cam kết kèm HĐ), không chặn | 30 dòng còn 12; dòng nào cũng có "việc cần làm" và link tới đúng chỗ sửa; nút Rà soát tách đỏ / vàng | F05, F06, F07 | – |
| 7. Truy lĩnh / truy thu | Chưa đối chiếu được: file không có, web chưa có tháng đã duyệt | Chỉ đọc code và chữ: tự tính, HR "Bỏ ra" hoặc gõ số khác có lý do, chọn nhiều khoản | – | BA chưa xem trên màn hình; chưa thêm tay được một khoản; thuế của phần truy lĩnh chờ chủ dự án chốt |
| 8. Duyệt → đã chuyển khoản → mở lại | – (file không có bước này) | Hộp Duyệt chữ dễ hiểu, có link đổi ngày chi trả và nút mở Rà soát | F21 | BA không bấm Duyệt / Mở lại / Đã chuyển khoản (chỉ đọc chữ trong code) |
| 9. Tải Excel và phiếu lương | Đúng khung file: 53 cột, tên nhóm, số cột, TỔNG CỘNG, 3 ô chữ ký; nay có dòng địa chỉ, ngày ký để trống, cột Ghi chú sạch | Menu rõ (tháng này, nhiều tháng, cả năm, phiếu nhiều người); phiếu ghi đúng tên "Công ty trả thay BH" | F17, F19, F22 | Khác file, đã chốt từ trước: có số (18), dòng tổng có (20). Tên sheet "Tháng 10.26" chưa so được với file gốc. Sheet "Tham số" còn mã Dnn |
| 10. Nhật ký | – | Đọc bằng tên khoản, tên loại HĐ; lọc theo nhóm việc | F18 | Dòng nhật ký cũ về cấu hình còn mã Dnn |
| 11. Tổng quan | Tổng khớp dòng TỔNG CỘNG | Các ô tự cộng ra nhau (thêm ô (32) và dòng công thức Thực nhận); số nào cũng bấm về lưới | F23 | Dự tính cho tháng chưa chốt, biểu đồ, so tháng trước (đã ghi ở tài liệu tiến độ) |

## 3. Dữ liệu HR cần tự sửa (không phải lỗi code)

- Mã nhân viên ở **dòng 10** của file khác mã của người đó trên web (file 4 chữ số, web 3 chữ số). Cần HR xác nhận mã
  nào đúng.
- **Chức danh** trên web khác chữ với file ở 10/12 dòng (web đang lấy tên vị trí ở Chấm công). Muốn Excel ra đúng chữ
  của file thì sửa Chức danh ở Chấm công › Nhân viên.
- Web **chưa có email nhận phiếu lương và số tài khoản** của ai (12 cảnh báo vàng "Thiếu số tài khoản"). Nhập ở Hồ sơ
  lương › Ngân hàng.
- Lần chốt công tháng 10 chưa ghi khối: web đang dùng khối hiện tại của nhân viên (đúng với file).
- 2 người có trong Chấm công nhưng chưa có hồ sơ lương (vào từ 26/10 và 10/11): cần tạo trước khi tính tháng 11.

## 4. Bảng tham số: tự động hay ô nhập, sửa ở đâu, cho ai

"Tất cả / một / nhiều": **TC** = đổi cho cả công ty từ một tháng; **1** = riêng một người; **N** = chọn nhiều người một
lần. "Thấy nguồn" = bấm vào số trên lưới thì ngăn bên phải hiện tham số này kèm nút Đổi.

### 4.1 Lấy từ Chấm công (tự động, sửa ở Chấm công)

| Tham số | Tự động hay ô nhập | HR sửa ở đâu | Cho ai | Thấy nguồn trên lưới |
|---|---|---|---|---|
| Kỳ công 26 → 25 | Cố định trong code | **Không sửa được** | TC | Có (đầu trang) |
| Công chuẩn theo khu vực (HCM 22, HN 24) | Tự động từ Chấm công | Chấm công (lịch / khu vực) | TC theo khu vực | Có: cột Công chuẩn bấm ra Bảng công |
| (17) Ngày công thực tế, phép, nghỉ không lương | Tự động từ lần chốt công | Chấm công rồi chốt lại | 1 | Có: bấm ra Bảng công của người đó |
| (22), (23) Công làm thêm ngày nghỉ, lễ | Tự động từ Chấm công, HR gõ đè được | Ô trên lưới | 1 | Có |
| Khối BO / KD | Ô nhập | Chấm công › Nhân viên | 1 | Có: bấm ô Khối |
| Khu vực, Bộ phận, Chức danh, Loại NV | Ô nhập | Chấm công › Nhân viên | 1 | Có (Hồ sơ lương: mục "Từ Chấm công") |
| Ngày vào, ngày chính thức, ngày nghỉ việc | Ô nhập + ô tích "Đã kiểm tra, ngày này đúng" | Chấm công › Nhân viên | 1 | Có (Rà soát báo đỏ khi chưa xác nhận) |

### 4.2 Hồ sơ lương (ô nhập theo từng người, có ngày hiệu lực)

| Tham số | Tự động hay ô nhập | HR sửa ở đâu | Cho ai | Thấy nguồn trên lưới |
|---|---|---|---|---|
| Mức từng khoản (8)–(14), KPI 100% (15) | Ô nhập; hồ sơ mới điền sẵn mức mặc định | Hồ sơ lương › Mức lương (thêm / sửa / xoá mức theo ngày) | 1 (**chưa có N**) | Có: bấm số nhóm A |
| Loại HĐ, số ngày thử việc, quản lý DN, đoàn viên | Ô nhập (trong form Mức lương) | Hồ sơ lương › Mức lương | 1 | Có |
| (7) Số người phụ thuộc | Ô nhập (thêm / sửa / xoá từng người phụ thuộc) | Hồ sơ lương › Người phụ thuộc, hoặc bấm ô (7) / (36) | 1 | Có |
| Cam kết thuế ký riêng | Ô nhập | Hồ sơ lương › Cam kết thuế | 1 và N ("Thêm cam kết thuế cho nhiều người") | Có ở (40) |
| Khoản (32) định kỳ (hỗ trợ, tạm ứng, công ty trả thay BH) | Ô nhập; "Công ty trả thay BH" tự tính = (28)+(29)+(30) | Hồ sơ lương › Khoản (32) định kỳ | 1 và N ("Công ty trả thay BH cho nhiều người") | Có: mở ô (32) |
| Số dư đầu năm thuế | Ô nhập | Hồ sơ lương › Số dư đầu năm thuế | 1 | Có ở (33), (40) |
| Tài khoản ngân hàng, email nhận phiếu | Ô nhập | Hồ sơ lương › Ngân hàng | 1 | Chỉ ở Excel / phiếu lương |

### 4.3 Số gõ mỗi tháng (trên lưới)

| Tham số | Tự động hay ô nhập | HR sửa ở đâu | Cho ai | Thấy nguồn trên lưới |
|---|---|---|---|---|
| (19) % đánh giá KPI | Khối BO tự tính = công ÷ chuẩn; khối KD HR gõ; gõ đè được | Ô (19) | 1 và N ("Nhập cho nhiều người") | Có |
| (21) Giờ làm thêm ngày thường | Ô nhập | Ô (21) | 1 | Có |
| (24) Thu nhập khác | Ô nhập (nhiều dòng, có thuế + lý do) | Ô (24) | 1 và N (thêm dòng) | Có |
| (32) riêng tháng này | Ô nhập (nhiều dòng) | Ô (32) | 1 và N (thêm dòng) | Có |
| Tiền phép chưa nghỉ khi nghỉ việc | Tự tính, HR gõ đè | Ô trên dòng người nghỉ | 1 | Có |
| Truy lĩnh / truy thu | Tự tính từ tháng đã duyệt; HR "Bỏ ra" hoặc gõ số khác, có lý do | Bảng truy lĩnh trên lưới | 1 và N (chọn nhiều khoản) | Có |

### 4.4 Cấu hình (có mặc định, đổi cho tất cả từ một tháng; nhiều mục đổi riêng từng người)

| Tham số | Mặc định | HR sửa ở đâu | Cho ai | Thấy nguồn trên lưới |
|---|---|---|---|---|
| Thuộc tính từng khoản lương: cách thuế, tính BH, chia theo ngày công, nhân tỷ lệ thử việc, lương theo HĐ, vào lương làm thêm, mức mặc định | Theo file tháng 10 | Cấu hình › Khoản lương | TC, 1, N | Có |
| **Danh sách khoản lương** (thêm, đổi tên, ngừng một khoản) | 7 khoản như file | **Chưa có trên màn hình** (F24) | – | – |
| Thuộc tính từng loại HĐ: đóng BH, cách thuế, HĐ dưới 3 tháng, số ngày thử việc, cam kết thuế kèm HĐ | Theo file | Cấu hình › Loại HĐ | TC, 1, N | Có |
| **Danh sách loại HĐ** (thêm, đổi tên) | 3 loại như file | **Chưa có trên màn hình** (F24) | – | – |
| Lương cơ sở, lương tối thiểu vùng, trần đóng BH | Theo luật | Cấu hình › Bảo hiểm | TC | Có ở (27) |
| Vùng lương tối thiểu của từng khu vực | Vùng I | Cấu hình › Bảo hiểm (mới thêm) | TC theo khu vực | Có ở (27) |
| Tỷ lệ BH người lao động 8% / 1,5% / 1%; BH công ty 17,5% / 3% / 1% | Theo luật | Cấu hình › Bảo hiểm | TC | Có ở (28)–(30), (43)–(45) và trên tiêu đề cột |
| KPCĐ 2% (đang TẮT như file), đoàn phí 0,5% | Tắt / theo luật | Cấu hình › Bảo hiểm | TC, 1, N | Có ở (46), (31); Rà soát báo vàng |
| BHYT tháng không đóng BHXH; quy tắc 14 ngày; vẫn đóng BH khi nghỉ từ 14 ngày | Theo file + luật | Cấu hình › Bảo hiểm | TC (quy tắc 14 ngày), còn lại TC, 1, N | Có ở (27)–(30) |
| Giảm trừ bản thân 15,5 triệu, người phụ thuộc 6,2 triệu; biểu thuế | Theo luật | Cấu hình › Thuế | TC | Có ở (35), (36), (40) |
| Trần tiền ăn miễn thuế; trần trang phục 5 triệu / năm | Theo luật + file | Cấu hình › Thuế | TC | Có ở (33) |
| Khấu trừ 10%: tỷ lệ, ngưỡng 5 triệu, cơ sở tính; cam kết thuế; trả sau ngày nghỉ việc | Theo luật | Cấu hình › Thuế | TC, 1, N | Có ở (40) |
| Miễn thuế làm thêm; tiền phép khi nghỉ việc | Theo luật | Cấu hình › Thuế | TC, 1, N | Có |
| Tỷ lệ lương thử việc 90% (không thấp hơn 85%) | Theo file | Cấu hình › Quy tắc | TC, 1, N | Có ở (18), (19) |
| % KPI theo khối (BO công thức, KD HR gõ); KPI người chính thức có chia theo ngày công không; % KPI tháng lên chính thức | Theo file | Cấu hình › Quy tắc | TC, 1, N | Có ở (19), (20) |
| Gross thoả thuận gồm KPI 100% | Có | Cấu hình › Quy tắc | TC | Có ở (16) |
| Giờ một ngày 8; hệ số làm thêm 150 / 200 / 300% (không thấp hơn luật); giờ mỗi công ngày nghỉ; làm Chủ nhật; giới hạn 40 giờ tháng, 200 giờ năm | Theo luật | Cấu hình › Quy tắc | TC, 1, N (giới hạn giờ: TC) | Có ở (25) |
| Ngày chi trả (ngày 05 tháng sau) | Theo quyết định K1 | Cấu hình › Quy tắc | TC từ một tháng | Có (đầu trang, hộp Duyệt) |
| Làm tròn; thứ tự dòng; người lập tự duyệt; tháng đầu trên web; loại mặc định của khoản (32) | Theo file / quy chế | Cấu hình › Quy tắc | TC | Một phần |
| Số ngày thử việc tối đa theo luật | Theo luật | Cấu hình › Quy tắc | TC | Rà soát báo khi vượt |
| Tên công ty, địa chỉ, 3 chức danh ký trên Excel | Cố định trong code | **Không sửa được** | TC | – |

**Tham số HR không thấy hoặc không đổi được trên màn hình:** danh sách khoản lương, danh sách loại HĐ (F24
phần 2); kỳ công 26 → 25; tên / địa chỉ công ty và chức danh ký trên Excel; mức lương cho nhiều người một
lần (chỉ sửa từng người).

## 5. Việc còn lại cho chủ dự án

1. **Chốt F24 phần 2** — thêm / đổi tên / ngừng khoản lương và loại HĐ trên màn hình. Code cần 3 quyết định: khoản mới
   đánh số cột nào trên Excel; cho xoá hay chỉ ngừng; ai được thêm.
2. **Khởi động lại API dev** để thấy mức mặc định mới ở form hồ sơ mới (F12, BA mới đọc diff).
3. **HR sửa dữ liệu** ở mục 3 (mã dòng 10, Chức danh, email + số tài khoản, 2 hồ sơ lương còn thiếu).
4. **Để sau, việc nhỏ:** tên từng khoản định kỳ trong ô (32) và trong danh sách Hồ sơ lương; phân biệt cam kết Kèm HĐ /
   Ký riêng ở danh sách; sửa / xoá dòng (24), (32) cho nhiều người; mức lương cho nhiều người; bỏ mã Dnn ở sheet
   "Tham số" và nhật ký cũ.
5. **Chưa kiểm được trong lượt này:** truy lĩnh / truy thu và Duyệt → Đã chuyển khoản → Mở lại trên màn hình thật (BA
   chỉ được xem, không được bấm Duyệt). Nên thử trên bản dev khi chạy song song tháng 11.
6. Các câu còn mở từ lần rà trước vẫn nguyên: khoản cộng không rõ nguồn ở dòng 12, thuế của phần truy lĩnh.
