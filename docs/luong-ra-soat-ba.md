# Rà soát nghiệp vụ bảng lương (BA độc lập) và đối chiếu luật

Ngày rà soát: 10/11/2026. Người đọc: chủ dự án (không cần biết kế toán).
Phạm vi: file lương tháng 10/2026 của HR (12 dòng), phần tính lương trong code (`HR-payroll`, chưa commit), spec `spec-luong.md`.
Trong tài liệu này không có tên, mã hay số tiền của người thật; mỗi người được gọi bằng số dòng trong file (dòng 1–12). Ví dụ bằng số đều là số tự đặt.

Cách làm:

1. Tự tính lại từng cột tiền (16)–(48) của 12 dòng bằng một script riêng, không dùng code của dự án, để biết file đang theo quy tắc nào.
2. Chạy code thật của dự án trên chính 12 dòng đó, ở hai chế độ: "như file HR" và mặc định.
3. Tra văn bản luật trên mạng cho từng tham số trong code. Chỗ nào không đọc được nguyên văn thì ghi rõ.

---

## 1. Cần chủ dự án quyết

Xếp theo mức ảnh hưởng tới tiền. Cột "Đề xuất" là ý kiến của người rà soát; code chưa đổi ở các mục này.

| # | Việc cần quyết | Vì sao | Đề xuất |
|---|---|---|---|
| Q1 | **4 người thử việc đang làm (dòng 7, 9, 10, 12) có bản cam kết thuế không?** | File không trừ thuế 4 người này dù mỗi lần chi từ 5 triệu. Luật: HĐ dưới 3 tháng, chi từ 5 triệu/lần thì trừ 10%, trừ khi người đó ký cam kết. Web mặc định "chưa có cam kết" nên tháng 11 sẽ trừ 10% thu nhập của từng người | Thu bản cam kết của từng người trước khi chạy lương T11 và nhập vào Hồ sơ lương. Ai không đủ điều kiện ký thì để web trừ 10% |
| Q2 | **Khoản ở cột (32) của dòng 4 và dòng 6 là gì?** | Số tiền đúng bằng phần BH mà hai người này phải đóng, tức công ty trả thay. File cộng vào thực nhận nhưng không tính vào thu nhập chịu thuế và không tính vào chi phí. Nếu đúng là công ty trả thay BH thì đây là thu nhập chịu thuế | Nhập là "Hỗ trợ" (chịu thuế, vào chi phí), đúng mặc định của web. Tháng 10 hai người này chưa tới mức nộp thuế nên tiền thuế không đổi, nhưng số kê khai đổi. Gọn hơn: tăng lương thoả thuận lên đúng phần đó |
| Q3 | **Dòng 12: khoản cộng vào Thu nhập thực tế không đến từ cột nào** | Cột (26) lớn hơn (18) × (17) + (20). Phần chênh khớp đúng với giả thuyết "mấy ngày cuối kỳ đã trả mức chính thức 100%", nhưng cột (33) miễn thuế lại không tính theo. File không ghi lý do | Hỏi HR. Nếu là lên chính thức giữa kỳ: nhập ngày chính thức, web tự tách đoạn (và tháng đó có thể phải đóng BH). Nếu là khoản khác: nhập vào "Thu nhập khác" có lý do |
| Q4 | **Người đã nghỉ việc mà có cam kết thuế: trừ 10% hay không?** | Code hiện xét "đã nghỉ việc" trước "có cam kết", nên có cam kết vẫn bị trừ 10%. Câu về cam kết trong NĐ 253 Đ.50 k2 áp cho mọi người thuộc diện 10% | Cho cam kết thắng: có cam kết hợp lệ thì không trừ, kể cả đã nghỉ. Việc sửa nhỏ nhưng đổi bộ test mẫu nên cần chủ dự án đồng ý |
| Q5 | **Trả lương lần cuối cho người nghỉ việc vào ngày nào?** | BLLĐ Đ.48 k1: thanh toán đủ trong 14 ngày làm việc từ ngày chấm dứt HĐ. Web chỉ có một ngày trả cho cả tháng (ngày 05 tháng sau). Người nghỉ đầu tháng sẽ quá hạn. Ngoài ra vì trả sau ngày nghỉ, mọi lần chi cuối từ 5 triệu đều bị trừ 10% trên toàn bộ thu nhập, kể cả nhân viên lâu năm | Cho phép ngày chi trả riêng cho người nghỉ việc (làm ở bước Duyệt). Báo trước cho nhân viên nghỉ việc biết khoản 10% này sẽ được hoàn khi họ tự quyết toán |
| Q6 | **KPCĐ 2% đang tắt** | Luật Công đoàn 2024 Đ.29: doanh nghiệp đóng 2% quỹ lương đóng BHXH, không phụ thuộc đã có công đoàn cơ sở hay chưa. NĐ 105/2026 (hiệu lực 16/5/2026) giữ nguyên. Không đóng có thể bị truy thu và phạt | Bật D03 từ T11/2026, hoặc có văn bản của công ty ghi lý do chưa đóng. Với quỹ lương đóng BH hiện tại, số tiền mỗi tháng nhỏ so với rủi ro |
| Q7 | **Thưởng Tết / tháng 13** | Spec để ngoài phạm vi. Tết 2027 rơi vào đầu tháng 2, tức sẽ chi trong tháng 1/2027 | Quyết trước 15/12: (a) trả chung với lương tháng, nhập vào "Thu nhập khác" chịu thuế, web làm được ngay; hoặc (b) trả riêng một đợt, cần thêm tính năng "đợt chi ngoài kỳ" |
| Q8 | **"Xăng xe + ĐT" miễn thuế toàn bộ (K2), chuyên cần và nhà ở không đóng BH (K3)** | Đã chốt 09/11 theo file. Người rà soát chỉ nhắc lại rủi ro: phần xăng xe trả cố định không nằm trong danh mục miễn của NĐ 253 Đ.8; phần lớn thu nhập nằm ở phụ cấp, lương đóng BH chỉ nhỉnh hơn lương tối thiểu vùng, cơ quan BHXH có thể xếp lại khi thanh tra | Giữ như đã chốt, nhưng cần có **quy chế lương bằng văn bản** ghi mức và điều kiện từng khoản (chuyên cần mất khi nghỉ không phép, mức khoán điện thoại, trang phục). Không có quy chế thì cả hai điểm đều yếu |
| Q9 | **BH tháng vào / nghỉ giữa tháng (K4)** | Không đọc được điều khoản tương ứng trong QĐ 366/QĐ-BHXH (xem mục 6). Cách đếm của web đóng nhiều tháng hơn cách HR vẫn làm | Hỏi cơ quan BHXH quản lý công ty một lần bằng văn bản, rồi chỉnh `quy-tac.dem-ngay-bh` theo câu trả lời |
| Q10 | **Lương thử việc so với lương tối thiểu vùng** | Web chỉ so lương thời gian 100% với lương tối thiểu vùng, không so mức 90% của người thử việc. Khi lương tối thiểu vùng tăng, mức thử việc có thể tụt dưới sàn mà không có cảnh báo | Thêm cảnh báo vàng "lương thời gian × tỷ lệ thử việc dưới lương tối thiểu vùng" |

