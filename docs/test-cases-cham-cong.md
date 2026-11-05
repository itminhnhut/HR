# Test case Chấm công

Đối chiếu với file Excel gốc của HR, vì tính năng này thay file đó để tính lương. Người trong tài liệu và test là ẩn danh (A, B, C…), số ô công là số thật của sheet.

## Ký hiệu

**Nguồn**

| Viết tắt | Nghĩa |
|---|---|
| T10 | Sheet `Tháng 10.26`, bản PDF HR gửi. Dòng 9–20, tổng ở cột AK–AU. |
| T11 | Sheet `Tháng 11.26`, trang Excel HR lưu ngày 05/11 và ảnh chụp công thức HR gửi. Dòng 9–19, tổng ở cột AL–AV. |
| QĐ | Quyết định của chủ dự án, ở những chỗ Excel không nói. |
| Suy luận | Không có trong Excel lẫn quyết định, QA suy ra. Cần chủ dự án xác nhận. |

Công thức dòng 9 của T11, dùng làm chuẩn:

- AL (thực tế) `= COUNTIF(1) + COUNTIF(M) + 0,5 × (COUNTIF(P/2) + COUNTIF(KL/2))`
- AR (chuẩn) `= IF(E9="HCM", G4, G5)`
- AS (hưởng) `= AL9 + MIN(AN9, AU9) + AQ9 − AT9`
- AT (OT) `= MAX(0, AL9 + MIN(AN9, AU9) + AQ9 − AR9)`
- AU (phép đầu) `= VLOOKUP(B9, 'Tháng 10.26'!B9:AU20, 46, FALSE)`
- AV (phép cuối) `= LET(cong, COUNTIF(1)+COUNTIF(M)+COUNTIF(P)+COUNTIF(P/2)+0,5×COUNTIF(KL/2), phep, IF(F9="Thử Việc", 0, AU9+IF(cong>=14,1,0)), MAX(0, phep−AN9))`
- Dòng 7 `= LET(bd, DATE(G2, G3−1, 26), kt, DATE(G2, G3, 25), SEQUENCE(1, kt−bd+1, bd))`

**Tự động**

| Viết tắt | File |
|---|---|
| GOLD | `packages/shared/src/timesheet-excel-golden.test.ts` |
| RULE | `packages/shared/src/timesheet-rules.test.ts` |
| CAL | `packages/shared/src/timesheet-calendar.test.ts` |
| A-GOLD | `apps/api/src/routes/hr-timesheet-golden.test.ts` |
| A-CHOT | `apps/api/src/routes/hr-timesheet-closing.test.ts` |
| A-NV | `apps/api/src/routes/hr-timesheet-people.test.ts` |
| XLSX | `apps/web/src/pages/hr/timesheet/exportExcel.test.ts` |

Cột **Loại**: tên file ở trên là test tự động, **TC** là kiểm thủ công. **GHI NHẬN** là test chỉ ghi lại hành vi hiện tại vì chưa ai chốt, cần chủ dự án quyết.

## Dựng lại số liệu T10

Tính lại 11 cột từ ô ngày trong PDF, cho từng người. 132 số thì 131 số khớp. Số còn lại (G, Hưởng lương) khớp khi tính điều chỉnh −0,5 mà HR ghi trong comment của ô đó.

| Người | Dòng | KV | Loại | Thực tế | Trễ | Phép | KL | KP | Lễ | Chuẩn | Hưởng | OT | Đầu | Cuối | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 9 | HCM | CT | 22 | 0 | 0 | 0 | 0 | 0 | 22 | 22 | 0 | 7,5 | 8,5 | |
| B | 10 | HCM | CT | 22 | 0 | 0 | 0 | 0 | 0 | 22 | 22 | 0 | 3 | 4 | |
| C | 11 | HCM | CT | 22 | 0 | 0 | 0 | 0 | 0 | 22 | 22 | 0 | 2 | 3 | |
| D | 12 | HCM | CT | 21 | 0 | 1 | 0 | 0 | 0 | 22 | 22 | 0 | 1 | 1 | |
| E | 13 | HCM | CT | 9,5 | 0 | 0,5 | 0 | 0 | 0 | 22 | 9,5 | 0 | 0 | 0 | Nghỉ việc 09/10 |
| F | 14 | HCM | CT | 19 | 1 | 3 | 0 | 0 | 0 | 22 | 20,5 | 0 | 0,5 | 0 | Công thức T11 cho 19,5 |
| G | 15 | HCM | TV | 21,5 | 0 | 0 | 0,5 | 0 | 0 | 22 | 21 | 0 | 0 | 0 | Tính ra 21,5, trừ tay 0,5 |
| H | 16 | HCM | TV | 15 | 2 | 0 | 0 | 0 | 0 | 22 | 15 | 0 | 0 | 0 | Nghỉ việc 15/10 |
| I | 17 | HCM | TV | 19,5 | 0 | 0 | 0,5 | 0 | 0 | 22 | 19,5 | 0 | 0 | 0 | Không có T7 nào |
| J | 18 | HCM | TV | 14 | 2 | 0 | 1 | 0 | 0 | 22 | 14 | 0 | 0 | 0 | Vào 07/10 |
| K | 19 | HN | CT | 24 | 0 | 0 | 0 | 0 | 0 | 24 | 24 | 0 | 6 | 7 | |
| L | 20 | HN | TV | 24 | 0 | 0 | 0 | 0 | 0 | 24 | 24 | 0 | 0 | 0 | Lên chính thức ở T11 |