---

## 2. Kết quả chính

- Chế độ "như file HR" của code tính ra **đúng mọi ô tiền của 12 dòng** trong file T10 (lệch không quá 1 đồng), trừ hai chỗ mà chính file không theo quy tắc của nó: cột (16) ở 4 dòng và khoản cộng ở dòng 12.
- Chế độ mặc định khác file ở đúng 3 nhóm, đều có lý do luật: thuế 10% của người thử việc (Q1), khoản (32) (Q2), làm tròn dòng tổng (lệch 1 đồng).
- Các tham số luật trong code **khớp với văn bản hiện hành**: lương tối thiểu vùng, lương cơ sở, tỷ lệ BH, trần BH, giảm trừ gia cảnh, biểu thuế 5 bậc, ngưỡng 10%, tiền ăn, trang phục, thử việc, làm thêm, KPCĐ. Các văn bản mới mà spec dẫn (NĐ 253/2026, NĐ 161/2026, NĐ 105/2026, QĐ 366/QĐ-BHXH, Luật 109/2025/QH15, NQ 110/2025/UBTVQH15, NĐ 293/2025) **đều có thật**.
- Không tìm thấy công thức sai trong engine. Các chỗ thiếu nằm ở phần API đang làm dở (mục 5.1).

---

## 3. So từng cột: file đang làm gì, code làm gì

"File" = quy tắc file T10 thực sự theo (tự tính lại, khớp 12/12 dòng trừ chỗ ghi khác). "Như file" và "Mặc định" là hai chế độ của code.

### 3.1 Quy tắc từng cột