T11 đến ngày 05/11 (số trong ảnh HR gửi, 11 người): khớp toàn bộ. A 9, B 10, C 9, D 10, F 8,5 (phép 0,5), G 9 → hưởng 8,5, I 9, J 8 (KL 1), N 10, K 10, L 9. Chuẩn HCM 25, HN 27. Phép đầu A 8,5, B 4, C 3, D 1, K 7, còn lại 0, đúng bằng phép cuối T10.

Các sheet khác: bản lưu chỉ có tên hai sheet này. Không có sheet tháng trước đó để đối chiếu.

## Tháng bình thường

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-BT-01 | T10 đủ 12 người | Chỉ nhập ngoại lệ và T7 | 11 cột khớp từng người, ô ngày khớp 240 ô, HR chỉ gõ 36 ô | T10 | GOLD |
| TC-BT-02 | T11 giữa kỳ, ngày 05/11 | Nhập ngoại lệ đến hôm nay | 11 người khớp, ô sau hôm nay còn trống | T11 | GOLD |
| TC-BT-03 | Xét ngày phép mới, biên 14 công | Nhập đủ loại mã quanh mốc 14 | 14 công được, 13,5 không. M, P, P/2 tính nguyên. KL/2 tính nửa. KL, KP, NL không tính | T11 AV9 | RULE |
| TC-BT-04 | Làm rất nhiều công | Nhập 26 ô | Vẫn chỉ +1 ngày phép | T11 AV9 | RULE |
| TC-BT-05 | Nhập T10 qua API rồi xem lại | Thêm người, nhập, xem kỳ | 12 người khớp mọi cột | T10 | A-GOLD |
| TC-BT-06 | Máy không lưu ô tự chấm | Xem dữ liệu đã lưu | Chỉ 36 ô HR gõ | QĐ | A-GOLD |
| TC-BT-07 | Chốt T10 | Bấm chốt | Số sau chốt y như trước chốt | T10 | A-GOLD |
| TC-BT-08 | Đi tiếp từ T10 sang T11 | Chốt T10, sửa L, thêm N, nhập T11 | Phép đầu lấy từ T10, 11 người khớp T11 | T10, T11 | A-GOLD |
| TC-BT-09 | Xem màn hình, nhập bằng bàn phím, dán nhiều ô | Dùng bảng công như HR | Số đổi ngay, F5 vẫn còn, cuối bảng khớp file tải | QĐ | TC |

## Người mới vào giữa kỳ

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-VG-01 | Ngày vào là ngày đầu tính công | Đặt ngày vào 03/11 | 02/11 trống, 03/11 là 1 | T10 dòng J | RULE |
| TC-VG-02 | Như J: vào 07/10 | Nhập ngoại lệ | Chuẩn vẫn 22, thực tế 14 | T10 dòng J | RULE |
| TC-VG-03 | Chính thức vào giữa kỳ, đủ 14 công | Nhập đủ | Được +1 phép | T11 AV9 | RULE |
| TC-VG-04 | Vào 05/10, 15 ngày T2–T6 | Không nhập gì | Thực tế 15, hưởng 15, phép cuối 1 | T11 AV9 | A-NV |
| TC-VG-05 | Vào 12/10, 10 ngày T2–T6 | Không nhập gì | Không có phép mới | T11 AV9 | A-NV |
| TC-VG-06 | Nhập trước ngày vào | Gõ vào ô 02/11 | Bị từ chối. Ngày vào thì nhận | QĐ | A-NV |
| TC-VG-07 | Vào đúng 25 và đúng 26 | Xem kỳ T11, T12 | Vào 25/11 có ở T11. Vào 26/11 chỉ có từ T12 | CT dòng 7 | A-NV |
| TC-VG-08 | Mới vào có phép đầu do HR gõ, sau khi kỳ trước đã chốt | Thêm người, gõ phép 4 | Phép đầu là 4 | QĐ | A-CHOT (TC-CK-04) |