| Cột | Quy tắc file đang theo | Như file | Mặc định | Ghi chú |
|---|---|---|---|---|
| (16) Gross | Tổng các khoản (8)–(14) + KPI 100%. **4 dòng (5, 6, 10, 12) quên cộng KPI** | Luôn cộng KPI | Như bên trái | Chỉ để xem, không ảnh hưởng tiền. Code đúng |
| (18) Lương 1 ngày | Tổng (8)–(14) × 90% nếu thử việc ÷ công chuẩn (22 HCM, 24 HN) | Giống | Giống | 12/12 |
| (19) % KPI | Khối BO: công ÷ chuẩn, × 90% nếu thử việc. Khối KD: HR tự cho (0%, 80%, 100%) | Lấy số HR gõ | BO tự tính, KD HR gõ | 12/12 |
| (20) Thưởng hiệu suất | KPI 100% × (19), dùng % chưa làm tròn | Giống | Giống | 12/12 |
| (26) Thu nhập thực tế | (18) × (17) + (20) + (24) + (25). **Dòng 12 có thêm một khoản không rõ nguồn** | Giống, khoản lạ phải nhập vào (24) | Giống | Q3 |
| (27) Lương đóng BH | = Lương thời gian với người chính thức; trống với thử việc | Giống | Lương thời gian + PC trách nhiệm | PC trách nhiệm đang là 0 ở cả 12 dòng nên chưa lệch |
| (28)–(30) BH người lao động | 8% / 1,5% / 1% × (27). Dòng 5 (nghỉ việc giữa tháng, 9,5 công) chỉ đóng BHYT | Giống | Giống | Dòng 5: xem 3.3 |
| (31) Đoàn phí | Trống | 0 | 0 (không ai là đoàn viên) | – |
| (32) Hỗ trợ / hoàn ứng / tạm ứng | Dòng 4 và 6: đúng bằng tổng BH người đó đóng; cộng vào thực nhận | Nhập là "hoàn ứng" | Nhập là "hỗ trợ": chịu thuế, vào chi phí | Q2 |
| (33) Miễn thuế | (Tiền cơm + Xăng xe/ĐT + Trang phục) × 90% nếu thử việc × công ÷ chuẩn, làm tròn tới đồng | Giống | Cơm miễn tới 1,2 triệu/tháng, trang phục tới 5 triệu/năm, xăng xe + ĐT miễn hết | Mức cơm trong file đúng bằng trần nên chưa lệch |
| (34) Chịu thuế | (26) − (33) | Giống | (26) + Hỗ trợ − (33) | Lệch ở dòng 4, 6 (Q2) |
| (35)–(37) Giảm trừ | 15,5 triệu bản thân; 0 người phụ thuộc; (37) = (28)+(29)+(30) | Giống | Giống | – |
| (38) Tính thuế | MAX(0, (34) − (35) − (36) − (37)) | Giống | Giống | Chỉ dòng 2 có số dương |
| (40) Thuế | Chính thức: lũy tiến (dòng 2 ở bậc 5%). Thử việc: **chỉ dòng 8 (đã nghỉ việc) bị trừ 10% × (26)**; 4 dòng thử việc còn lại không trừ | Giống (coi 4 người kia có cam kết) | Trừ 10% cả 5 dòng thử việc nếu chưa nhập cam kết | Q1 |
| (41) Tổng khấu trừ | (28)+(29)+(30)+(31)+(40) | Giống | Giống | – |
| (42) Thực nhận | (26) − (41) + (32) | Giống | Giống | – |
| (43)–(45) BH công ty | 17,5% / 3% / 1% × (27); dòng 5 chỉ BHYT | Giống | Giống | – |
| (46) KPCĐ | Trống | 0 | 0 (D03 tắt) | Q6 |
| (47) | (43)+(44)+(45)+(46) | Giống | Giống | – |
| (48) Tổng chi phí | (26) + (47). Không gồm khoản (32) | Giống | (26) + Hỗ trợ + (47) | Lệch ở dòng 4, 6 (Q2) |
| Dòng tổng | Cộng số lẻ ẩn rồi mới làm tròn: (26), (34), (48) lệch 1 đồng so với cộng các ô đang hiện | Giống | Cộng các ô đã tròn | Cách mặc định đúng hơn: tổng thực nhận = tổng chuyển khoản |

### 3.2 Mọi chỗ khác nhau

| # | Cột | Dòng | File làm | Code làm | Ai đúng theo luật |
|---|---|---|---|---|---|
| 1 | (40), (41), (42) | 7, 9, 10, 12 | Không trừ thuế | Mặc định: trừ 10% × (26) khi chưa có cam kết. Như file: không trừ | **Code đúng nếu không có cam kết; file đúng nếu có.** NĐ 253/2026 Đ.50 k2. Chênh lệch bằng 10% thu nhập của từng người |
| 2 | (34), (48) | 4, 6 | Khoản (32) không chịu thuế, không vào chi phí | Mặc định: chịu thuế, vào chi phí | **Code**, nếu đó là tiền công ty trả thay BH: mọi khoản lợi ích người lao động nhận từ công ty là thu nhập từ tiền lương (NĐ 253 Đ.8). Nếu là hoàn tiền người đó đã ứng cho công ty, có chứng từ, thì file đúng |
| 3 | (26) | 12 | Cộng thêm một khoản không có cột nguồn | Không tự cộng; HR phải nhập có lý do | Code: khoản nào cũng phải có tên và lý do |
| 4 | (16) | 5, 6, 10, 12 | Thiếu KPI 100% | Luôn gồm KPI | Không phải vấn đề luật; code nhất quán |
| 5 | Dòng tổng (26), (34), (48) | – | Lệch 1 đồng so với tổng ô hiển thị | Mặc định không lệch | Không phải vấn đề luật |
| 6 | (27) | – (chưa xảy ra) | Chỉ lương thời gian | Mặc định thêm PC trách nhiệm | Code: phụ cấp trách nhiệm là phụ cấp lương, phải đóng BH (Luật BHXH 2024 Đ.31; NĐ 158/2025 Đ.7). Hiện chưa ai có khoản này |
| 7 | (28), (30), (43), (45) | 5 (nếu ngày nghỉ khác đi) | Nghỉ giữa tháng, làm dưới nửa tháng: chỉ BHYT | Mặc định: đếm ngày **không** hưởng lương trong tháng dương lịch; từ 14 ngày thì không đóng BHXH, BHTN | Hai cách cho cùng kết quả ở dòng 5. Sẽ khác khi ai đó nghỉ quanh giữa tháng: xem Q9 |
| 8 | (46) | mọi dòng chính thức | Không tính | Mặc định không tính (D03 tắt) | **Cả hai chưa theo luật**: Q6 |