## Người nghỉ việc giữa kỳ

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-NV-01 | Ngày nghỉ là ngày cuối tính công | Đặt ngày nghỉ 03/11 | 03/11 là 1, 04/11 trống | T10 dòng E, H | RULE |
| TC-NV-02 | Như E: nghỉ khi chưa đủ 14 | Đặt ngày nghỉ | Không có phép mới, giữ phép cũ | T11 AV9 | RULE |
| TC-NV-03 | E, H nghỉ trong T10 | Sang T11 | T11 không còn E, H, còn lại đủ | T11 | A-GOLD |
| TC-NV-04 | Nghỉ 09/10, còn 3 phép | Đặt ngày nghỉ | Chuẩn 22, hưởng 10, phép cuối 3 | T10 dòng E | A-NV |
| TC-NV-05 | Nhập sau ngày nghỉ | Gõ vào ô 04/11 | Bị từ chối | QĐ | A-NV |
| TC-NV-06 | Nghỉ đúng 25 và đúng 26 | Xem kỳ sau | Nghỉ 25/10 không có ở T11. Nghỉ 26/10 có ở T11 một ngày | CT dòng 7 | A-NV |
| TC-NV-07 | Đặt ngày nghỉ sau khi kỳ đã chốt | Sửa nhân viên | Kỳ đã chốt không đổi, kỳ sau vẫn nhận phép | QĐ | A-NV |
| TC-NV-08 | Nghỉ việc còn phép | Mở Rà soát & chốt | Có cảnh báo cần thanh toán phép | Suy luận | TC |

## Thử việc lên chính thức giữa kỳ

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-TV-01 | L thử việc T10, chính thức T11 | Sửa nhân viên sau khi chốt T10 | T10 vẫn thử việc, T11 chính thức | T10, T11 | A-GOLD |
| TC-TV-02 | Ngày chính thức 20/11 | Đặt ngày, loại vẫn thử việc | T10 thử việc, T11 chính thức cả kỳ, được +1 | QĐ | A-NV |
| TC-TV-03 | Ngày chính thức đúng 25 và 26 | Đặt ngày | 25/11 tính T11. 26/11 tính từ T12 | QĐ | A-NV |
| TC-TV-04 | HR chọn "Chính thức" và gõ ngày tương lai 10/11, T10 chưa chốt | Sửa nhân viên như form cho phép | T10 vẫn là thử việc, phép cuối 0 | QĐ | A-NV |
| TC-TV-05 | Phép qua lần đổi | Chốt T10, T11 | Thử việc 0, sang chính thức +1, T12 mở đầu 1 | QĐ, T11 AV9 | A-NV |
| TC-TV-06 | Nghỉ phép khi còn thử việc | Nhập P | Không trả lương ngày đó | T11 AV9 | A-NV |

## Đổi khu vực

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-KV-01 | HCM sang HN trong kỳ đang mở | Sửa khu vực | Chuẩn HN cho cả kỳ (27) | T11 AR9 | A-NV |
| TC-KV-02 | Đổi sau khi chốt T10 | Sửa khu vực | T10 giữ HCM, 22. T11 là HN, 27, phép giữ nguyên | QĐ | A-NV |
| TC-KV-03 | Kỳ đã sửa công chuẩn HN | Sửa khu vực | Dùng số HR đã sửa | QĐ | A-NV |
| TC-KV-04 | Khu vực mới thêm khi kỳ đã mở | Thêm khu vực, thêm người | Đầu file có định mức khu vực đó | Suy luận | A-NV |
| TC-KV-05 | Đổi khu vực khi T10 chưa chốt | Sửa khu vực ngày 03/11 | Chưa rõ: T10 hiện đổi theo vì không có ngày hiệu lực | Cần quyết định | TC |

## Hết phép mà vẫn nghỉ

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-HP-01 | Có 2 phép, nghỉ 3 | Nhập P | Trả 2, ngày vượt không trả, phép cuối 0 | T10 dòng F | RULE |
| TC-HP-02 | Như F: đầu 0,5, nghỉ 3 | Nhập P | Hưởng 20,5 theo số T10. Công thức T11 cho 19,5, xem mục mâu thuẫn | T10 dòng F | GOLD **GHI NHẬN** |
| TC-HP-03 | Thử việc nghỉ phép | Nhập P | Không trả lương | T11 AV9 | RULE |
| TC-HP-04 | Thử việc có phép đầu do gõ nhầm | Gõ phép 3 | Phép cuối về 0 | T11 AV9 | RULE |
| TC-HP-05 | Nghỉ không phép | Nhập KP | Không trả, không trừ phép | Bảng quy ước | RULE |
| TC-HP-06 | Có phần vượt | Mở Rà soát & chốt | Báo số ngày vượt, không được trả | Suy luận | XLSX (TC-T7-07) |

## Nửa ngày

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-ND-01 | P/2, còn phép | Nhập P/2 | Thực tế +0,5, phép +0,5, hưởng đủ 1 | T11 AL9 | RULE |
| TC-ND-02 | KL/2 | Nhập KL/2 | Thực tế +0,5, KL +0,5, không trừ phép | T10 dòng G, I | RULE |
| TC-ND-03 | Như E: P/2, hết phép | Nhập P/2 | Hưởng 9,5, nửa ngày phép không trả | T10 dòng E | RULE |
| TC-ND-04 | Nhiều nửa ngày cả hai loại | Nhập | Cộng đúng | T11 AL9, AV9 | RULE |