Lưu ý về cách chạy: file không có ngày vào, ngày nghỉ. Để chạy code, người rà soát tự đặt ngày nghỉ cho dòng 5 và dòng 8 sao cho khớp số công. Kết luận ở bảng trên không phụ thuộc ngày cụ thể, trừ dòng 7 của bảng.

### 3.3 Nhận xét về chính file T10 (không liên quan code)

| Điều thấy | Mức |
|---|---|
| 4 người thử việc nhận từ 5 triệu không bị trừ 10%: cần bản cam kết của từng người trong hồ sơ, nếu không công ty là bên chịu phạt khấu trừ thiếu | Cao |
| Khoản (32) của 2 dòng không được kê là thu nhập | Trung bình |
| KPCĐ 2% không trích | Trung bình |
| Lương đóng BH của mọi người chính thức bằng nhau và chỉ gồm lương thời gian; nhà ở, chuyên cần, xăng xe, KPI nằm ngoài. Hợp lệ khi có quy chế chứng minh tính chất từng khoản | Trung bình (rủi ro thanh tra) |
| Dòng 12 có khoản cộng không ghi lý do | Thấp về tiền, cao về khả năng giải trình |
| Tiền cơm đúng bằng trần miễn thuế mới 1,2 triệu: đúng luật từ 01/7/2026 | Tốt |
| Thử việc 90% trên mọi khoản, không đóng BH (HĐ thử việc riêng): đúng luật | Tốt |

---

## 4. Đối chiếu luật các tham số trong code

Cột "Xác minh": **Nguyên văn** = đọc được câu chữ của điều khoản; **Nhiều nguồn** = nhiều bài tổng hợp độc lập ghi giống nhau, không đọc được nguyên văn; **Chưa** = không xác minh được.