## Ngày lễ

T10 và T11 chưa có ô NL nào, nên phần này dựa vào công thức, chưa có số thật để so.

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-LE-01 | Lễ T3, 24/11 | Thêm ngày lễ | Tự NL, đủ công vẫn bằng chuẩn 25, OT 0 | T11 AS9, G4 | RULE |
| TC-LE-02 | Thử việc gặp lễ | Thêm ngày lễ | Vẫn được tính | T11 AS9 | RULE |
| TC-LE-03 | Lễ ngoài thời gian làm | Thêm ngày lễ | Không tính | QĐ | RULE |
| TC-LE-04 | Đi làm ngày lễ | Nhập 1 đè lên | Lấy số HR nhập | QĐ | RULE |
| TC-LE-05 | Lễ rơi vào T7, 01/05/2027 | Thêm ngày lễ | Hiện tại ai cũng NL, đủ công thì OT +1. Chưa rõ đúng sai | Cần quyết định | RULE **GHI NHẬN** |
| TC-LE-06 | Lễ rơi vào CN, 30/04/2028 | Thêm ngày lễ | Hiện tại như trên. Có nghỉ bù không thì chưa có quy tắc | Cần quyết định | RULE **GHI NHẬN** |
| TC-LE-07 | Khai lễ từ đầu kỳ | Thêm 24/11 vào ngày 05/11 | Hiện tại cột lễ và hưởng đã +1 từ 05/11, cuối kỳ thì đúng | Suy luận | TC |

## Thứ Bảy luân phiên

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-T7-01 | HCM làm 1 trong 2 T7 | Nhập 1 T7 | Thiếu 1 so với chuẩn | T10 | RULE |
| TC-T7-02 | Như I: không T7 nào | Không nhập | Hưởng 19,5 trên chuẩn 22 | T10 dòng I | RULE |
| TC-T7-03 | HCM làm 3 T7 | Nhập 3 T7 | OT 1 | T11 AT9 | RULE |
| TC-T7-04 | HN làm đủ 5 T7 của T10 | Nhập 5 T7 | OT 1 trên chuẩn 24 | T11 AT9 | RULE |
| TC-T7-05 | T7, CN đã qua | Không nhập | Vẫn trống | QĐ | RULE |
| TC-T7-06 | Đi làm CN | Nhập 1 | Được tính | T11 AL9 | RULE |
| TC-T7-07 | Rà soát T10 | Mở Rà soát & chốt | Chỉ báo: I thiếu T7, E và F vượt phép, G có điều chỉnh | T10, Suy luận | XLSX |

## OT

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-OT-01 | Làm 24 trên chuẩn 22 | Nhập | Hưởng 22, OT 2 | T11 AS9, AT9 | RULE |
| TC-OT-02 | Vừa đúng chuẩn | Nhập | OT 0 | T11 AT9 | RULE |
| TC-OT-03 | Phép, lễ đẩy qua chuẩn | Nhập | Tính cả vào OT | T11 AT9 | RULE |
| TC-OT-04 | Phép vượt số dư | Nhập | Phần không trả không tính OT | T11 AT9 | RULE |
| TC-OT-05 | OT nửa ngày | Nhập | OT 0,5 | T11 AT9 | RULE |

## Điều chỉnh công

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-DC-01 | Như G: −0,5 | Thêm điều chỉnh | Chỉ đổi hưởng lương | T10, T11 dòng G | RULE |
| TC-DC-02 | Công âm: 3 công, −5 | Thêm điều chỉnh | Hưởng 0, không âm | QĐ | RULE |
| TC-DC-03 | Không có công, −0,5 | Thêm điều chỉnh | Hưởng 0 | QĐ | RULE |
| TC-DC-04 | Đủ chuẩn, +1 | Thêm điều chỉnh | Hưởng 23, không thành OT | QĐ | RULE |
| TC-DC-05 | Không đổi phép | Thêm +5 | Không làm đủ mốc 14 | QĐ, T11 AV9 | RULE |
| TC-DC-06 | Có OT, −0,5 | Thêm điều chỉnh | Trừ vào hưởng, giữ OT | Suy luận | RULE |
| TC-DC-07 | Dữ liệu sai | Nhập 0,25, 0, không lý do | Bị từ chối | QĐ | RULE |
| TC-DC-08 | G qua T11 | Mỗi kỳ, tạo ở T10 | T11 tự có −0,5, hưởng 8,5 | T11 dòng 14 | A-GOLD |
| TC-DC-09 | Mỗi kỳ, qua năm mới, bỏ ở T1 | Thêm ở T10, bỏ ở T1/2027 | T10, T11, T12 giữ. T1, T2 không còn | QĐ | A-NV |
| TC-DC-10 | Một kỳ | Thêm ở T11 | Chỉ T11 có | QĐ | A-NV |
| TC-DC-11 | Nhiều điều chỉnh | Thêm 3 cái | Cộng dồn | QĐ | A-NV |
| TC-DC-12 | Công âm qua API: −31 | Thêm điều chỉnh | Hưởng 0 | QĐ | A-NV |
| TC-DC-13 | Điều chỉnh rồi chốt | Chốt | Phép chuyển kỳ không đổi | QĐ | A-NV |
| TC-DC-14 | Nhật ký điều chỉnh | Thêm | Có người, số, kiểu, lý do | QĐ | A-NV |

## Chốt và chuyển phép

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-CK-01 | 6 kỳ liên tiếp, T10/2026 đến T3/2027 | Có phép, thiếu công, vượt phép | Phép đầu → cuối: 2→3, 3→2, 2→2, 2→0, 0→1, 1→2 | T11 AV9, AU9 | A-CHOT |
| TC-CK-02 | Qua năm mới | Chốt T12 | Phép không hết hạn | QĐ | A-CHOT |
| TC-CK-03 | Chưa chốt gì | Xem kỳ | Phép đầu là số HR gõ | QĐ | A-CHOT |
| TC-CK-04 | Thêm người sau khi chốt | Thêm, gõ phép | Dùng số HR gõ | QĐ | A-CHOT |
| TC-CK-05 | Trước ngày 25, giờ VN | Chốt lúc 23:59 ngày 24 | Từ chối | QĐ | A-CHOT |
| TC-CK-06 | Ngày 25 | Chốt lúc 00:00 ngày 25 | Hiện cho chốt theo spec. QĐ nói "kỳ đã hết" | Cần quyết định | A-CHOT **GHI NHẬN** |
| TC-CK-07 | Kỳ trước đang mở, đã có ô HR nhập | Chốt T11 khi T10 mở | Từ chối | QĐ | A-CHOT |
| TC-CK-08 | Chưa từng mở T11 | Chốt T10, rồi chốt thẳng T12 | Từ chối, nếu không sẽ mất phép T11 | QĐ | A-CHOT |
| TC-CK-09 | Kỳ cũ hơn kỳ đã chốt | Chốt T10, xem rồi chốt T9 | Từ chối | QĐ | A-CHOT |
| TC-CK-10 | Lỡ xem kỳ cũ | Chốt T10, xem T9, chốt T11 | Chốt được | Suy luận | A-CHOT |
| TC-CK-11 | Chốt hai lần | Chốt lại | Từ chối | QĐ | A-CHOT |
| TC-CK-12 | Xem T9 trước lần chốt đầu tiên | Xem T9, chốt T10 | Không bị chặn: kỳ đầu tiên là tháng sớm nhất HR đã nhập ô | Quyết định khi sửa lỗi | A-CHOT |

## Mở lại kỳ

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-MK-01 | Không có lý do | Để trống | Từ chối | QĐ | RULE |
| TC-MK-02 | Mở lại có lý do | Nhập lý do | Kỳ mở, nhập được, có nhật ký | QĐ | A-CHOT |
| TC-MK-03 | Sót một ngày phép | Mở, nhập P, chốt lại | Phép đầu kỳ sau từ 3 về 2 | QĐ | A-CHOT |
| TC-MK-04 | Nhiều kỳ đã chốt | Mở kỳ cũ | Từ chối. Mở lùi lần lượt thì được | QĐ | A-CHOT |
| TC-MK-05 | Kỳ đang mở | Mở lại | Từ chối | QĐ | A-CHOT |
| TC-MK-06 | Chốt, mở nhiều lần | Lặp 3 lần | Không lỗi, phép đúng | QĐ | A-CHOT |
| TC-MK-07 | Đã đổi khu vực, mở T10 sửa một ô | Mở lại | T10 vẫn HCM, chuẩn 22 | QĐ, spec | A-CHOT |
| TC-MK-08 | Đã lên chính thức, mở T10 sửa một ô | Mở lại | T10 vẫn thử việc, phép 0 | QĐ | A-CHOT |

## Sửa thông tin sau khi chốt

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-SC-01 | Sửa kỳ đã chốt | Nhập ô, sửa chuẩn, thêm/bỏ điều chỉnh | Từ chối | QĐ | A-CHOT |
| TC-SC-02 | Sửa tên, bộ phận, khu vực, loại, ngày | Sửa nhân viên | Kỳ đã chốt không đổi | QĐ, spec | A-CHOT |
| TC-SC-03 | Sửa phép đầu do gõ | Gõ 9 | Kỳ sau vẫn lấy số chốt | QĐ | A-CHOT |
| TC-SC-04 | Sửa số T7 của khu vực | Sửa khu vực | Chuẩn kỳ đã chốt không đổi | QĐ | A-CHOT |
| TC-SC-05 | Thêm lễ vào T7 của kỳ đã chốt | Thêm ngày lễ | Số kỳ đã chốt không đổi | QĐ | A-CHOT |
| TC-SC-06 | Thêm lễ vào T2 của kỳ đã chốt | Thêm ngày lễ | Số kỳ đã chốt không đổi | QĐ | A-CHOT |
| TC-SC-07 | Xoá lễ của kỳ đã chốt | Xoá ngày lễ | Số kỳ đã chốt không đổi | QĐ | A-CHOT |
| TC-SC-08 | Đổi tên khu vực | Sửa khu vực | Kỳ đã chốt giữ tên cũ | Spec | A-CHOT |