| Tham số | Code đang dùng | Luật hiện hành (11/2026) | Xác minh | Kết luận |
|---|---|---|---|---|
| Lương tối thiểu vùng I | 5.310.000 từ 01/01/2026 (II 4.730.000; III 4.140.000; IV 3.700.000) | NĐ 293/2025/NĐ-CP Đ.3. [luatvietnam](https://luatvietnam.vn/lao-dong/nghi-dinh-293-2025-nd-cp-ve-muc-luong-toi-thieu-cho-nguoi-lao-dong-hop-dong-418212-d1.html) | Nhiều nguồn | Khớp |
| Lương cơ sở (= mức tham chiếu) | 2.340.000; 2.530.000 từ 01/7/2026 | NĐ 73/2024/NĐ-CP Đ.3; NĐ 161/2026/NĐ-CP (15/5/2026) Đ.3. [luatvietnam](https://luatvietnam.vn/lao-dong/nghi-dinh-161-2026-nd-cp-quy-dinh-muc-luong-co-so-va-che-do-tien-thuong-cho-can-bo-cong-chuc-434784-d1.html), [Tạp chí Công Thương](https://tapchicongthuong.vn/chinh-thuc-tang-luong-co-so-len-2-530-000-dong-thang-tu-01-7-2026-518417.htm) | Nhiều nguồn | Khớp. Đã sửa dòng ghi nguồn trong code (mục 7) |
| Trần lương đóng BHXH, BHYT | 20 × lương cơ sở = 50,6 triệu từ 7/2026 | Luật BHXH 2024 Đ.31 k1 đ: "thấp nhất bằng mức tham chiếu và cao nhất bằng 20 lần mức tham chiếu tại thời điểm đóng"; Đ.141 k13: mức tham chiếu bằng lương cơ sở. [dhtaxlaw](https://dhtaxlaw.com.vn/muc-dong-bhxh-2026-thap-nhat-theo-luong-toi-thieu-vung-hay-luong-co-so) | Nhiều nguồn | Khớp |
| Sàn lương đóng BHXH | Lương tối thiểu vùng | Luật ghi sàn là mức tham chiếu (2,53 triệu). Nhưng lương theo công việc không được thấp hơn lương tối thiểu (BLLĐ Đ.90 k2: "Mức lương theo công việc hoặc chức danh không được thấp hơn mức lương tối thiểu"), nên với người làm đủ thời gian sàn thực tế là lương tối thiểu vùng | Nguyên văn (BLLĐ); nhiều nguồn (Luật BHXH) | Chấp nhận được. Nếu sau này có người làm bán thời gian, code sẽ kéo lương đóng BH lên lương tối thiểu vùng, cao hơn luật yêu cầu: khi đó cần sửa |
| BHXH | NLĐ 8%; công ty 17,5% (14% hưu trí + 3% ốm đau, thai sản + 0,5% tai nạn lao động) | Luật BHXH 2024 Đ.33, Đ.34; NĐ 58/2020 Đ.4 (0,5%) | Nhiều nguồn (tỷ lệ không đổi nhiều năm) | Khớp |
| BHYT | NLĐ 1,5%; công ty 3% | Luật BHYT sửa 2024; NĐ 188/2025 Đ.6: 4,5%, chia 2/3 – 1/3 | Nhiều nguồn; không đọc được nguyên văn NĐ 188/2025 | Khớp |
| BHTN | NLĐ 1%; công ty 1%; trần 20 × lương tối thiểu vùng (vùng I: 106,2 triệu) | Luật Việc làm 2025 Đ.33, Đ.34: lương đóng "cao nhất bằng 20 lần mức lương tối thiểu tháng theo vùng"; NĐ 374/2025 Đ.4: NLĐ 1%. [lsvn](https://lsvn.vn/muc-dong-bao-hiem-that-nghiep-tu-01-01-2026-a164174.html) | Nhiều nguồn | Khớp |
| HĐ thử việc riêng không đóng BH | Loại HĐ "thử việc": không BH | NĐ 158/2025/NĐ-CP Đ.3 k5: người làm việc theo hợp đồng thử việc theo pháp luật lao động không thuộc đối tượng tham gia BHXH bắt buộc. Thử việc ghi chung trong HĐLĐ từ 1 tháng thì phải đóng. [luatvietnam](https://luatvietnam.vn/tin-van-ban-moi/chinh-thuc-hop-dong-thu-viec-khong-phai-dong-bao-hiem-xa-hoi-186-102706-article.html) | Nhiều nguồn | Khớp. HR cần chắc là mỗi người thử việc ký **HĐ thử việc riêng** |
| Giảm trừ gia cảnh | 15.500.000 / 6.200.000, cả năm 2026 | NQ 110/2025/UBTVQH15 Đ.1, áp từ kỳ tính thuế 2026. [thuvienphapluat](https://thuvienphapluat.vn/phap-luat/chinh-thuc-nang-giam-tru-gia-canh-len-155-trieuthang-ap-dung-tu-ky-tinh-thue-2026-237231.html) | Nhiều nguồn | Khớp |
| Biểu thuế lũy tiến | 5 bậc: tới 10 triệu 5%; 10–30 triệu 10%; 30–60 triệu 20%; 60–100 triệu 30%; trên 100 triệu 35% | Luật Thuế TNCN 109/2025/QH15 Đ.9; Đ.29 k2: tiền lương của cá nhân cư trú áp từ kỳ tính thuế 2026. [thuviennhadat](https://thuviennhadat.vn/phap-luat/bieu-thue-tncn-2026-5-bac-chi-tiet-bieu-thue-tncn-5-bac-ap-dung-tu-1-1-hay-1-7-2026-729703.html), [luatvietnam](https://luatvietnam.vn/thue/luat-thue-thu-nhap-ca-nhan-2025-so-109-2025-qh15-422733-d1.html) | Nhiều nguồn | Khớp |
| NĐ 253/2026/NĐ-CP có thật không | Spec dẫn nhiều điều | Có: ban hành 30/6/2026, hiệu lực 01/7/2026, thay NĐ 65/2013; kèm TT 87/2026/TT-BTC. [Công báo (PDF)](https://congbaocdn.chinhphu.vn/180507251028987904/2026/7/16/469959-1784171413_v1_1784174315_signed.pdf), [Forvis Mazars](https://www.forvismazars.com/vn/vi/n-ph-m-s-ki-n/c-p-nh-t-v-vi-t-nam/b-n-tin-thong-bao-chuyen-mon/b-n-tin-v-thu-va-phap-ly/ngh-d-nh-253-va-thong-t-87-v-thu-tncn) | Văn bản có thật; file Công báo tải được nhưng máy không đọc được chữ trong PDF | Xác nhận tồn tại |
| Ngưỡng khấu trừ 10% | 5.000.000/lần từ 01/7/2026 (trước đó 2.000.000) | NĐ 253 Đ.50 k2: chi cho cá nhân không ký HĐLĐ hoặc HĐ dưới 3 tháng "mà mức chi trả thu nhập từ 5 triệu đồng/lần trở lên thì phải khấu trừ thuế… theo tỷ lệ 10% trên thu nhập trước khi trả"; dưới 5 triệu chỉ trừ khi cá nhân yêu cầu; "Căn cứ vào cam kết của cá nhân, tổ chức trả thu nhập không khấu trừ thuế". [Tạp chí Kinh tế Tài chính](https://thuehaiquan.tapchikinhtetaichinh.vn/huong-dan-khau-tru-10-thue-tncn-voi-khoan-chi-tu-5-trieu-dong-lan-168499.html) | Nguyên văn (trích qua bài báo) | Khớp |
| 10% cho người đã chấm dứt HĐ (D10) | Mọi loại HĐ, khi chi sau ngày nghỉ và từ 5 triệu | NĐ 253 Đ.50 k2 gồm cả trường hợp trả cho người lao động đã chấm dứt HĐLĐ; cơ quan thuế Ninh Bình, Phú Thọ hướng dẫn: kể cả người từng có HĐ từ 3 tháng. [bài 1](https://thuehaiquan.tapchikinhtetaichinh.vn/huong-dan-khau-tru-thue-thu-nhap-ca-nhan-sau-khi-hop-dong-lao-dong-da-ket-thuc-166959.html), [hỏi đáp Bộ Tài chính](https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/164621) | Nhiều nguồn; câu trả lời của Bộ Tài chính là ảnh, không đọc được | Khớp. Hệ quả ở Q5 |
| Cơ sở tính 10% (D02) | (26) + Hỗ trợ, không trừ BH, giảm trừ, khoản miễn thuế | "10% trên thu nhập trước khi trả". Không văn bản nào đọc được nói có loại khoản miễn thuế ra hay không | Chưa (phần khoản miễn thuế) | Cách của code an toàn cho công ty (trừ dư thì người lao động được hoàn) |
| Tiền ăn giữa ca, ăn trưa | 730.000; 1.200.000 từ 01/7/2026 | NĐ 253 Đ.8 k2 g: chỉ tính vào thu nhập chịu thuế phần vượt 1,2 triệu đồng/người/tháng; Đ.69 k1 b: áp từ 01/7/2026 (Công văn 2231/CST-TN). [luatvietnam](https://luatvietnam.vn/tin-van-ban-moi/tu-01-7-2026-tien-an-giua-ca-khong-qua-12-trieu-dong-thang-khong-tinh-thue-tncn-186-111212-article.html) | Nhiều nguồn | Khớp |
| Trang phục bằng tiền | Miễn tới 5.000.000/người/năm | NĐ 253 Đ.8 k2 đ (khoán theo mức được trừ thuế TNDN); NĐ 320/2025/NĐ-CP Đ.10 k8 đ: phần vượt 05 triệu đồng/người/năm không được trừ. [MISA](https://sme.misa.vn/343613/phu-cap-trang-phuc-co-tinh-thue-tncn-khong/) | Nhiều nguồn | Khớp |
| Miễn thuế tiền làm thêm (D05) | Miễn toàn bộ tiền làm thêm trong 40 giờ/tháng, 200 giờ/năm | NĐ 253 Đ.26 k1: "Miễn thuế thu nhập cá nhân đối với tiền lương, tiền công làm việc ban đêm, làm thêm giờ tại nơi làm việc phù hợp với quy định về điều kiện và thời gian theo pháp luật về lao động"; k3: phần "vượt mức quy định của pháp luật thì… tính vào thu nhập chịu thuế". [VCCI, dẫn Thuế Đà Nẵng](https://vcci.com.vn/tin-tuc/cac-truong-hop-tien-luong-tien-cong-duoc-mien-thue-tncn) | Nguyên văn | Khớp. Lưu ý: nếu công ty trả hệ số cao hơn mức luật, hoặc tính làm thêm trên cả tiền cơm, xăng xe (code đang tính trên mọi khoản chia theo ngày), phần cao hơn mức luật có thể bị coi là chịu thuế. Có người hỏi Bộ Tài chính đúng điểm này ([165313](https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/165313)), câu trả lời là ảnh, không đọc được. T10 không ai làm thêm |
| Tiền phép chưa nghỉ khi nghỉ việc | Lương theo HĐ tháng trước ÷ công chuẩn × ngày còn; miễn thuế | BLLĐ Đ.113 k3; NĐ 145/2020 Đ.67 k3 (căn cứ là tiền lương theo HĐLĐ của tháng trước liền kề); miễn thuế: NĐ 253 Đ.26 k2 ("tiền lương, tiền công trả cho những ngày không nghỉ phép… theo quy định tại khoản 3 Điều 113 của Bộ luật Lao động") | Nguyên văn (Đ.26 k2); BLLĐ Đ.113 và NĐ 145 theo bản đã biết, trang nguồn bị cắt trước điều này | Khớp. Luật không ghi số chia; dùng công chuẩn là hợp lý |
| Hệ số làm thêm | 150% / 200% / 300%, không cho đặt thấp hơn | BLLĐ Đ.98 k1: ngày thường "ít nhất bằng 150%"; ngày nghỉ hằng tuần 200%; lễ 300% chưa kể lương ngày lễ. [BLLĐ 2019](https://hethongphapluat.com/bo-luat-lao-dong-2019.html) | Nguyên văn (điểm a); b, c theo bản đã biết | Khớp |
| Giới hạn làm thêm | 40 giờ/tháng, 200 giờ/năm | BLLĐ Đ.107 k2: "không quá 200 giờ trong 01 năm"; 40 giờ/tháng; 300 giờ cho một số ngành | Nguyên văn | Khớp |
| Lương thử việc | 90%, không cho đặt dưới 85% | BLLĐ Đ.26: "ít nhất phải bằng 85% mức lương của công việc đó" | Nguyên văn | Khớp |
| Thời gian thử việc tối đa | 180 / 60 / 30 ngày, 6 ngày làm việc | BLLĐ Đ.25 | Nguyên văn | Khớp |
| KPCĐ | 2% × quỹ lương đóng BHXH (đang tắt) | Luật Công đoàn 2024 Đ.29; NĐ 105/2026/NĐ-CP (31/3/2026, hiệu lực 16/5/2026): chưa có công đoàn cơ sở vẫn đóng; được đóng theo quý. [toàn văn](https://hcc.nghean.gov.vn/tin-tong-hop/toan-van-nghi-dinh-105-2026-nd-cp-ve-quy-dinh-huong-dan-thi-hanh-tai-chinh-cong-doan-2664.html) | Nhiều nguồn | Tỷ lệ khớp; việc tắt là rủi ro (Q6) |
| Ngày trả lương | Ngày 05 tháng sau | BLLĐ Đ.97 k2: "Người lao động hưởng lương theo tháng được trả một tháng một lần hoặc nửa tháng một lần"; thời điểm do hai bên thoả thuận | Nguyên văn | Hợp lệ |
| Tạm ứng | Trừ ở cột (32) | BLLĐ Đ.101 k1: "Người lao động được tạm ứng tiền lương theo điều kiện do hai bên thỏa thuận và không bị tính lãi" | Nguyên văn | Hợp lệ |

Điểm mới của luật mà spec và code **chưa nhắc tới**: NĐ 253 Đ.49 k2 cho giảm trừ thêm chi phí y tế (tới 23 triệu/năm) và giáo dục (tới 24 triệu/năm), có hoá đơn ([MISA](https://sme.misa.vn/349075/nghi-dinh-253-ve-thue-tncn/)). Không đọc được là giảm trừ hằng tháng hay chỉ khi quyết toán; nhiều khả năng là khi quyết toán. Ghi nhận cho spec quyết toán năm.

---

## 5. Lỗ hổng nghiệp vụ

### 5.1 Chỗ thiếu trong code đang làm dở (phải xong trước tháng lương thật đầu tiên hoặc thứ hai)

| # | Chỗ thiếu | Hậu quả | Khi nào gặp |
|---|---|---|---|
| L1 | Số cộng dồn trong năm (trang phục đã miễn thuế, giờ làm thêm đã trả) chỉ lấy từ "số dư đầu năm" HR nhập, **không cộng các tháng đã chạy trên web** (`payroll-month-input.ts`, hai dòng `…Before`) | Trần 5 triệu/năm và 200 giờ/năm tính thiếu từ tháng thứ hai trên web. Với mức trang phục hiện tại (dưới 5 triệu/năm) chưa ra số sai, nhưng sẽ sai khi mức tăng hoặc có làm thêm nhiều | T12/2026 |
| L2 | Tiền phép chưa nghỉ khi nghỉ việc: engine có hàm tính, API chưa gọi | Người nghỉ việc còn phép không được trả tự động; HR phải tự tính và gõ vào "Thu nhập khác" | Mỗi khi có người nghỉ còn phép (T10 có 2 người nghỉ, đều hết phép) |
| L3 | BH của ngày 26–31 luôn ở trạng thái "tạm": chưa có bước đọc lại khi kỳ công sau chốt | Mọi dòng có cảnh báo vàng mỗi tháng; trường hợp nghỉ không lương cuối tháng làm đổi kết quả 14 ngày sẽ không được điều chỉnh | T11/2026 |
| L4 | Truy lĩnh / truy thu (bước 17) chưa làm | Sai sót phát hiện sau khi chuyển khoản không có chỗ sửa trên web | Tháng thứ hai |
| L5 | Chưa dùng: "người đó yêu cầu trừ 10% dưới ngưỡng", ước tính năm cho cam kết, "tháng đầu trở lại làm việc" (ngoại lệ BH khi ốm) | Engine có, API chưa truyền vào | Hiếm |

### 5.2 Việc thật mà spec và code chưa có, xếp theo mức gấp

| Hạng | Việc | Hiện trạng | Đề xuất |
|---|---|---|---|
| 1 | **Chi lần cuối cho người nghỉ việc ngoài kỳ** (14 ngày làm việc, BLLĐ Đ.48) | Một ngày chi cho cả tháng | Ngày chi riêng theo người (Q5) |
| 2 | **Chứng từ khấu trừ thuế** cho người bị trừ 10% và người nghỉ việc | Không có | Tối thiểu: báo cáo theo người gồm thu nhập, thuế đã trừ, để kế toán lập chứng từ điện tử |
| 3 | **Thưởng Tết / tháng 13** | Ngoài phạm vi | Q7 |
| 4 | **Số liệu kê khai thuế tháng / quý và quyết toán năm** (hạn cuối tháng 3/2027): tổng theo người cả năm, danh sách người có cam kết, người phụ thuộc kèm mã số thuế, giảm trừ y tế, giáo dục mới | Ngoài phạm vi; Tổng quan năm mới có tổng | Làm báo cáo "Tổng hợp năm theo người" trước tháng 2/2027 |
| 5 | **Người đóng BH không đủ ba quỹ**: người nước ngoài, người đã quá tuổi hưu, người đóng BH ở công ty khác | Loại HĐ chỉ có "đóng" hoặc "không đóng" | Thêm lựa chọn từng quỹ theo người khi có trường hợp đầu tiên |
| 6 | **Ốm đau, thai sản do BHXH trả** | Web xử lý đúng phần lương (không trả ngày đó, quy tắc 14 ngày, BHYT do quỹ đóng). Không có danh sách để làm hồ sơ hưởng | Báo cáo ngày ốm, thai sản theo người từ Chấm công |
| 7 | **Giới hạn khấu trừ lương** (BLLĐ Đ.102: trừ bồi thường không quá 30% lương thực trả hằng tháng) và thực nhận âm khi truy thu lớn | Có cảnh báo thực nhận âm, chưa có giới hạn 30% | Cảnh báo vàng khi truy thu + tạm ứng vượt 30% thực nhận |
| 8 | **Làm đêm** (thêm 30%, làm thêm ban đêm thêm 20%) | Không có | Bỏ qua tới khi có ca đêm |
| 9 | **File chuyển khoản ngân hàng, gửi phiếu lương qua email** | Ngoài phạm vi; HR làm tay như hiện nay | Giữ |
| 10 | **Người không cư trú** (thuế 20% trên toàn bộ), **trợ cấp thôi việc** | Không có | Bỏ qua tới khi phát sinh |

Các việc người giao nêu, đã được spec và engine xử lý đủ: vào / nghỉ giữa tháng (trả theo công ÷ chuẩn, BH theo 14 ngày), nghỉ không lương (qua ngày công), tạm ứng (cột (32)), làm tròn (D01), phiếu lương (bước 25; BLLĐ Đ.95 k3 yêu cầu phiếu ghi rõ lương, lương làm thêm, nội dung và số tiền khấu trừ: nên đối chiếu mẫu phiếu với câu này).

---

## 6. Không xác minh được

| Điểm | Vì sao | Ảnh hưởng |
|---|---|---|
| Nguyên văn đầy đủ NĐ 253/2026 (Đ.8, Đ.50, Đ.69) | thuvienphapluat chặn truy cập tự động; bản Công báo là PDF máy không trích được chữ. Các câu trích trong mục 4 lấy qua bài báo và trang VCCI | Thấp: số liệu chính (1,2 triệu, 5 triệu, 10%) nhiều nguồn ghi giống nhau |
| Hai câu trả lời của Bộ Tài chính (hỏi đáp 164621 về 10%, 165313 về làm thêm) mà spec dẫn | Phần trả lời là ảnh | Trung bình: cơ sở tính 10% (K5) và phần làm thêm trả cao hơn mức luật vẫn dựa trên suy luận |
| QĐ 366/QĐ-BHXH: quy tắc tháng vào / nghỉ giữa tháng, BHYT tháng báo giảm | Chỉ xác nhận được văn bản có thật (29/4/2026, thay QĐ 595 từ 01/5/2026, [luatvietnam](https://luatvietnam.vn/lao-dong/quyet-dinh-366-qd-bhxh-2026-quy-trinh-thu-bao-hiem-xa-hoi-y-te-that-nghiep-434265-d1.html)); không đọc được điều khoản | Trung bình: Q9 |
| Nguyên văn NĐ 188/2025 (BHYT), NĐ 158/2025 Đ.7 (khoản nào tính đóng BH), QĐ 61/QĐ-TLĐ (đoàn phí 0,5%) | Không tìm được bản đọc được | Thấp với tỷ lệ; trung bình với K3 (chuyên cần) |
| "Luật 09/2026/QH16 sửa Luật Thuế TNCN" | Một kết quả tìm kiếm nhắc tới, không nguồn nào khác xác nhận | Nếu có thật thì cần xem có đổi biểu thuế, giảm trừ không. Các nguồn tháng 7–10/2026 vẫn ghi 5 bậc và 15,5 / 6,2 triệu |
| Giảm trừ y tế, giáo dục: hằng tháng hay khi quyết toán | Nguồn chỉ ghi mức năm | Thấp cho lương tháng |

---

## 7. Đã sửa trong code

Chỉ sửa một lỗi nhỏ, rõ ràng. Viết test trước (đỏ), sửa, test xanh (14/14 trong `settings.test.ts`). Đã `git add`, chưa commit.

| File | Sửa gì |
|---|---|
| `packages/shared/src/payroll/defaults-law.ts` | Dòng nguồn của lương cơ sở 2.340.000 đang ghi "Mức trước NĐ 161/2026 (spec 5.8)", không phải văn bản luật → "NĐ 73/2024/NĐ-CP Đ.3". Dòng nguồn của trần BH đang ghi "spec 5.4" → "Luật BHXH 2024 Đ.31 k1 đ, Đ.141 k13; Luật BHYT Đ.14 k5; Luật Việc làm 2025 Đ.34 k2". Hai dòng này hiện trên tooltip, sheet "Tham số áp dụng" và bản chụp khi duyệt |
| `packages/shared/src/payroll/settings.test.ts` | Thêm 2 test: mọi tham số luật mặc định phải dẫn một văn bản luật và không dẫn spec; lương cơ sở trước 01/7/2026 dẫn NĐ 73/2024 |

Không đổi con số nào. Mọi điểm cần cân nhắc đã đưa vào mục 1, không sửa code.