## Nhật ký

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-NK-01 | Thay đổi trong kỳ | Nhập, sửa chuẩn, điều chỉnh, chốt, mở | Đủ dòng, đúng người | QĐ | A-CHOT |
| TC-NK-02 | Sửa ngày lễ | Xem nhật ký kỳ | Đọc được thay đổi | QĐ | A-CHOT |
| TC-NK-03 | Sửa nhân viên | Xem nhật ký kỳ | Đọc được thay đổi | QĐ | A-CHOT |

## Khoảng ngày tự chọn

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-KT-01 | Biên 31 ngày | Chọn 31, 32 ngày | 31 được, 32 từ chối | QĐ | A-NV |
| TC-KT-02 | Một ngày, ngày ngược, sai định dạng | Chọn | Một ngày được, còn lại từ chối | QĐ | A-NV |
| TC-KT-03 | Qua năm mới và ranh giới 25/26 | Chọn 20/12 đến 04/01 | Thấy số đã nhập ở cả hai kỳ | QĐ | A-NV |
| TC-KT-04 | Xem khoảng cũ | Rồi chốt kỳ | Không sinh kỳ phải chốt | QĐ | A-NV |
| TC-KT-05 | Ai có mặt | Chọn | Chỉ người có làm trong khoảng | QĐ | A-NV |
| TC-KT-06 | Khoảng trùng đúng một kỳ | Chọn 26/09 đến 25/10 | Số khớp kỳ (phép đầu, chuẩn đã sửa, hưởng) | Suy luận | A-NV |
| TC-KT-07 | File của khoảng | Tải 14 ngày | Tổng nằm ngay sau ngày cuối | QĐ | XLSX |
| TC-KT-08 | Khoảng không nhập được | Mở khoảng, thử gõ ô | Không cho gõ, không có nút chốt | QĐ | TC |

## Ranh giới 25/26 và năm

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-RG-01 | 72 tháng, 2026–2031 | Mở từng kỳ | Từ, đến, số ngày khớp công thức dòng 7 | T11 dòng 7 | CAL |
| TC-RG-02 | Các kỳ nối nhau | Mở lần lượt | Không sót, không trùng ngày | T11 dòng 7 | CAL |
| TC-RG-03 | 25 và 26 | Xem ngày | 25 thuộc tháng đó, 26 thuộc tháng sau | T11 dòng 7 | CAL |
| TC-RG-04 | Kỳ tháng 1 | Mở T1/2027 | 26/12/2026 đến 25/01/2027 | T11 dòng 7 | CAL |
| TC-RG-05 | Mọi ngày | Xem kỳ của ngày | Về đúng kỳ chứa nó | T11 dòng 7 | CAL |
| TC-RG-06 | Số ngày hai sheet | Mở T10, T11 | 30 và 31 ngày | T10, T11 | CAL |
| TC-RG-07 | Thứ của ngày đầu | Mở T10, T11 | T7 và T2, như dòng 8 | T10, T11 | CAL |
| TC-RG-08 | Tháng không tồn tại | Mở tháng 13, 0 | Từ chối | Suy luận | A-NV |

## Tháng 2

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-T2-01 | Kỳ T3/2027 | Mở kỳ | 28 ngày, 28/02 sang 01/03 | T11 dòng 7 | CAL |
| TC-T2-02 | Kỳ T3/2028, năm nhuận | Mở kỳ | 29 ngày, có 29/02 | T11 dòng 7 | CAL |
| TC-T2-03 | Kỳ T2/2027 | Mở kỳ | 26/01 đến 25/02, 31 ngày | T11 dòng 7 | CAL |
| TC-T2-04 | Chuẩn kỳ ngắn | Mở kỳ | 20 + số T7 của khu vực | Cách tính G4, G5 | CAL |

## Công chuẩn và dữ liệu nhập

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-CC-01 | Mã chấm công | Gõ mã lạ | Chỉ nhận 8 mã | Bảng quy ước | RULE |
| TC-CC-02 | Công chuẩn | Gõ −1, 32 | Từ chối | QĐ | RULE |
| TC-CC-03 | Phép đầu | Gõ −0,5, 0,25 | Từ chối | QĐ | RULE |
| TC-CC-04 | Chuẩn gợi ý T10, T11 | Mở kỳ | 22/24 và 25/27 | T10, T11 G4, G5 | CAL |
| TC-CC-05 | Chuẩn T1/2027 | Mở kỳ | 21 + T7 | Đếm tay | CAL |
| TC-CC-06 | Lễ vẫn nằm trong chuẩn | Mở T11 | 25 có cả 24/11 | T11 G4 | CAL |
| TC-CC-07 | Sửa chuẩn một kỳ | Sửa 25 thành 22 | Hưởng, OT đổi, kỳ khác không đổi | QĐ | A-NV |
| TC-CC-08 | Mã kỳ không tồn tại | Gọi địa chỉ sai | Báo không tìm thấy, không lỗi 500 | Suy luận | A-NV |

## File Excel tải về

Mở lại file bằng ExcelJS, so với mẫu của HR.

| Mã | Tình huống | HR làm | Mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-XL-01 | Thứ tự dòng | Xem bảng, tải file | HCM trước HN, chính thức trước thử việc | T10, T11 | A-GOLD |
| TC-XL-02 | Số T10 | Tải | AK–AU khớp 12 người | T10 | XLSX |
| TC-XL-03 | Số T11 | Tải | AL–AV khớp 11 người | T11 | XLSX |
| TC-XL-04 | Ô ngày | Tải | Khớp từng ô, số 1 là số | T10 | XLSX |
| TC-XL-05 | Tổng cột | Tải | File khớp màn hình và sheet | T10 | XLSX |
| TC-XL-06 | 6 cột đầu | Tải | STT, MNV, Họ Và Tên, Bộ Phận, Địa Điểm, Nhân Viên | T11 dòng 7 | XLSX |
| TC-XL-07 | Cột ngày | Tải | Từ G, ngày và thứ đúng | T11 dòng 7, 8 | XLSX |
| TC-XL-08 | Kỳ 28, 29, 30, 31 ngày | Tải | Tổng nằm ngay sau ngày cuối | T10, T11 | XLSX |
| TC-XL-09 | Tên cột tổng | Tải | Đúng tên, đúng thứ tự | T11 | XLSX |
| TC-XL-10 | Thông tin người | Tải | STT từ 1, đúng khu vực | T11 | XLSX |
| TC-XL-11 | Chữ loại nhân viên | Tải | `Chính Thức`, `Thử Việc` | T10, T11 cột F | XLSX |
| TC-XL-12 | Hàng số cột cuối bảng | Tải | Có, như dòng 20 T11, dòng 21 T10 | T10, T11 | XLSX |
| TC-XL-13 | Merge tiêu đề, nhóm cột | Tải | Có đủ | T11 | XLSX |
| TC-XL-14 | Merge A1:C3, A5:D5 | Tải | Có | T11 | XLSX |
| TC-XL-15 | Freeze | Tải | Tại E9 | T11 | XLSX |
| TC-XL-16 | Logo, tên công ty | Tải | Có | T11 | XLSX |
| TC-XL-17 | Năm, tháng | Tải | G2, G3 | T11 | XLSX |
| TC-XL-18 | Định mức | Tải | F4:G5 | T11 | XLSX |
| TC-XL-19 | Khu vực thứ ba | Tải | Không mất | Suy luận | XLSX |
| TC-XL-20 | Vị trí quy ước | Tải | I, N, R như T11 | T11 | XLSX |
| TC-XL-21 | Lời và màu quy ước | Tải | Đúng 7 mã có màu | T11 | XLSX |
| TC-XL-22 | Tiêu đề O5 | Tải | Đã chốt không có chữ nháp. Đang mở có `(BẢN NHÁP)` | T11, QĐ | XLSX |
| TC-XL-23 | Tên sheet | Tải | `Tháng 11.26`, `Tháng 1.27` | T11 | XLSX |
| TC-XL-24 | Màu đầu bảng | Tải | Đỏ FF0000, T7/CN vàng | T10, T11 | XLSX |
| TC-XL-25 | T7, CN của người đang làm | Tải | Vàng | T10, T11 | XLSX |
| TC-XL-26 | T2–T6 ngoài thời gian làm | Tải | Xám | T10 dòng E, H, J | XLSX |
| TC-XL-27 | T7, CN ngoài thời gian làm | Tải | Vẫn vàng | T10 dòng E, H, J | XLSX |
| TC-XL-28 | Màu ô ngoại lệ | Tải | Theo quy ước. HR tô khác, xem mục mâu thuẫn | T11 bảng quy ước | XLSX |
| TC-XL-29 | Màu nhóm tổng | Tải | Cam, xanh, vàng | T11 | XLSX |
| TC-XL-30 | Hưởng lương | Tải | Đậm, đỏ | T11 | XLSX |
| TC-XL-31 | Font | Tải | Times New Roman | T11 | XLSX |
| TC-XL-32 | Số 0 | Tải | Hiện `-` | T11 | XLSX |
| TC-XL-33 | Số nguyên | Tải | Hiện 9, không phải 9.0 | T11 | XLSX |
| TC-XL-34 | Comment điều chỉnh | Tải | Trên ô hưởng lương của đúng người | T10, T11 dòng G | XLSX |
| TC-XL-35 | Ghi chú ngày | Tải | Trên đúng ô | QĐ | XLSX |
| TC-XL-36 | Mở bằng Excel thật | Tải, mở Excel, in | Không báo lỗi file, logo đúng, in vừa trang | T11 | TC |
| TC-XL-37 | Tên file, tải trên iPhone | Tải | `Bang-cham-cong-11-2026.xlsx`, tải được | Suy luận | TC |
| TC-XL-38 | Sửa số trong file tải | Sửa một ô ngày | Cột tổng không tự tính lại vì file chỉ có giá trị. HR cần được biết | Suy luận | TC |

## Bổ sung sau khi rà nghiệp vụ cả năm

| Mã | Tình huống | HR làm | Kết quả mong đợi | Nguồn | Loại |
|---|---|---|---|---|---|
| TC-TT-01 | Kỳ trước chưa chốt | Xem kỳ sau | Phép đầu kỳ lấy phép cuối tính được của kỳ trước | Excel VLOOKUP sang tháng trước | A-CHOT |
| TC-TT-02 | Mở lại kỳ đã chốt | Xem kỳ sau | Phép đầu kỳ không tụt | Như trên | A-CHOT |
| TC-SC-20 | Chốt kỳ | Mở lại xem | Số tổng lấy đúng lúc chốt, không tính lại | Đã chốt không đổi | A-CHOT |
| TC-SC-21 | Chốt lại sau khi sửa | Chốt | Nhật ký ghi chênh lệch từng người | Truy vết sau trả lương | A-CHOT |
| TC-PT-01 đến 04 | Sửa số dư phép | Bấm ô Phép tồn cuối kỳ | Cộng hoặc trừ có lý do, không trừ quá số có, sửa số ban đầu sau chốt thì được cảnh báo | Đ.114, thực tế | A-CHOT |
| TC-NV-20, 21 | Biết tin nghỉ việc sau khi chốt | Nhập ngày nghỉ | Cảnh báo kỳ đã trả dư và phép còn lại | Đ.113 k3, Đ.48 k1 | A-CHOT |
| TC-NV-22, 23 | Thêm nhầm nhân viên | Xoá | Chỉ xoá được khi chưa có ngày công | Thực tế | A-CHOT |
| TC-LE-06 | Lễ rơi vào CN | Thêm ngày lễ | Nghỉ bù ngày làm việc kế tiếp, không trùng lễ khác | Đ.111 k3 | RULE, A-CHOT |
| TC-LE-07 đến 10 | Tết, đợt nghỉ dài | Nhập từ ngày đến ngày | Mọi người tự NL, bỏ CN trong đợt, HR sửa từng người được, xoá cả đợt được | Đ.112 | RULE, A-CHOT |
| TC-DM-01 đến 05 | Đổi định mức từ tháng X | Sửa khu vực, chọn tháng | Tháng trước đó, tháng chốt, tháng sửa tay giữ nguyên; sửa tay một tháng tính lại ngay | Thực tế | A-CHOT |
| TC-RG-01 đến 04 | Cưới, tang, thai sản, ốm | Chọn mã | CL có lương không trừ phép; TS, OM không tính công, vẫn tính cộng phép | Đ.115, Đ.139, NĐ 145 Đ.65 | RULE |
| TC-DK-01 đến 07 | Đăng ký nghỉ | Chọn lý do, từ ngày đến ngày | Tự điền T2–T6 qua nhiều kỳ, kỳ chốt thì từ chối, huỷ giữ ô HR sửa tay, có nhật ký | Đ.115, Đ.139 | A-NGHI |
| TC-DK-08 đến 21 | Tab Nghỉ, đi muộn | Nhập, duyệt, sửa, huỷ, thêm lý do | Danh sách cả năm, báo trùng ngày, chờ duyệt thì chưa đụng bảng công, duyệt thì điền, sửa thì di chuyển ô và ghi nhật ký, đi muộn chấm M ngay | Yêu cầu chủ dự án | A-NGHI |
| TC-DK-22 đến 28 | Đổi mặc định trên dòng, danh sách người duyệt | Đổi cách tính, số ngày; thêm người duyệt | Cách tính HR chọn thắng mặc định; tên gõ mới được nhớ, không trùng | Yêu cầu chủ dự án | A-NGHI |
| TC-DK-29, 30 | Sửa lý do tự thêm | Mở Cấu hình, sửa | Đổi tên, cách tính, số ngày; dòng đã nhập giữ nguyên; lý do có sẵn không sửa được | Yêu cầu chủ dự án | A-NGHI |
