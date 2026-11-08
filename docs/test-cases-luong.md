# Test case: Lương

Bản 08/11/2026, đi cùng `spec-luong.md` bản đã chốt mục 17. Nguồn: spec, `packages/shared/src/timesheet.ts` và `apps/api/src/services/timesheet.ts` (nhánh `main`), các review và review chéo ngày 06/11, file lương T10 của HR (chỉ để dựng cấu trúc).

- Người chỉ ghi bằng tên giả (NV A…, NV01…) hoặc vai trò ("người thử việc HN"). Số tiền là số giả, phép tính nhất quán; không có số nào lấy từ file của HR.
- Mọi số ở mục K tính bằng phân số đúng rồi làm tròn theo D01; dev chuyển từng mã thành test tự động (`it('L-K2-17 …')`).
- **Viết test trước code, chạy đỏ trước** (spec 4.12). Mỗi bước ở spec mục 15 ghi các mã cần chạy.

## 0. Trả lời câu hỏi của chủ dự án

> "Tháng 10 một cấu hình, tháng 11 cấu hình khác. Sau này tải lại Excel thì lấy cấu hình mới nhất hay cấu hình đúng?"

Lấy cấu hình **đúng của tháng đó**, không bao giờ lấy bản mới nhất, cũng không lấy theo ngày tải.

- **Tháng 10 đã duyệt**: file đọc lại từ bản chụp lúc duyệt. Tải lần nào cũng ra cùng số. Đổi cấu hình tháng 11 không chạm được vào tháng 10.
- **Tháng 10 còn nháp**: web tính lại, mỗi cài đặt lấy phiên bản có hiệu lực ở ngày tham chiếu của tháng 10 (spec R2). Mức mới "áp dụng từ 01/11" không đổi nháp tháng 10.
- **Luật ra muộn nhưng có hiệu lực lùi về tháng 10 đã duyệt**: tháng 10 vẫn không đổi. Web liệt kê tháng bị ảnh hưởng, số chênh từng người, đề xuất truy lĩnh / truy thu ở tháng nháp kế tiếp, hoặc mở lại nếu chưa chuyển khoản.
- Mỗi file Excel có dấu bản và sheet **Tham số áp dụng**: ai mở file cũng thấy file dùng cấu hình nào.

Quy tắc R1–R9 nằm ở spec mục 7 (một nơi duy nhất).

## 1. Danh mục tình huống

**Căn cứ**: *spec n* = mục n của `spec-luong.md`; *R1–R9* = spec mục 7; *D01–D12* = spec mục 9; *BH-1, BH-2* = spec 5.4; *câu n* = quyết định n ở spec mục 17.1 "Đã chốt (BA)"; *17.2*, *17.3* = danh sách kiểm và mục kế toán ký; *CC* = quy tắc Chấm công đang chạy; *BA* = báo cáo BA. **MĐ** = mặc định cấu hình khi luật không quy định, sửa được ở Cấu hình; không còn chờ ai chốt.
**Ví dụ kỳ**: T7/2026 = 26/06–25/07/2026, chi 05/08. T10/2026 = 26/09–25/10, chi 05/11. T12/2026 = 26/11–25/12, chi 05/01/2027. T1/2027 = 26/12/2026–25/01/2027. Ngày vào, nghỉ trong ví dụ là ngày giả định, không phải ngày của người thật.

### A. Cấu hình theo thời gian

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-A01 | T10 đã duyệt, sang tháng 11 đổi cấu hình | Thêm trần tiền cơm mới từ 01/11, đổi Xăng xe từ chịu thuế sang "miễn tới mức quy chế công tác phí" từ T11, rồi tải lại Excel T10 | File T10 có số y như lần tải đầu, chỉ khác giờ tải trong dấu. Sheet Tham số vẫn ghi mức cũ | R4, R8 | Excel, Bảng lương |
| L-A02 | T10 còn nháp, nhập mức tương lai | Thêm lương cơ sở mới "áp dụng từ 01/07/2027" | Dòng hiện "Sắp áp dụng". Nháp T10/2026 không đổi số, không có thanh báo | R2, R3 | Cấu hình › Tham số luật |
| L-A03 | Tham số BH đổi ngày 01/7, giữa kỳ 26/6–25/7 | Có lương cơ sở 2.340.000 và 2.530.000 từ 01/07/2026. Tính T6, T7 | T6 dùng trần 46,8 tr (tháng BH 6). T7 dùng trần 50,6 tr cho cả kỳ, không tách đoạn. Sheet Tham số ghi "Tháng BH 07/2026" | R2, NĐ 161/2026 | Bảng lương, Excel |
| L-A04 | Tham số thuế đổi ngày 01/7 | Trần tiền cơm 730.000 → 1.200.000 và ngưỡng 10% 2 tr → 5 tr từ 01/07/2026. Tính T5 (chi 05/6), T6 (chi 05/7) | T5 dùng mức cũ. T6 dùng mức mới, vì chi sau 01/7. Hover ô Miễn thuế ghi "theo ngày chi 05/07" | R2, NĐ 253/2026 Đ.8, Đ.46 k3, Đ.50, câu 29 | Bảng lương |
| L-A05 | Đổi ngày chi trả của tháng nháp qua mốc thuế | T6 nháp, sửa ngày chi từ 05/7 thành 30/6 | Tính lại, thuế theo mức trước 01/7. Thanh báo "Ngày chi đổi, áp tham số thuế khác" | R2, R3 | Bảng lương |
| L-A06 | Chi thực tế trễ so với ngày đã duyệt | T6 duyệt với ngày chi 30/6, chuyển khoản thực tế ngày 03/7 | Không tính lại. Lúc đánh dấu Đã chuyển khoản, web báo "Ngày chi thực tế qua mốc 01/7, tham số thuế khác, điều chỉnh khi quyết toán" | R4, **MĐ** | Bảng lương |
| L-A07 | Mức có ngày quá khứ, chỉ chạm tháng nháp | T10 nháp, thêm trần tiền cơm từ 01/10 | Nháp T10 tính lại. Thanh báo liệt kê người đổi số. Nhật ký ghi "T10 tính lại, 4 dòng đổi" | R3 | Cấu hình, Bảng lương, Nhật ký |
| L-A08 | Luật hồi tố chạm tháng đã duyệt | Ngày 15/11, lương tối thiểu vùng mới "từ 01/10" được nhập; T10 đã duyệt, T11 nháp | Hộp "Ảnh hưởng: T10 đã duyệt" hiện chênh lương đóng BH và BH từng người. T10 không đổi. Mặc định tạo dòng truy thu BH ở T11, ghi "gốc T10" | R6 | Cấu hình, Bảng lương |
| L-A09 | Luật thuế áp cho cả năm, ra sau khi đã duyệt vài tháng | Biểu thuế mới áp dụng từ 01/01/2026, nhập sau khi T1–T6 đã duyệt | Tháng đã duyệt giữ thuế cũ. Mặc định chọn "Chỉ ghi nhận, điều chỉnh khi quyết toán", không tạo truy lĩnh thuế hằng tháng. Tháng nháp dùng biểu mới | R6(c), Luật 109/2025 Đ.29 | Cấu hình, Tổng hợp năm |
| L-A10 | Sửa mức đã dùng ở tháng đã duyệt | Bấm sửa giảm trừ 15.500.000 đã dùng ở T10 | Ô khoá: "Đã dùng ở T10 đã duyệt. Thêm mức mới hoặc Sửa lỗi". API 409 | R5 | Cấu hình › Tham số luật |
| L-A11 | Gõ sai mức đã dùng, cần sửa | Bấm Sửa lỗi, nhập số đúng | Tạo bản thay thế cùng ngày áp dụng, bản cũ ghi "đã thay". Chạy luồng hồi tố L-A08 | R5, R6 | Cấu hình |
| L-A12 | Sửa, xoá mức chưa dùng hoặc chỉ dùng ở nháp | Sửa ngưỡng 10% sắp áp dụng, xoá một mức tương lai | Được. Nháp bị chạm thì tính lại. Nhật ký ghi cũ → mới | R5 | Cấu hình |
| L-A13 | Hai mức cùng ngày áp dụng | Thêm giảm trừ thứ hai "từ 01/01/2026" | Từ chối: "Đã có mức từ 01/01/2026. Dùng Sửa lỗi" | R5 | Cấu hình |
| L-A14 | Xoá mức làm một tháng không còn tham số | Xoá mức duy nhất trước T8 của một tham số | Từ chối: "T8–T10 sẽ không có mức" | R5 | Cấu hình |
| L-A15 | Tham số phụ thuộc tham số | Lương cơ sở đổi | Trần BHXH, BHYT = 20 × lương cơ sở tự đổi theo cùng ngày. Trần BHTN = 20 × lương tối thiểu vùng, đi theo vùng. Sheet Tham số ghi cả hai trần | BA 3.1 | Cấu hình, Excel |
| L-A16 | Đổi một bậc thuế | Sửa bậc 2 từ 10% thành 12% | Tạo phiên bản mới của **cả biểu** có ngày áp dụng. Biểu cũ giữ cho các tháng trước | R1 | Cấu hình › Tham số luật |
| L-A17 | Đổi cách thuế của một khoản từ tháng sau | Công ty có quy chế công tác phí: Xăng xe đổi từ *chịu thuế* (mặc định) sang *miễn tới mức quy chế* 1.000.000, áp dụng từ T12 | T11 (duyệt hoặc nháp) giữ chịu thuế. T12 miễn tới 1.000.000, phần vượt chịu thuế. Cấu hình, lưới và Excel cùng ghi một cách cho cùng tháng. Rà soát T12 ghi "lệch vì Xăng xe đổi cách thuế" | R1, R2, spec 5.9, câu 1 | Cấu hình › Khoản lương |
| L-A18 | Đổi "tính BH" của Chuyên cần | Công ty sửa HĐLĐ thành chuyên cần có điều kiện, tắt Tính BH cho Chuyên cần từ T12 | T11 giữ lương đóng BH có chuyên cần. T12 lương đóng BH giảm đúng mức chuyên cần, Rà soát giải thích phần lệch hơn 10% | R1, câu 16, 17.3 K3 | Cấu hình, Rà soát |
| L-A19 | Thêm khoản lương mới | Thêm "Phụ cấp đi lại" từ T11 | T10 không có cột này. T11 có thêm cột ở nhóm A, thêm vào Gross và lương 1 ngày theo tuỳ chọn | R1 | Cấu hình, Bảng lương, Excel |
| L-A20 | Đổi tên khoản lương | Đổi "Nhà ở / Sinh hoạt" thành "Phụ cấp nhà ở" từ T12 | T10, T11 (duyệt hay nháp) hiện tên cũ. T12 hiện tên mới. Tổng hợp nhiều tháng dùng tên mới, ghi chú tên cũ | R5 | Cấu hình, Excel |
| L-A21 | Xoá khoản lương đã dùng | Xoá "Trang phục" đã có ở T10 | Từ chối. Mở "Ngừng từ tháng". Từ tháng đó không còn cột và mức; tháng cũ giữ | R5 | Cấu hình › Khoản lương |
| L-A22 | Xoá khoản chưa dùng | Xoá khoản vừa thêm nhầm | Xoá hẳn, có nhật ký | R5 | Cấu hình |
| L-A23 | Đổi mức mặc định của khoản | Tiền cơm mặc định 1,0 tr → 1,2 tr | Hồ sơ đang có không đổi. Web hỏi: "Áp cho 9 người đang hưởng mức mặc định, từ ngày …?" Đồng ý thì tạo mức mới cho từng người | R1, **MĐ** | Cấu hình, Hồ sơ lương |
| L-A24 | Đổi tỷ lệ lương thử việc | 90% → 85% từ T12; thử 80% | 85% áp từ T12, các tháng trước giữ 90%. 80% bị từ chối: "Luật tối thiểu 85%" | R1, BLLĐ Đ.26 | Cấu hình › Quy tắc |
| L-A25 | Đổi hệ số làm thêm, giờ một ngày | Đổi 150% → 180% từ T12; thử 140% | 180% áp từ T12. 140% bị từ chối vì dưới mức luật | R1, BLLĐ Đ.98 | Cấu hình › Quy tắc |
| L-A26 | Đổi cách tính % KPI thử việc | Đổi từ "theo ngày công" sang "HR gõ" từ T12 | T11 giữ cách cũ. T12 ô % thành ô HR gõ | R1 | Cấu hình › Quy tắc |
| L-A27 | Tắt KPCĐ | Tắt "Công ty đóng KPCĐ" | Cảnh báo "Bắt buộc theo Luật Công đoàn 2024". Nếu vẫn tắt: phải ghi lý do, chỉ áp từ tháng nháp, nhật ký | Luật Công đoàn 2024 Đ.29 k1 b, NĐ 105/2026 Đ.11, câu 8 | Cấu hình › Quy tắc |
| L-A28 | Đổi cài đặt của loại HĐ | "HĐLĐ 12 tháng" thêm hay bỏ "đóng BH" từ T12 | Áp cho mọi người thuộc loại đó từ T12. Tháng trước giữ | R1 | Cấu hình › Loại HĐ |
| L-A29 | Đổi tên hoặc xoá loại HĐ | Đổi tên "Thử việc" thành "HĐ thử việc"; xoá loại đã dùng | Tháng duyệt giữ tên cũ. Nháp lấy tên từ bản chốt kỳ công. Xoá loại còn người hoặc đã dùng bị từ chối | R5, CC (bản chốt giữ tên) | Cấu hình › Loại HĐ |
| L-A30 | Mở nháp một tháng cũ rất muộn | Tháng 12 mới mở nháp T10 để tính | Dùng phiên bản của T10 (R2), không dùng cấu hình tháng 12 | R2 | Bảng lương |
| L-A31 | Code tính lương được sửa lỗi | Ra bản `payroll.ts` mới | Tháng đã duyệt không đổi một đồng. Nháp tính theo code mới, có thanh báo "Cách tính cập nhật ngày …". Sheet Tham số ghi phiên bản công thức | R1, R4 | Bảng lương, Excel |
| L-A32 | Xem cấu hình của một tháng cũ | Chọn "Xem cấu hình áp dụng cho T7/2026" | Hiện đúng phiên bản T7 dùng. Mức đã thay, mức sắp áp dụng có nhãn | R1, R2 | Cấu hình |
| L-A33 | Hai thay đổi cùng chạm một nháp | Thêm tham số và sửa hồ sơ, cả hai chạm T11 | Một lần tính lại. Thanh báo liệt kê cả hai nguyên nhân | R3 | Bảng lương |

### B. Hồ sơ lương

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-B01 | Người mới có ở Chấm công, chưa có hồ sơ | Mở Hồ sơ lương | Băng báo "NV13 có trong Chấm công từ 03/11, chưa có hồ sơ". Nút tạo hồ sơ điền sẵn mức từ Khoản lương, áp dụng từ = ngày vào | spec 2 (3), phác thảo | Hồ sơ lương |
| L-B02 | Duyệt khi còn người thiếu hồ sơ | Kỳ công đã chốt có NV13, chưa có hồ sơ, bấm Duyệt | Không chặn. Rà soát đỏ "NV13 có công, chưa có hồ sơ, dòng 0 đồng". Duyệt phải tích "Đã xem". Dòng hiện "Thiếu hồ sơ" | spec 4.8, 11.3 | Bảng lương, Rà soát |
| L-B03 | Hồ sơ bắt đầu sau ngày vào | Ngày vào 07/10, tạo hồ sơ từ 15/10 | Web đề nghị lùi về 07/10. Nếu giữ: Rà soát đỏ "07/10–14/10 có công nhưng chưa có mức" | **MĐ** | Hồ sơ lương |
| L-B04 | Tăng lương từ đầu kỳ | Mức mới từ 26/10 (đầu T11) | T11 dùng một mức, không tách | R2 | Hồ sơ, Bảng lương |
| L-B05 | Tăng lương giữa kỳ | Mức mới từ 01/11, kỳ T11 là 26/10–25/11 | Tách hai đoạn: 26/10–31/10 mức cũ, 01/11–25/11 mức mới, chung công chuẩn của kỳ. Hover hiện hai đoạn. Sheet Tham số liệt kê | spec 5.3, R2 | Bảng lương, Excel |
| L-B06 | Chọn ngày hiệu lực theo tháng | Chọn "từ T12/2026" trong form | Lưu ngày 26/11/2026 (đầu kỳ T12) và hiện rõ ngày đó. Chọn ngày khác đầu kỳ thì báo "tháng này sẽ tách 2 đoạn" | R2, **MĐ** | Hồ sơ lương |
| L-B07 | Tăng lương có ngày rơi vào tháng đã duyệt | Ngày 10/11 nhập tăng lương từ 01/10 cho NV03; T10 đã duyệt | Hộp ảnh hưởng: T10 chênh +X (tính theo ngày công T10). T10 không đổi. Mặc định tạo truy lĩnh ở T11 ghi "gốc T10, tăng lương từ 01/10" | R6 | Hồ sơ, Bảng lương |
| L-B08 | Sửa mức đang dùng ở tháng đã duyệt | Sửa lương thời gian của mức "từ T08" mà T8–T10 đã duyệt | Chặn sửa đè. Web đề xuất "Thêm mức mới từ 26/10 (đầu nháp T11)" hoặc "Sửa lỗi" (đi luồng hồi tố) | R5 | Hồ sơ lương |
| L-B09 | Sửa mức chỉ dùng ở nháp | Sửa mức "từ T11" khi T11 còn nháp | Được, nháp tính lại, nhật ký cũ → mới | R5, phác thảo | Hồ sơ lương |
| L-B10 | Xoá mức tương lai hoặc hồ sơ | Xoá mức "từ T12" chưa áp dụng; xoá hồ sơ đã dùng; xoá hồ sơ chưa dùng | Mức tương lai: xoá được. Hồ sơ đã dùng: từ chối, đề xuất "Ngừng từ tháng". Hồ sơ chưa dùng: xoá được | R5, phác thảo | Hồ sơ lương |
| L-B11 | Hai mức cùng ngày | Thêm mức thứ hai "từ 01/11" | Từ chối | R5 | Hồ sơ lương |
| L-B12 | Mức dưới lương tối thiểu vùng | Lương thời gian 5.000.000 khi vùng I là 5.310.000 | Cảnh báo lúc lưu. Lương đóng BH nâng lên sàn. Rà soát báo "lương dưới tối thiểu vùng" | spec 5.3, NĐ 293/2025 | Hồ sơ, Rà soát |
| L-B13 | Người nghỉ việc | Chấm công có ngày nghỉ 09/10 | Hồ sơ hiện "Nghỉ từ 10/10". Mức sau ngày nghỉ bị bỏ qua. Từ T11 không còn dòng | CC | Hồ sơ, Bảng lương |
| L-B14 | Người quay lại làm | Chấm công tạo mã mới cho người đã nghỉ | Hồ sơ mới theo mã mới. Hồ sơ cũ giữ nguyên. Tổng hợp năm có hai dòng khác mã | **MĐ** | Hồ sơ, Excel |
| L-B15 | Ngày chính thức tự điền | Nhập ngày vào 01/09 cho loại thử việc 60 ngày | Ngày chính thức tự = 31/10, HR sửa được | spec 5.3 | Chấm công › Nhân viên |
| L-B16 | Đổi ngày chính thức sau khi tháng đã duyệt | T10 đã duyệt, sửa ngày chính thức từ 20/10 về 10/10 | Luồng hồi tố: chênh phần 10/10–19/10 (90% → 100%, BH). Mặc định truy lĩnh ở T11 | R6 | Chấm công, Bảng lương |
| L-B17 | Thử việc riêng sang HĐLĐ giữa tháng dương lịch | HĐLĐ từ 15/10 | Lương tách đoạn theo ngày. BH tháng 10 theo BH-1: 10 ngày T2–T6 (01–14/10) thuộc HĐ thử việc riêng, tính là ngày không hưởng lương theo HĐ đóng BH; 10 < 14 nên **đóng đủ tháng 10** (L-K1-10) | NĐ 158/2025 Đ.3 k5, BH-1, câu 14 | Bảng lương |
| L-B18 | Thêm người phụ thuộc | NV02 có 1 NPT từ tháng 11/2026 | Áp cho tháng lương có ngày chi trong tháng 11 trở đi (T10 chi 05/11 đã được trừ) | R2, NĐ 253 Đ.46 k3, câu 29 | Hồ sơ, Bảng lương |
| L-B19 | NPT đăng ký muộn, hiệu lực lùi | Tháng 12 nhập NPT "từ tháng 7" | Tháng đã duyệt không đổi. Ghi "điều chỉnh khi quyết toán", không tạo truy lĩnh. Nháp áp ngay | R6(c), **MĐ** | Hồ sơ, Tổng hợp năm |
| L-B20 | NPT hết thời hạn | Đặt "đến tháng 12/2026" | Từ tháng chi 01/2027 không còn trừ | R1 | Hồ sơ |
| L-B21 | Cam kết thuế | Người thử việc HN ký cam kết ngày 20/11/2026 | Áp từ lần chi sau 20/11. Hết hạn 31/12/2026. Đầu năm 2027 Rà soát báo "cam kết hết hạn" | R1, NĐ 253 Đ.50 k2, câu 10, 11 | Hồ sơ, Rà soát |
| L-B22 | Thành đoàn viên | Bật đoàn viên từ tháng 11 | Đoàn phí từ tháng BH 11 (tháng lương T11) | R2 | Hồ sơ |
| L-B23 | Đổi số tài khoản sau khi duyệt, chưa chuyển khoản | NV03 đổi STK sau khi T10 duyệt | Bản duyệt giữ STK cũ. Excel T10 có dòng báo "NV03 đổi STK ngày …". HR được chọn "Dùng STK mới cho lần tải này", có nhật ký. Số tiền không đổi | R4, **MĐ** | Bảng lương, Excel |
| L-B24 | Số tài khoản | Nhập, xem lại | Lưu mã hoá. Web chỉ hiện 4 số cuối. Bấm Hiện đủ thì ghi nhật ký. STK sai định dạng bị từ chối | spec 10.2 | Hồ sơ |
| L-B25 | Đổi tên, chức danh, bộ phận sau khi duyệt | Chấm công sửa tên NV05 sau khi T10 duyệt | T10 giữ tên cũ (bản chụp). Nháp lấy theo bản chốt kỳ công của tháng đó, không theo tên hôm nay | R1, R4, CC | Bảng lương, Excel |
| L-B26 | Đổi khối BO/KD | NV07 chuyển từ BO sang KD từ T12 | T11 và trước tính vào BO trên Tổng quan và Excel. Khối phải nằm trong bản chốt kỳ công | R1, **MĐ** | Tổng quan, Excel |
| L-B27 | Đổi khu vực giữa kỳ | HCM → HN ngày 05/11 | Công chuẩn theo Chấm công (khu vực mới cho cả kỳ). Vùng lương tối thiểu theo khu vực ngày 01 tháng BH. Không tách đoạn khu vực | CC TC-KV-01, spec 5.6, câu 22 | Bảng lương |
| L-B28 | Danh sách kiểm trước tháng đầu | Mở Hồ sơ lương trước tháng lương đầu (T11/2026) | Băng "Danh sách kiểm (n mục)". Mỗi người có đủ mục ở spec 17.2 với mặc định đang dùng: loại HĐ theo loại NV, 60 ngày thử việc, chưa có cam kết, không có khoản (32) định kỳ, ngày chưa xác nhận. Rà soát đỏ tới khi HR xác nhận từng mục; mục cam kết là vàng. Bấm mục tới đúng ô | spec 17.2, câu 4, 9, 10, 33, 35 | Hồ sơ, Rà soát |

### C. Liên kết Chấm công

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-C01 | Kỳ công chưa chốt | Mở bảng lương T11 khi kỳ công còn chạy | Trạng thái "Chờ chốt công". Không Tính, không Duyệt. HR vẫn gõ trước KPI, tạm ứng. Tổng quan hiện Dự tính | spec 2 (4) | Bảng lương |
| L-C02 | Kỳ công đã chốt | Tính T10 | Ngày công = Hưởng lương của bản chốt, khớp từng người. Hover ghi "lần chốt 1, lúc …" | Spec, BA (12/12 khớp) | Bảng lương |
| L-C03 | Mở lại kỳ công khi lương còn nháp | Mở lại kỳ công T11 | Lương T11 chuyển sang "Chờ chốt công", giữ số HR gõ. Chốt lại thì tính lại và báo người đổi ngày công | R7 | Bảng lương |
| L-C04 | Mở lại kỳ công khi lương đã duyệt | Mở lại kỳ công T10 sau khi lương T10 duyệt | Lương T10 không đổi, gắn nhãn "Kỳ công đã mở lại lúc …, lý do …". Excel vẫn tải được, dấu có cảnh báo | R7, spec 16 | Bảng lương, Excel |
| L-C05 | Chốt lại kỳ công, không đổi số | Chốt lại sau L-C04, ngày công như cũ | Nhãn tự gỡ, nhật ký ghi "không chênh" | R7 | Bảng lương, Nhật ký |
| L-C06 | Chốt lại kỳ công, đổi số | Chốt lại, NV04 từ 22 xuống 21 công | Bảng chênh: ngày cũ/mới, tiền chênh tạm tính. Chọn: mở lại lương (nếu chưa chuyển khoản và là tháng duyệt gần nhất) hoặc truy thu ở T11 (mặc định) | R6, R7 | Bảng lương |
| L-C07 | Người không có quyền Lương mở lại kỳ công | HR chỉ có quyền Chấm công mở lại T10 | Cảnh báo chung "Kỳ này đã có bảng lương duyệt. Người phụ trách lương sẽ xử lý". Không hiện số tiền. Nhật ký lương có dòng sự kiện | H, R7 | Chấm công |
| L-C08 | Công chuẩn sửa tay | Chấm công sửa chuẩn HCM 25 → 24 | Lương 1 ngày dùng 24. Hover ghi "chuẩn 24 (HR sửa ở Chấm công)" | CC | Bảng lương |
| L-C09 | Làm Chủ nhật trong khi thiếu ngày thường | Nghỉ 1 ngày T3 (KL), đi làm 1 CN | D12 mặc định: CN đã nằm trong (17) (`sundayWorked` 1, OT 0), (25) cộng thêm 100% để tổng 200%. Rà soát báo "CN bù ngày thường". D12 "đổi ngày nghỉ theo nội quy" thì không cộng (L-K1-20) | BLLĐ Đ.98 k1 b, Đ.111 k2, D12, câu 19 | Bảng lương, Rà soát |
| L-C10 | Làm Chủ nhật vượt chuẩn | Đủ chuẩn và đi làm thêm 1 CN | Công làm thêm ngày nghỉ = 1. Tiền = lương ngày × 200% | BLLĐ Đ.98 | Bảng lương |
| L-C11 | Làm ngày lễ | Gõ 1 vào ngày lễ ở Chấm công | Công làm lễ = `holidayWorked` của bản chốt (1), **không** lấy MIN với OT (OT = 0 khi đi làm đủ). Ngày lễ nằm trong (17), (25) cộng 300%, tổng 400% (L-K1-19) | BLLĐ Đ.98, spec 5.3 | Bảng lương |
| L-C12 | OT ngày do thứ Bảy thừa | HCM làm 3 T7, OT 1 | Không tự thành tiền. Rà soát báo "OT 1 ngày chưa có giờ làm thêm", HR gõ giờ ngày thường | BA câu 14, **MĐ** | Rà soát |
| L-C13 | Đếm 14 ngày theo tháng dương lịch | KL 10 ngày trong 01–25/10 và 5 ngày trong 26–31/10 | Đếm theo tháng 10 dương lịch, dùng cả số đã có của kỳ T11 đang chạy, ghi "tạm". Khi chốt kỳ T11, nếu kết quả đổi: tạo dòng điều chỉnh BH tháng 10 ở T11, có báo (L-K1-07) | R2, BH-2, spec 5.4 | Bảng lương, Rà soát |
| L-C14 | Biên 14 ngày nghỉ không lương | KL 14 và 13,5 ngày làm việc trong tháng dương lịch | 14: (28), (30), (43), (45), (46) = 0, (27) vẫn hiện; BHYT theo D04 (mặc định vẫn đóng). 13,5: đóng đủ (L-K1-05, L-K1-06) | BH-2, D03, D04 | Bảng lương |
| L-C15 | Thai sản cả kỳ | TS cả tháng | Dòng vẫn có. Thu nhập 0; BHXH, BHTN, KPCĐ 0; BHYT 0 vì BHXH đóng (D04). Ghi chú "Thai sản, BHXH trả" | Luật BHXH 2024 Đ.53 k8, Luật BHYT Đ.12 k2 b, D04 | Bảng lương |
| L-C16 | Thai sản bắt đầu giữa kỳ | TS từ 10/10 | Lương theo ngày đi làm. Tháng 10 có 15 ngày T2–T6 TS (12–30/10) ≥ 14: không đóng BHXH, BHTN; BHYT 0 vì riêng TS đã từ 14 ngày (L-K1-24) | BH-2, D04, câu 15 | Bảng lương |
| L-C17 | Ốm có giấy dưới 14 ngày | OM 3 ngày | Không trả ngày OM. Phụ cấp chia theo ngày giảm theo tỷ lệ. BH đủ | BA 4.3 | Bảng lương |
| L-C18 | Vào giữa kỳ | Vào 07/10 | Lương theo ngày công của Chấm công. BH tháng 10: 4 ngày T2–T6 trước ngày vào (01, 02, 05, 06/10) không hưởng lương < 14 nên đóng đủ, nếu loại HĐ có đóng BH (L-K1-08) | BH-1, câu 14 | Bảng lương |
| L-C19 | Vào đúng ngày 26 | Vào 26/10 | Không có ở T10. BH tháng 10: 17 ngày T2–T6 trước ngày vào ≥ 14, không đóng. T11 đóng (L-K1-09) | R2, BH-1, CC TC-VG-07 | Bảng lương |
| L-C20 | Nghỉ việc giữa kỳ | Nghỉ 09/10 (ví dụ; file của HR không có ngày nghỉ) | T10: công theo bản chốt. BH-1: tháng 10 có 15 ngày T2–T6 sau ngày nghỉ không hưởng lương ≥ 14, chỉ BHYT (D04, L-K1-01). Tiền phép còn lại (L-D30). Thuế 10% nếu chi sau ngày nghỉ và cơ sở (26) + hỗ trợ từ 5 tr (D02, D10) | BH-1, D02, D04, D10 | Bảng lương |
| L-C21 | Biết tin nghỉ việc sau khi lương đã duyệt | Nhập ngày nghỉ 15/10 sau khi T10 duyệt đủ công | Rà soát T11 báo "T10 đã trả dư 8 ngày". Mặc định truy thu trong khoản thanh toán nghỉ việc | CC TC-NV-20, R6 | Rà soát |
| L-C22 | Điều chỉnh công | Kỳ công có −0,5 | Ngày công lấy số sau điều chỉnh. Hover ghi "21,5 − 0,5, lý do …" | CC | Bảng lương |
| L-C23 | Chính thức giữa kỳ, tách ngày công | Chính thức từ 15/10, 22 công | Ngày tính từng đoạn theo mã ngày. Phần vượt chuẩn cắt ở đoạn sau. Điều chỉnh công tính vào đoạn cuối. Tổng hai đoạn = Hưởng lương của kỳ công | `paidBySegment` của Chấm công, spec 5.6 | Bảng lương |
| L-C24 | Ai có dòng | Có hồ sơ nhưng không có trong bản chốt kỳ công | Bảng lương chỉ có người trong bản chốt. Người đã nghỉ trước kỳ không có dòng | CC | Bảng lương |

### D. Tính lương

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-D01 | Chính thức đủ công | NV01 HCM, 22/22 | Golden 12 người giả: từng ô khớp công thức 3.1 | spec 14 | Bảng lương |
| L-D02 | Tỷ lệ thử việc | Người thử việc HN | ×90% chỉ áp cho khoản có tuỳ chọn ×tỷ lệ thử việc. Khoản không có tuỳ chọn thì giữ 100% | spec 5.3 | Bảng lương |
| L-D03 | Thử việc và chính thức trong một kỳ | Chính thức từ 15/10 | Lương = Σ đoạn (lương ngày của đoạn × ngày của đoạn). Hover hiện từng đoạn | spec 5.3 | Bảng lương |
| L-D04 | KPI chính thức | NV06 19/22 công, HR gõ 75% | Thưởng = KPI × 75%, không chia theo ngày công | câu 6 | Bảng lương |
| L-D05 | KPI thử việc | 19,5/22 công | % = 19,5 ÷ 22 × 90%. HR gõ đè được, ô có dấu. Rà soát ghi số công thức và số gõ | spec 5.3 | Bảng lương, Rà soát |
| L-D06 | KPI tháng chuyển chính thức | 10 ngày thử việc, 12 ngày chính thức | HR gõ %. Chưa gõ thì gợi ý (10 × 90% + 12 × 100%) ÷ 22. Ô có nhãn "gợi ý" | **MĐ** | Bảng lương |
| L-D07 | Mức KPI đổi giữa kỳ | KPI 4 tr → 5 tr từ 01/11 | Không tách. Dùng mức của ngày cuối kỳ, hoặc ngày nghỉ việc nếu nghỉ trước | spec 5.6, câu 24 | Bảng lương |
| L-D08 | Không có khoản KPI, hoặc % sai | Người không có KPI; gõ −5%, 250% | Ô % khoá khi không có KPI. Ngoài 0–200% bị từ chối | **MĐ** | Bảng lương |
| L-D09 | Làm thêm ngày thường | 10 giờ | Tiền = 10 × lương ngày ÷ 8 × 150%. Giờ theo bước 0,5 | spec 5.3 | Bảng lương |
| L-D10 | Làm thêm vượt giới hạn | 45 giờ trong tháng, hoặc cộng dồn năm vượt 200 | Rà soát báo. Phần vượt giới hạn không miễn thuế. Cộng dồn năm lấy từ các tháng đã duyệt cộng số dư đầu năm. Công ngày nghỉ, lễ tính 8 giờ một công | BLLĐ Đ.107 k2, NĐ 145/2020 Đ.60 k4, NĐ 253 Đ.26 k3, câu 21 | Rà soát |
| L-D11 | Thu nhập khác | Gõ 250.000 không lý do; gõ số âm | Bắt buộc có lý do và chọn chịu thuế hay không. Số âm bị từ chối, dùng truy thu | spec 2 (4) | Bảng lương |
| L-D12 | Hỗ trợ | 700.000, loại Hỗ trợ, lý do HR gõ | Vào (34) chịu thuế, (42) Thực nhận, (48) Tổng chi phí, và cơ sở 10% nếu người đó bị khấu trừ 10% (D02). Khoản (32) không chọn loại thì là Hỗ trợ. Web không tự đặt lý do | NĐ 253 Đ.8 k1, k2 k, câu 4 | Bảng lương |
| L-D13 | Hoàn ứng | 500.000, loại Hoàn ứng (trả lại tiền NLĐ đã chi cho công ty, có chứng từ) | Không chịu thuế, cộng vào Thực nhận, không vào chi phí lương, không vào cơ sở 10% | NĐ 253 Đ.8, câu 4 | Bảng lương |
| L-D14 | Tạm ứng làm Thực nhận âm | Tạm ứng 15 tr, thực nhận 12 tr | Không chặn. Rà soát đỏ. Mặc định trừ 12 tr, 3 tr còn nợ thành tạm ứng ở T+1 (hiện ở T+1); HR đổi được | spec 4.8 | Bảng lương, Rà soát |
| L-D15 | Làm tròn | Lương 1 ngày 272.727,27… | Lương 1 ngày giữ số đầy đủ. Mỗi ô tiền tròn ngay khi tính (nửa đồng ra xa số 0), ô sau tính từ ô đã tròn: (42) = (26) − (41) + (32) tới đồng. Dòng tổng = Σ ô. Tổng thực nhận = tổng chuyển khoản (L-K1-21) | D01, câu 25 | Bảng lương, Excel |
| L-D16 | Lương đóng BH dưới sàn | Khoản tính BH 5 tr, vùng I 5,31 tr | Lương đóng BH = 5,31 tr. Rà soát báo | spec 5.3 | Bảng lương |
| L-D17 | Lương đóng BH trên trần | Khoản tính BH 60 tr | (27) = 50,6 tr (từ T7/2026), BHXH, BHYT tính trên đó. BHTN tính trên MIN(60 tr, 20 × vùng I = 106,2 tr) = 60 tr; tooltip (30) ghi lương đóng BHTN | BA 3.1, spec 5.3 | Bảng lương |
| L-D18 | BH không chia theo ngày | Đủ điều kiện tháng nhưng chỉ 12/22 công | BH tính trên đủ lương đóng | Luật BHXH 2024 | Bảng lương |
| L-D19 | Loại HĐ không đóng BH | Thử việc ký HĐ riêng | BH người lao động, công ty và KPCĐ đều 0 | NĐ 158/2025 | Bảng lương |
| L-D20 | Đoàn phí | Đoàn viên, lương đóng 60 tr | 0,5% × lương đóng, không quá 10% lương cơ sở. Không phải đoàn viên thì 0 | spec 5.3 | Bảng lương |
| L-D21 | KPCĐ | 6 người đóng BH | 2% × lương đóng BHXH của từng người. Người không đóng BH thì 0 | Luật Công đoàn 2024 | Bảng lương |
| L-D22 | Tiền cơm và trần | Cơm 1,5 tr/tháng, đủ công | Miễn 1,2 tr (trần theo tháng, không chia theo ngày). 0,3 tr chịu thuế | NĐ 253 Đ.8 | Bảng lương |
| L-D23 | Điện thoại, trang phục | Hồ sơ ĐT 500.000, quy chế ghi mức miễn 300.000; trang phục 350.000/tháng | ĐT: miễn 300.000, 200.000 chịu thuế. Không đặt mức miễn thì miễn tới mức ở hồ sơ. Trang phục: miễn tới khi cộng dồn năm thuế đạt 5.000.000, phần sau chịu thuế (L-K1-22) | NĐ 253 Đ.8 k2 đ, VBHN 19/VBHN-BTC Đ.10 k8, câu 2 | Bảng lương |
| L-D24 | Xăng xe | Xăng 1 tr | Chịu thuế toàn bộ (mặc định) | NĐ 253 Đ.8 k2 đ, spec 5.9, câu 1 | Bảng lương |
| L-D25 | Làm thêm miễn thuế | Tiền làm thêm 1,5 tr trong giới hạn giờ | Miễn thuế toàn bộ, không chỉ phần trả cao hơn giờ thường | Luật 109/2025 Đ.4 k8, NĐ 253 Đ.26 k1, D05 | Bảng lương |
| L-D26 | Giảm trừ và thu nhập tính thuế | 2 NPT; chịu thuế thấp hơn tổng giảm trừ | Giảm trừ = 15,5 tr + 2 × 6,2 tr + BH. Thu nhập tính thuế không âm | spec 5.3 | Bảng lương |
| L-D27 | Biên bậc thuế | Tính thuế 10.000.000, 10.000.001, 100.000.001 | Đúng mốc 10 tr: 500.000. Từ số kế tiếp, chỉ phần vượt chịu 10%. Kiểm cả 5 mốc | Luật 109/2025 Đ.9 | Bảng lương |
| L-D28 | Khấu trừ 10% thử việc ký riêng | Chưa cam kết, chi 5.000.000; chi 4.999.999; có cam kết | Từ 5 tr: 10% × thu nhập thực tế. Dưới 5 tr: 0. Có cam kết: không khấu trừ; Rà soát hiện ước tính năm, cảnh báo khi vượt mức phải nộp, vì cam kết chỉ hợp lệ khi chưa tới mức (L-K1-16, L-K1-17) | NĐ 253 Đ.50 k2, D09 | Bảng lương |
| L-D29 | Chi sau ngày nghỉ việc | Nghỉ 15/10, chi lương T10 ngày 05/11, 7,9 tr | 10% vì ngày chi sau ngày nghỉ và từ 5 tr. Hover ghi lý do | NĐ 253 Đ.50 k2 | Bảng lương |
| L-D30 | Tiền phép chưa nghỉ khi nghỉ việc | Còn 3 ngày phép | Tiền = 3 × lương theo HĐ (lương thời gian + PC trách nhiệm + chuyên cần; không gồm cơm, xăng, ĐT, nhà, trang phục, KPI) của tháng trước liền kề tháng nghỉ ÷ công chuẩn. Dòng riêng ở (24), **miễn thuế**, không vào lương đóng BH (L-K1-12) | BLLĐ Đ.113 k3, NĐ 145/2020 Đ.67 k3, NĐ 253 Đ.26 k2, D08, câu 18 | Bảng lương, Phiếu |
| L-D31 | Nhiều lần chi trong tháng | Lương + truy lĩnh + thưởng T13 cho một người 10% | Ngưỡng 5 tr xét theo từng lần chi | NĐ 253 Đ.50 | Bảng lương |
| L-D32 | Gõ đè ngày công | Gõ 20 khi Chấm công cho 21 | Bắt buộc lý do. Ô có dấu. Rà soát báo "khác Chấm công". Không sửa ngược sang Chấm công | spec 2 (4), BA 5 | Bảng lương, Rà soát |
| L-D33 | Lệch hơn 10% so với tháng trước | T11 so với bản duyệt T10 | Rà soát báo và tự ghi nguyên nhân đã biết (tách đoạn, đổi tham số, làm thêm, nghỉ). Tháng đầu trên web không so | spec 11.3 | Rà soát |
| L-D34 | Gross thỏa thuận | Mọi người | = Σ khoản + KPI 100% cho mọi dòng, chỉ để xem, không vào tiền | BA bổ sung | Bảng lương |
| L-D35 | Truy lĩnh, truy thu | Dòng từ hồi tố gốc T10 nằm ở T11 | Có số, tháng gốc, lý do. Chịu thuế ở tháng chi. BH truy đóng tách riêng. Thực nhận không âm | R6 | Bảng lương, Phiếu |
| L-D36 | Thử việc nhận từ 5 tr chưa cam kết | Rà soát | Báo từng người, kèm cách thuế đang áp | spec 11.3 | Rà soát |
| L-D37 | Thực nhận | Có BH, thuế, hỗ trợ, hoàn ứng, tạm ứng | = Thu nhập thực tế − BH − đoàn phí − thuế + hỗ trợ + hoàn ứng − tạm ứng | spec 5.3 | Bảng lương |

### E. Duyệt, khoá, mở lại

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-E01 | Điều kiện duyệt | Bấm Duyệt T10 | Chặn chỉ khi kỳ công chưa chốt hoặc chưa Tính lại sau thay đổi cuối. Còn cảnh báo đỏ: phải tích "Đã xem" trong hộp Duyệt (L-M01) | spec 4.8, 11.4 | Bảng lương |
| L-E02 | Không có quyền Duyệt | Người chỉ có quyền Xem, sửa | Không thấy nút Duyệt, Mở lại. Gọi API thì 403 | spec 2 (1) | Bảng lương, API |
| L-E03 | Duyệt lần đầu | Duyệt T10 | Lưu bản chụp đủ như R4. Chip "Đã duyệt · lần 1 · 05/11 16:20 · bởi …" | R4 | Bảng lương |
| L-E04 | Sửa sau khi duyệt | Gõ ô, Tính lại, đổi ngày chi trên T10 đã duyệt | Ô khoá, nút ẩn. API trả 409 | R4 | Bảng lương, API |
| L-E05 | Đổi mọi thứ sau khi duyệt | Đổi tham số, khoản, quy tắc, hồ sơ, tên người, code | T10 không đổi một đồng (test so toàn bộ số trước và sau) | R4 | Integration test |
| L-E06 | Duyệt sai thứ tự | Duyệt T11 khi T10 còn nháp | Không chặn. Cảnh báo "T10 còn nháp; số cộng dồn năm dùng nháp T10". T10 duyệt sau mà số đổi thì T11 hiện chênh, đi R6 | R9, spec 4.8 | Bảng lương |
| L-E07 | Tháng đầu tiên trên web | T11/2026 là tháng đầu, các tháng trước nằm ở Excel cũ | Nhập số dư đầu năm thuế 2026 từng người theo ngày chi (mọi lần chi trong năm 2026 trước lần chi đầu trên web, gồm lương T12/2025 nếu chi trong 2026): thu nhập chịu thuế, thuế đã khấu trừ, giờ làm thêm năm, trang phục đã trả, số tháng đã trả. Dùng cho cộng dồn, trần trang phục và quyết toán | R9, NĐ 253 Đ.46 k3, câu 34 | Hồ sơ lương |
| L-E08 | Đánh dấu Đã chuyển khoản | Ghi ngày chuyển khoản cho T10 | Hộp L-M05. Trạng thái "Đã chuyển khoản dd/mm". Từ đó không mở lại được, chỉ truy lĩnh hoặc truy thu | R7, câu 31 | Bảng lương |
| L-E09 | Mở lại | Bấm Mở lại không lý do; có lý do | Không lý do: từ chối. Có lý do: về Nháp, nhật ký | spec 2 (4), R7 | Bảng lương |
| L-E10 | Mở lại tháng cũ | T9, T10 đã duyệt, mở T9 | Từ chối. Mở lùi lần lượt từ T10 thì được | R7 | Bảng lương |
| L-E11 | Mở lại sau khi có thay đổi hồi tố | Mở T10, trước đó có tăng lương từ 01/10 | Nháp tính lại có mức mới. Bảng chênh so với bản duyệt lần 1, từng người | R6, R7 | Bảng lương |
| L-E12 | Duyệt lại | Duyệt T10 lần 2 | Thành bản lần 2. Bản lần 1 vẫn giữ, tải được từ Nhật ký, mang chữ "đã thay bởi lần 2". Phiếu cũ đánh dấu bị thay | R7 | Bảng lương, Nhật ký |
| L-E13 | Mở lại, duyệt lại mà không đổi gì | Mở rồi duyệt ngay | Số y hệt lần 1. Nhật ký ghi "lần 2, không chênh" | R7 | Nhật ký |
| L-E14 | Hai người cùng sửa nháp | HR và kế toán cùng sửa T11 | Người lưu sau nhận báo "Bảng đã đổi bởi … lúc …, tải lại". Không ghi đè im lặng | **MĐ** | Bảng lương |
| L-E15 | Duyệt khi còn hồi tố chưa xử lý | T11 có danh sách hồi tố chưa chọn cách | Không chặn. Rà soát vàng "Có hồi tố chưa chọn cách". Duyệt luôn thì áp mặc định (a), nhật ký ghi | R6, spec 4.8 | Bảng lương |
| L-E16 | Người lập tự duyệt | Một người vừa tính lại vừa có quyền Duyệt | Được (D14 mặc định). Nhật ký ghi rõ cùng người. Excel vẫn có ba dòng ký Người lập biểu, Kế toán trưởng, Giám đốc | D14, câu 28 | Bảng lương |
| L-E17 | Công ty không cho tự duyệt | Đặt D14 = không được; người tính lại lần cuối bấm Duyệt | Nút Duyệt mờ, câu "Người lập không tự duyệt (cấu hình công ty)". API 403. Người khác có quyền Duyệt thì duyệt được | D14, spec 4.8 | Bảng lương |

### F. Xuất Excel, phiếu lương, nhiều tháng, tổng hợp năm

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-F01 | Tải lại tháng đã duyệt | Tải T10 ngày 06/11 và ngày 20/12, giữa hai lần đổi nhiều cấu hình | Hai file cùng số từng ô, chỉ khác dấu giờ tải | R4, R8 | Excel |
| L-F02 | Dấu bản duyệt | Mở file T10 | Đầu sheet: "Bản duyệt lần 2 · duyệt 08/11 09:10 bởi … · tải 20/12 14:03 bởi …" | R8 | Excel |
| L-F03 | Sheet Tham số áp dụng | Mở file T10 | Có kỳ công, ngày chi trả, tháng BH, năm thuế, công chuẩn, lần chốt kỳ công, phiên bản công thức, từng tham số, khoản, quy tắc, loại HĐ (giá trị, áp dụng từ, nguồn), ô gõ đè | R8 | Excel |
| L-F04 | Tháng có tách đoạn | Tải T11 có NV03 tăng lương 01/11 | Sheet Tham số có mục "Tách đoạn": NV03, 26/10–31/10 mức A, 01/11–25/11 mức B | R8 | Excel |
| L-F05 | Tải nháp | Tải T11 nháp | Tiêu đề "(BẢN NHÁP)", dấu "tính lúc …, số còn đổi", không có "bản duyệt". Khối ký tên vẫn có | R8, CC TC-XL-22, **MĐ** | Excel |
| L-F06 | Tải nháp hai lần, có thay đổi giữa | Tải, đổi tham số chạm T11, tải lại | Số khác, dấu giờ khác. Nhật ký có cả hai lần tải | R3, R8 | Excel, Nhật ký |
| L-F07 | Tháng có nhãn | T10 có hồi tố chưa xử lý, hoặc kỳ công mở lại | Đầu sheet và sheet Tham số ghi nhãn, kèm tháng sẽ xử lý | R6, R7 | Excel |
| L-F08 | Nhiều tháng qua mốc luật | Tải T6, T7/2026 | Mỗi sheet dùng bản của nó. Sheet Tham số có một cột mỗi tháng, ô khác nhau tô màu | R8 | Excel |
| L-F09 | Nhiều tháng có nháp | Chọn T8, T9 (duyệt), T10 (nháp) | Hộp tải báo "1 bản nháp". Sheet T10 có chữ NHÁP. Sheet Tổng hợp ghi "gồm số nháp T10" | R8, phác thảo | Excel |
| L-F10 | Sheet Tổng hợp | Chọn T8–T10 | Mỗi mã NV một dòng, cộng số trên các sheet, không tính lại. Tên, khu vực, khối theo tháng gần nhất, ghi chú nếu tháng trước khác | R8, **MĐ** | Excel |
| L-F11 | Các tháng khác bộ cột | T10 không có "Phụ cấp đi lại", T11 có | Mỗi sheet theo cột của tháng đó. Tổng hợp gộp mọi cột, ô trống ở tháng không có | R1, R8 | Excel |
| L-F12 | Ẩn cột H | Tích "Ẩn cột H" | Không có email, STK, ngân hàng trong mọi sheet | Phác thảo | Excel |
| L-F13 | Tên file | Tải duyệt, nháp, nhiều tháng | `Bang-luong-10-2026-lan-2.xlsx`, `Bang-luong-11-2026-NHAP.xlsx`, `Bang-luong-2026-T08-T10.xlsx` | **MĐ** | Excel |
| L-F14 | Tải bản duyệt cũ | Từ Nhật ký bấm "Tải bản lần 1" của T10 | Đúng số bản 1. Dấu "đã thay bởi lần 2" | R7 | Nhật ký, Excel |
| L-F15 | Tải cả năm | Tổng quan › Tải cả năm 2026 | Gồm tháng đã duyệt và nháp (đánh dấu). Không gồm tháng dự tính | R8, **MĐ** | Tổng quan, Excel |
| L-F16 | Chọn tháng qua hai năm | Muốn T12/2026 và T1/2027 | Chọn theo từng năm như phác thảo. Muốn hai năm thì tải hai lần | **MĐ** | Excel |
| L-F17 | Ba nơi khớp nhau | So màn hình, Excel, Tổng quan của T10 | Tổng từng cột bằng nhau tới đồng | R8 | Excel, Tổng quan |
| L-F18 | Phiếu lương tháng duyệt | Mở phiếu NV05 T10 | Lấy từ bản chụp. Có thu nhập, làm thêm, khấu trừ, thực nhận. STK chỉ 4 số cuối. Dấu bản duyệt | BLLĐ Đ.95 k3, R4 | Phiếu lương |
| L-F19 | Phiếu tháng nháp | Mở phiếu T11 nháp | Chữ "NHÁP" chìm, không có nút gửi | **MĐ** | Phiếu lương |
| L-F20 | Phiếu sau khi duyệt lại | T10 duyệt lần 2 | Phiếu ghi "Thay phiếu bản lần 1". Phiếu cũ vẫn xem được trong Nhật ký | R7 | Phiếu lương |
| L-F21 | Phiếu người nghỉ việc và truy lĩnh | NV08 nghỉ việc; NV03 có truy lĩnh gốc T10 | Phiếu có tiền phép, thuế 10%. Dòng truy lĩnh ghi tháng gốc, lý do | R6 | Phiếu lương |
| L-F22 | Nhiều phiếu | Chọn tất cả, tải Excel | Mỗi người một sheet, cùng bản của tháng. In vừa trang | Phác thảo | Phiếu lương |
| L-F23 | Khối ký tên | Tải Excel | Người lập biểu, Kế toán trưởng, Giám đốc; ngày trả = ngày chi trả. Web không hiện | spec 12.1 | Excel |

### G. Tổng quan

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-G01 | Tháng duyệt sau khi đổi tham số | Đổi tham số, xem cột T10 | Không đổi. Số lấy từ bản chụp | R4 | Tổng quan |
| L-G02 | Tháng nháp | Xem T11 nháp | Số tạm, nhãn Nháp, đổi theo nháp | R8 | Tổng quan |
| L-G03 | Tháng chưa chốt công | Xem T12 | "Dự tính" = mức hồ sơ có hiệu lực trong tháng đó × đủ công chuẩn, KPI 100%, không làm thêm, tham số của chính tháng đó | R8, **MĐ** | Tổng quan |
| L-G04 | Dự tính qua mốc luật | Đã nhập vùng mới từ 01/01/2027, xem T1/2027 | Dự tính T1 dùng mức mới. T12 dùng mức cũ | R2 | Tổng quan |
| L-G05 | Tháng trước khi có web | Xem T1–T7/2026 | "Chưa có dữ liệu", không cộng vào tổng | Phác thảo | Tổng quan |
| L-G06 | Tổng năm | Ô "Chi phí lương 2026" | Tách ba số: đã duyệt, nháp, dự tính. Không cộng lẫn | R8, **MĐ** | Tổng quan |
| L-G07 | Lọc Khu vực, Khối | NV07 HCM tới T10, HN từ T11; lọc HCM | T10 tính NV07 vào HCM, T11 thì không. Lọc theo thuộc tính của tháng đó, không theo hôm nay | R1, R4 | Tổng quan |
| L-G08 | So tháng trước | T11 nháp so với T10 duyệt | Có % chênh, ghi "so với bản duyệt T10". Tháng trước là nháp thì ghi "so với nháp" | **MĐ** | Tổng quan |
| L-G09 | Truy lĩnh hồi tố | Truy lĩnh gốc T10 chi ở T11 | Nằm ở T11. Tooltip "gồm truy lĩnh T10: …". Cột T10 không đổi | R6 | Tổng quan |
| L-G10 | Năm của Tổng quan | Chọn năm 2027 | 12 tháng lương T1–T12/2027 (T1 bắt đầu 26/12/2026). Ghi chú: khác năm thuế (theo ngày chi) và năm BH | R2 | Tổng quan |
| L-G11 | Cơ cấu chi phí | Bấm cột một tháng | Các phần cộng đúng tổng chi phí tháng đó | Phác thảo | Tổng quan |
| L-G12 | Thưởng tháng 13 | Có đợt chi T13 trong tháng 1 | Phần riêng "Thưởng T13" ở tháng chi | **MĐ** | Tổng quan |
| L-G13 | Tải từ Tổng quan | Chọn tháng, Tải Excel | Cùng luồng và cùng file với Tải nhiều tháng | Phác thảo | Tổng quan |

### H. Quyền và bảo mật

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-H01 | Không có quyền | Đăng nhập HR thường | Không thấy menu Lương | spec 2 (1) | Menu |
| L-H02 | Gọi API không quyền | Gọi mọi route lương: bảng, hồ sơ, cấu hình, Excel, phiếu, Tổng quan, nhật ký | 403 ở mọi route, thân lỗi không có số | spec 2 (1), 5 | API |
| L-H03 | Gõ thẳng địa chỉ | Mở `/hr/luong?ky=2026-10` không quyền | Trang "Không có quyền", không lộ số | spec 2 (1) | Web |
| L-H04 | Có Xem, sửa nhưng không có Duyệt | Thử duyệt, mở lại, đánh dấu chuyển khoản | Không được, 403 | spec 2 (1) | Bảng lương |
| L-H05 | Cấp, bỏ quyền | Người có quyền Lương cấp cho người khác | Được. Người không có quyền Lương không thấy ô cấp. Có nhật ký | spec 10.2 | Tài khoản HR |
| L-H06 | Bỏ quyền người cuối cùng | Bỏ quyền của chính mình khi chỉ còn mình | Từ chối: "Phải còn ít nhất một người có quyền Lương và Duyệt" | **MĐ** | Tài khoản HR |
| L-H07 | `PAYROLL_ADMINS` | Đặt biến khi chưa ai có quyền; đặt lại khi đã có người | Lần đầu: cấp quyền. Sau đó: bỏ qua. Bỏ quyền trên web vẫn có hiệu lực | **MĐ** | Hệ thống |
| L-H08 | Bị bỏ quyền khi đang mở trang | Bỏ quyền khi người đó đang xem | Lần gọi kế tiếp 403, trang xoá số đang hiện | **MĐ** | Web |
| L-H09 | Nhật ký Chấm công | Người không quyền xem nhật ký, tìm mã NV | Không có dòng lương nào | spec 2 (1) | Chấm công › Nhật ký |
| L-H10 | Số tài khoản | Xem hồ sơ, bấm Hiện đủ; thiếu `PAYROLL_KEY` | 4 số cuối. Hiện đủ thì ghi nhật ký. Thiếu khoá: báo lỗi rõ, không sập trang, không lộ số | spec 10.2 | Hồ sơ lương |
| L-H11 | Ghi lần xem | Mở hồ sơ một người, xem, in, tải phiếu, tải Excel, hiện STK | Mỗi lần ghi nhật ký. Lướt bảng lương thì không | BA 5, **MĐ** | Nhật ký |
| L-H12 | Thông báo cho người không quyền | Cảnh báo ở Chấm công (L-C07) | Không có số tiền, không có tên khoản lương | **MĐ** | Chấm công |
| L-H13 | Dữ liệu thật | Test, docs, commit | Chỉ dữ liệu giả. Script so với file thật chạy trên máy, không commit | spec 14, CLAUDE.md | Repo |

### I. Nhật ký

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-I01 | Thêm mức tham số | Thêm trần tiền cơm từ 01/07 | Dòng: tham số, cũ → mới, áp dụng từ, nguồn, và "Ảnh hưởng: T7 nháp tính lại; T6 đã duyệt không đổi" | spec 11.9, R6 | Nhật ký |
| L-I02 | Lưu mà không đổi | Mở form, lưu | Không ghi | CC | Nhật ký |
| L-I03 | Sửa hồ sơ | Thêm mức mới cho NV01 | Cũ → mới từng khoản, ngày hiệu lực | spec 11.9 | Nhật ký |
| L-I04 | Tính lại | Bấm Tính lại có đổi và không đổi | Có đổi: ghi số dòng đổi và chênh thực nhận từng người. Không đổi: không ghi | **MĐ** | Nhật ký |
| L-I05 | Duyệt, mở lại, duyệt lại | Làm cả ba | Duyệt: lần N, số người, tổng thực nhận, tổng chi phí. Mở lại: lý do. Duyệt lại: chênh với lần trước | spec 11.9, R7 | Nhật ký |
| L-I06 | Hồi tố | Chọn cách xử lý ở L-A08 | Ghi tháng ảnh hưởng, cách chọn, người chọn, dòng truy lĩnh tạo ra | R6 | Nhật ký |
| L-I07 | Tải Excel và phiếu | Tải nhiều tháng, ẩn cột H; tải phiếu NV05 | Ghi tháng, bản (lần N hoặc nháp), tuỳ chọn; phiếu ghi của ai | spec 11.9, **MĐ** | Nhật ký |
| L-I08 | Sự kiện Chấm công liên quan | Mở lại, chốt lại kỳ đã có lương duyệt | Có dòng trong nhật ký lương, dẫn sang nhật ký Chấm công | R7 | Nhật ký |
| L-I09 | Lọc và tìm | Lọc Bảng lương, Hồ sơ, Cấu hình, Tải và xem; tìm NV05; lọc T10 | Đúng dòng. Xem thêm từng 100 dòng | CC | Nhật ký |
| L-I10 | Không sửa được nhật ký | Thử sửa, xoá qua API | Không có route. Nhật ký chỉ thêm | **MĐ** | API |
| L-I11 | Cấp, bỏ quyền | Cấp quyền Duyệt | Ghi ai cấp cho ai, quyền nào | spec 2 (1) | Nhật ký |

### J. Cả năm

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-J01 | Thưởng tháng 13 | Tạo đợt chi T13 ngày 20/01/2027 | Đợt chi riêng, gắn tháng chi. Chịu thuế ở tháng chi, không BH, không chia theo ngày. Có duyệt riêng | BLLĐ Đ.104, **MĐ** | Bảng lương |
| L-J02 | T13 cho người đã nghỉ, người 10% | Người nghỉ 30/11 nhận T13 6 tr | Khấu trừ 10% vì chi sau ngày nghỉ và từ 5 tr | NĐ 253 Đ.50 | Bảng lương |
| L-J03 | Lương T12 chi năm sau | T12/2026 chi 05/01/2027 | Tham số thuế, NPT, cam kết lấy theo ngày 05/01/2027. Vào năm thuế 2027. BH là tháng 12/2026 | R2, NĐ 253 Đ.46 k3, Đ.66 k1 a, câu 29 | Bảng lương, Tổng hợp năm |
| L-J04 | Kỳ T1 qua năm, lương tối thiểu vùng đổi 01/01 | T1/2027 (26/12/2026–25/01/2027), vùng mới từ 01/01/2027 | BH tháng 1/2027 dùng sàn mới. Lương thời gian dưới mức mới: Rà soát đề nghị thêm mức từ 01/01 (tách 26–31/12 và 01–25/01) | R2, NĐ lương tối thiểu vùng | Bảng lương, Rà soát |
| L-J05 | Lương cơ sở đổi 01/7 | T7/2026 | BH và trần dùng mức mới cả tháng lương T7 | R2 | Bảng lương |
| L-J06 | Nhiều tham số cùng đổi 01/01 | Vùng, giảm trừ, biểu thuế cùng đổi | Mỗi tham số lấy theo ngày tham chiếu của nó. Sheet Tham số liệt kê đủ | R2, R8 | Excel |
| L-J07 | Tổng hợp quyết toán | Tải tổng hợp năm thuế 2026 | Mỗi người: thu nhập chịu thuế, miễn, giảm trừ, BH, thuế đã khấu trừ, số tháng, cộng số dư đầu năm. Năm theo ngày chi | R2, R9, **MĐ** | Excel |
| L-J08 | Ai được quyết toán thay | Tổng hợp năm | Cột đánh dấu: HĐ từ 3 tháng, còn làm lúc quyết toán, có ủy quyền | NĐ 253 Đ.51, **MĐ** | Excel |
| L-J09 | Bộ đếm theo năm | Sang 2027 | Giờ làm thêm năm, mức trang phục năm về 0. Cam kết hết hạn. NPT tiếp tục tới "đến tháng" | R1, **MĐ** | Rà soát |
| L-J10 | Thứ tự qua năm | Duyệt T1/2027 khi T12/2026 còn nháp | Không chặn, cảnh báo như L-E06 | R9 | Bảng lương |
| L-J11 | Người nghỉ việc cần chứng từ khấu trừ | NV08 nghỉ tháng 10 | Tổng hợp năm có số thuế đã khấu trừ của người đó. Mẫu chứng từ để spec sau | **MĐ** | Excel |

### K. Engine số (tầng shared, `payroll.ts`)

Chạy trước mọi API và màn hình (spec 15, bước 1–9). Tham số mặc định: tháng BH 10/2026 (lương cơ sở 2.530.000, trần BHXH, BHYT 50.600.000), vùng I 5.310.000 (trần BHTN 106.200.000), ngày chi 05/11/2026 (trần tiền ăn 1.200.000, ngưỡng 10% 5.000.000), giảm trừ 15.500.000 / 6.200.000, biểu 5 bậc, NPT 0, làm tròn D01.

**Hồ sơ K**: lương thời gian 8.000.000, PC trách nhiệm 1.500.000 và chuyên cần 1.000.000 (ba khoản tính BH và là lương theo HĐ, lương đóng BH 10.500.000), tiền cơm 1.100.000 (miễn tới trần), xăng xe 1.500.000 (chịu thuế), điện thoại 500.000 (miễn tới mức ở hồ sơ) và trang phục 350.000 (miễn, chưa chạm trần năm), nhà ở 8.500.000, KPI 10.500.000. Mọi khoản chia theo ngày và × TV. Tháng 10/2026 có 22 ngày T2–T6.

#### K1. Quy tắc BH, nghỉ việc, thuế, làm thêm, làm tròn

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Tầng |
|---|---|---|---|---|---|
| L-K1-01 | Chính thức, Hồ sơ K, nghỉ việc 09/10 | Tính BH tháng 10 | Làm 7 ngày T2–T6 (01–09/10); 15 ngày sau ngày nghỉ không hưởng lương ≥ 14: không đóng BHXH, BHTN. (27) 10.500.000; (29) 157.500, (44) 315.000 (D04); (28), (30), (43), (45), (46) = 0 | BH-1, D03, D04 | shared |
| L-K1-02 | Như trên, nghỉ 15/10 | Tính BH tháng 10 | 11 ngày không hưởng lương (16–30/10) < 14: đóng đủ như L-K1-03. Cách cũ "làm dưới 14 ngày thì không đóng" ra ngược lại; mặc định đọc theo chữ Luật BHXH 2024 Đ.33 k5 | BH-1, câu 14, 17.3 K4 | shared |
| L-K1-03 | Như trên, nghỉ 20/10 | Tính BH tháng 10 | 8 ngày không hưởng lương < 14: đóng đủ. (28) 840.000, (29) 157.500, (30) 105.000, (43) 1.837.500, (44) 315.000, (45) 105.000, (46) 210.000 | BH-1 | shared |
| L-K1-04 | Như trên, nghỉ 21/10 | Tính BH tháng 10 | 7 ngày không hưởng lương: đóng đủ như L-K1-03 | BH-1 | shared |
| L-K1-05 | Cả tháng thuộc HĐ, KL 14 ngày T2–T6 trong 01–31/10 | Tính BH tháng 10 | (28), (30), (43), (45), (46) = 0; (27) vẫn 10.500.000; (29) 157.500, (44) 315.000 (D04: nghỉ không lương vẫn đóng BHYT) | BH-2, D03, D04 | shared |
| L-K1-06 | KL 13,5 ngày | Tính BH tháng 10 | Đóng đủ như L-K1-03 | BH-2 | shared |
| L-K1-07 | KL 10 ngày T2–T6 trong 01–25/10 (kỳ T10) và 5 ngày trong 26–30/10 (kỳ T11 đang mở) | Tính T10 khi T11 chưa chốt; chốt T11 với KL 26–30/10 còn 3 | Lúc tính T10: 10 + 5 = 15, ghi "tạm": không đóng BHXH, BHTN tháng 10, BHYT vẫn đóng. Chốt T11: 10 + 3 = 13: phải đóng, T11 có dòng điều chỉnh BH tháng 10: NLĐ BHXH 840.000 + BHTN 105.000; công ty 1.837.500 + 105.000 + KPCĐ 210.000; có thanh báo | BH-2, spec 5.4, R6 | API |
| L-K1-08 | HĐ đóng BH, vào 07/10 | Tính BH tháng 10 | 4 ngày T2–T6 trước ngày vào không hưởng lương < 14: đóng tháng 10 trên đủ (27), không chia theo ngày công | BH-1 | shared |
| L-K1-09 | Vào 26/10 | Tính T10, T11 | Không có dòng T10. Tháng 10: 17 ngày T2–T6 trước ngày vào ≥ 14, không đóng; T11 đóng | BH-1 | shared |
| L-K1-10 | Thử việc HĐ riêng tới 14/10, HĐLĐ đóng BH từ 15/10 | Tính BH tháng 10 | 10 ngày T2–T6 (01–14/10) thuộc HĐ không đóng BH < 14: **đóng đủ tháng 10** | BH-1, câu 14 | shared |
| L-K1-11 | HĐLĐ đóng BH từ 20/10; biên: từ 21/10 | Tính BH tháng 10 | Từ 20/10: 13 ngày trước đó < 14, đóng đủ tháng 10. Từ 21/10: 14 ngày ≥ 14, không đóng tháng 10 | BH-1 | shared |
| L-K1-12 | Tiền phép chưa nghỉ: Hồ sơ K là hồ sơ tháng trước, chuẩn kỳ trước 22, còn 3 ngày phép | Tính dòng nghỉ việc | Lương theo HĐ (8.000.000 + 1.500.000 + 1.000.000) ÷ 22 × 3 = 10.500.000 ÷ 22 × 3 = **1.431.818**. Vào (24) dòng "Tiền phép chưa nghỉ", cộng vào (33), không vào (27). HR bật thêm khoản khác vào lương theo HĐ thì phần thêm chịu thuế | D08, NĐ 145/2020 Đ.67 k3, NĐ 253 Đ.26 k2, k3, câu 18 | shared |
| L-K1-13 | Người nghỉ việc, phép còn 0, phép vượt 0,5 | Tính | Không có dòng tiền phép. Rà soát chỉ báo "nghỉ quá phép 0,5 ngày, Chấm công đã không trả", không trừ thêm | CC | shared |
| L-K1-14 | Chính thức, Hồ sơ K, nghỉ việc 15/10, 14/22 công, % KPI 0%, chi sau ngày nghỉ | Tính dòng | BH đủ (L-K1-02). (18) 1.020.455; (26) 14.286.364; (28) + (30) 945.000; (29) 157.500; (33) 1.240.909; (34) 13.045.455; (40) = 10% × 14.286.364 = **1.428.636**; (42) = 14.286.364 − 1.102.500 − 1.428.636 = **11.755.228**; (46) 210.000; (48) 16.753.864 | D02, D10, câu 12, 14 | shared |
| L-K1-15 | Như L-K1-14, nghỉ 01/10, 4/22 công | Tính dòng | 21 ngày không hưởng lương ≥ 14: chỉ BHYT. (26) 4.081.818 < 5.000.000: (40) **0**; (29) 157.500; (42) = 4.081.818 − 157.500 = **3.924.318** | NĐ 253 Đ.50 k2, D02, BH-1 | shared |
| L-K1-16 | Thử việc HĐ riêng 2 tháng, Hồ sơ K, không BH, 22/22 công, KPI theo công thức | Tính có cam kết; tính lại khi bỏ cam kết | (18) 918.409; (19) 90%; (20) 9.450.000; (26) 29.655.000; (34) 27.900.000. Ước tính năm 2 × 27.900.000 = 55.800.000 < 12 × 15.500.000 = 186.000.000: cam kết hợp lệ, (40) **0**, (42) 29.655.000. Bỏ cam kết: (40) = **2.965.500**, (42) 26.689.500 | NĐ 253 Đ.50 k2, D09 | shared |
| L-K1-17 | Thử việc HĐ riêng 2 tháng, thu nhập cao: lương thời gian 21.000.000, cơm 1.100.000, xăng 1.500.000, ĐT 500.000, nhà 10.300.000, chuyên cần 1.000.000, KPI 4.200.000; 22/22 công; có cam kết | (a) không có thu nhập khác trong năm; (b) số dư đầu năm có thu nhập chịu thuế 150.000.000 | (18) 1.448.182; (20) 3.780.000; (26) 35.640.000; (34) 34.200.000. (a) Ước tính năm 2 × 34.200.000 = 68.400.000 < 186.000.000: (40) **0**. (b) Ước tính 218.400.000 > 186.000.000: Rà soát vàng "Cam kết có thể không hợp lệ"; thuế vẫn 0 tới khi HR tắt cam kết; tắt thì (40) = **3.564.000**, (42) 32.076.000 | NĐ 253 Đ.50 k2, D09, câu 11 | shared |
| L-K1-18 | Thứ tự dòng | Mở Bảng lương, tải Excel, phiếu T10 | Khu vực (HCM rồi HN) → loại HĐ (không thời hạn, 12 tháng, thử việc) → khối (BO trước KD) → mã. 12 dòng của bộ vàng K3 nằm đúng nhóm như file T10; trong nhóm theo mã | D13, câu 26 | web, Excel |
| L-K1-19 | Làm lễ: Hồ sơ K, chính thức 22/22, KPI 80%, `holidayWorked` 1 | Tính dòng | (25) = 1 × 1.020.455 × 300% = **3.061.364**; (26) 33.911.364; (33) = 1.950.000 + 3.061.364 = 5.011.364. Không lấy MIN với OT | BLLĐ Đ.98, spec 5.3 | shared |
| L-K1-20 | Làm CN: `sundayWorked` 1. (a) OT ngày 1; (b) OT ngày 0 (nghỉ KL một ngày thường) | Điền sẵn, tính | (a) Ngoài (17), 200%: (25) = 1.020.455 × 200% = **2.040.909**; (26) 32.890.909. (b) D12 mặc định: CN đã nằm trong (17), cộng 100%: (25) = **1.020.455**; (26) 31.870.455; (33) = 1.950.000 + 1.020.455 + 1.020.454,55 = **3.990.910** (cả 200% của ngày CN là tiền làm thêm); Rà soát báo "CN bù ngày thường". D12 "đổi ngày nghỉ theo nội quy": (25) 0, (26) 30.850.000 | BLLĐ Đ.98 k1 b, D12, câu 19 | shared |
| L-K1-21 | Làm tròn: đường L-K2-49 (thử việc nghỉ việc, HCM, có KPI) | Tính hai chế độ | D01: phần lương ngày Tròn(918.409,09 × 14) = 12.857.727; (20) Tròn(6.013.636,36) = 6.013.636; (26) **18.871.363**; (40) 1.887.136; (42) = 18.871.363 − 1.887.136 = 16.984.227. "Như file HR": (26) = Tròn(18.871.363,64) = **18.871.364**, (42) = Tròn(16.984.227,27) = 16.984.227, lệch 1 đồng so với (26) − (41) hiện ra. Mọi dòng K2, K3-S thoả (42) = (26) − (41) + (32) | D01, câu 25 | shared |
| L-K1-22 | Trần trang phục năm: Hồ sơ K đủ công, số dư đầu năm trang phục đã trả 4.800.000 | Tính tháng chi trong cùng năm thuế | Miễn 200.000 (phần còn lại của 5.000.000), 150.000 chịu thuế: (33) = 1.950.000 − 150.000 = **1.800.000**. Rà soát vàng "Trang phục chạm trần năm". Lần chi đầu năm thuế sau: trần về 5.000.000 | NĐ 253 Đ.8 k2 đ, VBHN 19/VBHN-BTC Đ.10 k8 đ, câu 2 | shared |
| L-K1-23 | Tháng đầu làm việc, ốm 15 ngày T2–T6 | Vào 01/10, HĐ đóng BH, OM 15 ngày | Vẫn đóng BHXH: (28) 840.000, (43) 1.837.500, (46) 210.000 (Đ.33 k6). BHTN không đóng: (30), (45) = 0 (Luật Việc làm 2025 Đ.33 k4 không có ngoại lệ). BHYT do BHXH đóng: (29), (44) = 0 | Luật BHXH 2024 Đ.33 k6, Luật BHYT Đ.12 k2 b, D04 | shared |
| L-K1-24 | Thai sản 15 ngày T2–T6 so với KL 15 ngày, cả tháng thuộc HĐ | Tính BH tháng 10 hai lần | Cả hai: (28), (30), (43), (45), (46) = 0. Thai sản: (29), (44) = 0 vì BHXH đóng BHYT. KL: (29) 157.500, (44) 315.000 (D04) | BH-2, Luật BHYT Đ.12 k2 b, k5 c, D04, câu 15 | shared |

#### K2. Ma trận 64 đường

Thử việc (HĐ riêng, không BH, cam kết hợp lệ, KPI theo công thức) hay chính thức (đóng BH đủ, KPI 80%, lũy tiến) × nghỉ việc 15/10 hay không × HCM (chuẩn 22) hay HN (chuẩn 24) × có KPI 10.500.000 hay không × làm thêm (OT: 10 giờ ngày thường + 1 công ngày nghỉ, là đầu vào engine sau bước điền sẵn) hay không × hỗ trợ (HT) 700.000 hay không. Hồ sơ K.

- Người nghỉ 15/10: (17) = **14** = số T2–T6 của kỳ 26/09–15/10, không đi thứ Bảy nào (cả HCM và HN). Tháng 10 dương lịch có 11 ngày không hưởng lương < 14: chính thức đóng BH đủ (BH-1, L-K1-02). Chi 05/11 sau ngày nghỉ: 10% khi (26) + HT ≥ 5.000.000 (D02, D10), kể cả thử việc có cam kết.
- Lương đóng BH của chính thức = 10.500.000 (Hồ sơ K). Công ngày nghỉ là công ngoài (17), trả 200%.
- (38) hiện số theo công thức kể cả khi cách thuế là 10% hoặc không khấu trừ; (40) theo cách thuế.
- Mỗi dòng là một test: dựng đúng đầu vào, so cả 13 cột tiền.

| Mã | TV | Nghỉ | KV | KPI | OT | HT | (17) | (18) | (20) | (25) | (26) | (29) | (28)+(30) | (33) | (34) | (38) | (40) | (42) | (46) | (48) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L-K2-01 | – | – | HCM | có | – | – | 22 | 1.020.455 | 8.400.000 | 0 | 30.850.000 | 157.500 | 945.000 | 1.950.000 | 28.900.000 | 12.297.500 | 729.750 | 29.017.750 | 210.000 | 33.317.500 |
| L-K2-02 | – | – | HCM | có | – | có | 22 | 1.020.455 | 8.400.000 | 0 | 30.850.000 | 157.500 | 945.000 | 1.950.000 | 29.600.000 | 12.997.500 | 799.750 | 29.647.750 | 210.000 | 34.017.500 |
| L-K2-03 | – | – | HCM | có | có | – | 22 | 1.020.455 | 8.400.000 | 3.954.261 | 34.804.261 | 157.500 | 945.000 | 5.904.261 | 28.900.000 | 12.297.500 | 729.750 | 32.972.011 | 210.000 | 37.271.761 |
| L-K2-04 | – | – | HCM | có | có | có | 22 | 1.020.455 | 8.400.000 | 3.954.261 | 34.804.261 | 157.500 | 945.000 | 5.904.261 | 29.600.000 | 12.997.500 | 799.750 | 33.602.011 | 210.000 | 37.971.761 |
| L-K2-05 | – | – | HCM | – | – | – | 22 | 1.020.455 | 0 | 0 | 22.450.000 | 157.500 | 945.000 | 1.950.000 | 20.500.000 | 3.897.500 | 194.875 | 21.152.625 | 210.000 | 24.917.500 |
| L-K2-06 | – | – | HCM | – | – | có | 22 | 1.020.455 | 0 | 0 | 22.450.000 | 157.500 | 945.000 | 1.950.000 | 21.200.000 | 4.597.500 | 229.875 | 21.817.625 | 210.000 | 25.617.500 |
| L-K2-07 | – | – | HCM | – | có | – | 22 | 1.020.455 | 0 | 3.954.261 | 26.404.261 | 157.500 | 945.000 | 5.904.261 | 20.500.000 | 3.897.500 | 194.875 | 25.106.886 | 210.000 | 28.871.761 |
| L-K2-08 | – | – | HCM | – | có | có | 22 | 1.020.455 | 0 | 3.954.261 | 26.404.261 | 157.500 | 945.000 | 5.904.261 | 21.200.000 | 4.597.500 | 229.875 | 25.771.886 | 210.000 | 29.571.761 |
| L-K2-09 | – | – | HN | có | – | – | 24 | 935.417 | 8.400.000 | 0 | 30.850.000 | 157.500 | 945.000 | 1.950.000 | 28.900.000 | 12.297.500 | 729.750 | 29.017.750 | 210.000 | 33.317.500 |
| L-K2-10 | – | – | HN | có | – | có | 24 | 935.417 | 8.400.000 | 0 | 30.850.000 | 157.500 | 945.000 | 1.950.000 | 29.600.000 | 12.997.500 | 799.750 | 29.647.750 | 210.000 | 34.017.500 |
| L-K2-11 | – | – | HN | có | có | – | 24 | 935.417 | 8.400.000 | 3.624.740 | 34.474.740 | 157.500 | 945.000 | 5.574.740 | 28.900.000 | 12.297.500 | 729.750 | 32.642.490 | 210.000 | 36.942.240 |
| L-K2-12 | – | – | HN | có | có | có | 24 | 935.417 | 8.400.000 | 3.624.740 | 34.474.740 | 157.500 | 945.000 | 5.574.740 | 29.600.000 | 12.997.500 | 799.750 | 33.272.490 | 210.000 | 37.642.240 |
| L-K2-13 | – | – | HN | – | – | – | 24 | 935.417 | 0 | 0 | 22.450.000 | 157.500 | 945.000 | 1.950.000 | 20.500.000 | 3.897.500 | 194.875 | 21.152.625 | 210.000 | 24.917.500 |
| L-K2-14 | – | – | HN | – | – | có | 24 | 935.417 | 0 | 0 | 22.450.000 | 157.500 | 945.000 | 1.950.000 | 21.200.000 | 4.597.500 | 229.875 | 21.817.625 | 210.000 | 25.617.500 |
| L-K2-15 | – | – | HN | – | có | – | 24 | 935.417 | 0 | 3.624.740 | 26.074.740 | 157.500 | 945.000 | 5.574.740 | 20.500.000 | 3.897.500 | 194.875 | 24.777.365 | 210.000 | 28.542.240 |
| L-K2-16 | – | – | HN | – | có | có | 24 | 935.417 | 0 | 3.624.740 | 26.074.740 | 157.500 | 945.000 | 5.574.740 | 21.200.000 | 4.597.500 | 229.875 | 25.442.365 | 210.000 | 29.242.240 |
| L-K2-17 | – | có | HCM | có | – | – | 14 | 1.020.455 | 8.400.000 | 0 | 22.686.364 | 157.500 | 945.000 | 1.240.909 | 21.445.455 | 4.842.955 | 2.268.636 | 19.315.228 | 210.000 | 25.153.864 |
| L-K2-18 | – | có | HCM | có | – | có | 14 | 1.020.455 | 8.400.000 | 0 | 22.686.364 | 157.500 | 945.000 | 1.240.909 | 22.145.455 | 5.542.955 | 2.338.636 | 19.945.228 | 210.000 | 25.853.864 |
| L-K2-19 | – | có | HCM | có | có | – | 14 | 1.020.455 | 8.400.000 | 3.954.261 | 26.640.625 | 157.500 | 945.000 | 5.195.170 | 21.445.455 | 4.842.955 | 2.664.063 | 22.874.062 | 210.000 | 29.108.125 |
| L-K2-20 | – | có | HCM | có | có | có | 14 | 1.020.455 | 8.400.000 | 3.954.261 | 26.640.625 | 157.500 | 945.000 | 5.195.170 | 22.145.455 | 5.542.955 | 2.734.063 | 23.504.062 | 210.000 | 29.808.125 |
| L-K2-21 | – | có | HCM | – | – | – | 14 | 1.020.455 | 0 | 0 | 14.286.364 | 157.500 | 945.000 | 1.240.909 | 13.045.455 | 0 | 1.428.636 | 11.755.228 | 210.000 | 16.753.864 |
| L-K2-22 | – | có | HCM | – | – | có | 14 | 1.020.455 | 0 | 0 | 14.286.364 | 157.500 | 945.000 | 1.240.909 | 13.745.455 | 0 | 1.498.636 | 12.385.228 | 210.000 | 17.453.864 |
| L-K2-23 | – | có | HCM | – | có | – | 14 | 1.020.455 | 0 | 3.954.261 | 18.240.625 | 157.500 | 945.000 | 5.195.170 | 13.045.455 | 0 | 1.824.063 | 15.314.062 | 210.000 | 20.708.125 |
| L-K2-24 | – | có | HCM | – | có | có | 14 | 1.020.455 | 0 | 3.954.261 | 18.240.625 | 157.500 | 945.000 | 5.195.170 | 13.745.455 | 0 | 1.894.063 | 15.944.062 | 210.000 | 21.408.125 |
| L-K2-25 | – | có | HN | có | – | – | 14 | 935.417 | 8.400.000 | 0 | 21.495.833 | 157.500 | 945.000 | 1.137.500 | 20.358.333 | 3.755.833 | 2.149.583 | 18.243.750 | 210.000 | 23.963.333 |
| L-K2-26 | – | có | HN | có | – | có | 14 | 935.417 | 8.400.000 | 0 | 21.495.833 | 157.500 | 945.000 | 1.137.500 | 21.058.333 | 4.455.833 | 2.219.583 | 18.873.750 | 210.000 | 24.663.333 |
| L-K2-27 | – | có | HN | có | có | – | 14 | 935.417 | 8.400.000 | 3.624.740 | 25.120.573 | 157.500 | 945.000 | 4.762.240 | 20.358.333 | 3.755.833 | 2.512.057 | 21.506.016 | 210.000 | 27.588.073 |
| L-K2-28 | – | có | HN | có | có | có | 14 | 935.417 | 8.400.000 | 3.624.740 | 25.120.573 | 157.500 | 945.000 | 4.762.240 | 21.058.333 | 4.455.833 | 2.582.057 | 22.136.016 | 210.000 | 28.288.073 |
| L-K2-29 | – | có | HN | – | – | – | 14 | 935.417 | 0 | 0 | 13.095.833 | 157.500 | 945.000 | 1.137.500 | 11.958.333 | 0 | 1.309.583 | 10.683.750 | 210.000 | 15.563.333 |
| L-K2-30 | – | có | HN | – | – | có | 14 | 935.417 | 0 | 0 | 13.095.833 | 157.500 | 945.000 | 1.137.500 | 12.658.333 | 0 | 1.379.583 | 11.313.750 | 210.000 | 16.263.333 |
| L-K2-31 | – | có | HN | – | có | – | 14 | 935.417 | 0 | 3.624.740 | 16.720.573 | 157.500 | 945.000 | 4.762.240 | 11.958.333 | 0 | 1.672.057 | 13.946.016 | 210.000 | 19.188.073 |
| L-K2-32 | – | có | HN | – | có | có | 14 | 935.417 | 0 | 3.624.740 | 16.720.573 | 157.500 | 945.000 | 4.762.240 | 12.658.333 | 0 | 1.742.057 | 14.576.016 | 210.000 | 19.888.073 |
| L-K2-33 | có | – | HCM | có | – | – | 22 | 918.409 | 9.450.000 | 0 | 29.655.000 | 0 | 0 | 1.755.000 | 27.900.000 | 12.400.000 | 0 | 29.655.000 | 0 | 29.655.000 |
| L-K2-34 | có | – | HCM | có | – | có | 22 | 918.409 | 9.450.000 | 0 | 29.655.000 | 0 | 0 | 1.755.000 | 28.600.000 | 13.100.000 | 0 | 30.355.000 | 0 | 30.355.000 |
| L-K2-35 | có | – | HCM | có | có | – | 22 | 918.409 | 9.450.000 | 3.558.835 | 33.213.835 | 0 | 0 | 5.313.835 | 27.900.000 | 12.400.000 | 0 | 33.213.835 | 0 | 33.213.835 |
| L-K2-36 | có | – | HCM | có | có | có | 22 | 918.409 | 9.450.000 | 3.558.835 | 33.213.835 | 0 | 0 | 5.313.835 | 28.600.000 | 13.100.000 | 0 | 33.913.835 | 0 | 33.913.835 |
| L-K2-37 | có | – | HCM | – | – | – | 22 | 918.409 | 0 | 0 | 20.205.000 | 0 | 0 | 1.755.000 | 18.450.000 | 2.950.000 | 0 | 20.205.000 | 0 | 20.205.000 |
| L-K2-38 | có | – | HCM | – | – | có | 22 | 918.409 | 0 | 0 | 20.205.000 | 0 | 0 | 1.755.000 | 19.150.000 | 3.650.000 | 0 | 20.905.000 | 0 | 20.905.000 |
| L-K2-39 | có | – | HCM | – | có | – | 22 | 918.409 | 0 | 3.558.835 | 23.763.835 | 0 | 0 | 5.313.835 | 18.450.000 | 2.950.000 | 0 | 23.763.835 | 0 | 23.763.835 |
| L-K2-40 | có | – | HCM | – | có | có | 22 | 918.409 | 0 | 3.558.835 | 23.763.835 | 0 | 0 | 5.313.835 | 19.150.000 | 3.650.000 | 0 | 24.463.835 | 0 | 24.463.835 |
| L-K2-41 | có | – | HN | có | – | – | 24 | 841.875 | 9.450.000 | 0 | 29.655.000 | 0 | 0 | 1.755.000 | 27.900.000 | 12.400.000 | 0 | 29.655.000 | 0 | 29.655.000 |
| L-K2-42 | có | – | HN | có | – | có | 24 | 841.875 | 9.450.000 | 0 | 29.655.000 | 0 | 0 | 1.755.000 | 28.600.000 | 13.100.000 | 0 | 30.355.000 | 0 | 30.355.000 |
| L-K2-43 | có | – | HN | có | có | – | 24 | 841.875 | 9.450.000 | 3.262.266 | 32.917.266 | 0 | 0 | 5.017.266 | 27.900.000 | 12.400.000 | 0 | 32.917.266 | 0 | 32.917.266 |
| L-K2-44 | có | – | HN | có | có | có | 24 | 841.875 | 9.450.000 | 3.262.266 | 32.917.266 | 0 | 0 | 5.017.266 | 28.600.000 | 13.100.000 | 0 | 33.617.266 | 0 | 33.617.266 |
| L-K2-45 | có | – | HN | – | – | – | 24 | 841.875 | 0 | 0 | 20.205.000 | 0 | 0 | 1.755.000 | 18.450.000 | 2.950.000 | 0 | 20.205.000 | 0 | 20.205.000 |
| L-K2-46 | có | – | HN | – | – | có | 24 | 841.875 | 0 | 0 | 20.205.000 | 0 | 0 | 1.755.000 | 19.150.000 | 3.650.000 | 0 | 20.905.000 | 0 | 20.905.000 |
| L-K2-47 | có | – | HN | – | có | – | 24 | 841.875 | 0 | 3.262.266 | 23.467.266 | 0 | 0 | 5.017.266 | 18.450.000 | 2.950.000 | 0 | 23.467.266 | 0 | 23.467.266 |
| L-K2-48 | có | – | HN | – | có | có | 24 | 841.875 | 0 | 3.262.266 | 23.467.266 | 0 | 0 | 5.017.266 | 19.150.000 | 3.650.000 | 0 | 24.167.266 | 0 | 24.167.266 |
| L-K2-49 | có | có | HCM | có | – | – | 14 | 918.409 | 6.013.636 | 0 | 18.871.363 | 0 | 0 | 1.116.818 | 17.754.545 | 2.254.545 | 1.887.136 | 16.984.227 | 0 | 18.871.363 |
| L-K2-50 | có | có | HCM | có | – | có | 14 | 918.409 | 6.013.636 | 0 | 18.871.363 | 0 | 0 | 1.116.818 | 18.454.545 | 2.954.545 | 1.957.136 | 17.614.227 | 0 | 19.571.363 |
| L-K2-51 | có | có | HCM | có | có | – | 14 | 918.409 | 6.013.636 | 3.558.835 | 22.430.198 | 0 | 0 | 4.675.653 | 17.754.545 | 2.254.545 | 2.243.020 | 20.187.178 | 0 | 22.430.198 |
| L-K2-52 | có | có | HCM | có | có | có | 14 | 918.409 | 6.013.636 | 3.558.835 | 22.430.198 | 0 | 0 | 4.675.653 | 18.454.545 | 2.954.545 | 2.313.020 | 20.817.178 | 0 | 23.130.198 |
| L-K2-53 | có | có | HCM | – | – | – | 14 | 918.409 | 0 | 0 | 12.857.727 | 0 | 0 | 1.116.818 | 11.740.909 | 0 | 1.285.773 | 11.571.954 | 0 | 12.857.727 |
| L-K2-54 | có | có | HCM | – | – | có | 14 | 918.409 | 0 | 0 | 12.857.727 | 0 | 0 | 1.116.818 | 12.440.909 | 0 | 1.355.773 | 12.201.954 | 0 | 13.557.727 |
| L-K2-55 | có | có | HCM | – | có | – | 14 | 918.409 | 0 | 3.558.835 | 16.416.562 | 0 | 0 | 4.675.653 | 11.740.909 | 0 | 1.641.656 | 14.774.906 | 0 | 16.416.562 |
| L-K2-56 | có | có | HCM | – | có | có | 14 | 918.409 | 0 | 3.558.835 | 16.416.562 | 0 | 0 | 4.675.653 | 12.440.909 | 0 | 1.711.656 | 15.404.906 | 0 | 17.116.562 |
| L-K2-57 | có | có | HN | có | – | – | 14 | 841.875 | 5.512.500 | 0 | 17.298.750 | 0 | 0 | 1.023.750 | 16.275.000 | 775.000 | 1.729.875 | 15.568.875 | 0 | 17.298.750 |
| L-K2-58 | có | có | HN | có | – | có | 14 | 841.875 | 5.512.500 | 0 | 17.298.750 | 0 | 0 | 1.023.750 | 16.975.000 | 1.475.000 | 1.799.875 | 16.198.875 | 0 | 17.998.750 |
| L-K2-59 | có | có | HN | có | có | – | 14 | 841.875 | 5.512.500 | 3.262.266 | 20.561.016 | 0 | 0 | 4.286.016 | 16.275.000 | 775.000 | 2.056.102 | 18.504.914 | 0 | 20.561.016 |
| L-K2-60 | có | có | HN | có | có | có | 14 | 841.875 | 5.512.500 | 3.262.266 | 20.561.016 | 0 | 0 | 4.286.016 | 16.975.000 | 1.475.000 | 2.126.102 | 19.134.914 | 0 | 21.261.016 |
| L-K2-61 | có | có | HN | – | – | – | 14 | 841.875 | 0 | 0 | 11.786.250 | 0 | 0 | 1.023.750 | 10.762.500 | 0 | 1.178.625 | 10.607.625 | 0 | 11.786.250 |
| L-K2-62 | có | có | HN | – | – | có | 14 | 841.875 | 0 | 0 | 11.786.250 | 0 | 0 | 1.023.750 | 11.462.500 | 0 | 1.248.625 | 11.237.625 | 0 | 12.486.250 |
| L-K2-63 | có | có | HN | – | có | – | 14 | 841.875 | 0 | 3.262.266 | 15.048.516 | 0 | 0 | 4.286.016 | 10.762.500 | 0 | 1.504.852 | 13.543.664 | 0 | 15.048.516 |
| L-K2-64 | có | có | HN | – | có | có | 14 | 841.875 | 0 | 3.262.266 | 15.048.516 | 0 | 0 | 4.286.016 | 11.462.500 | 0 | 1.574.852 | 14.173.664 | 0 | 15.748.516 |

#### K3. Bộ vàng: một tháng ẩn danh dựng theo file T10

12 người giả NV A…NV L, mỗi người cùng cấu trúc một dòng của file T10: loại HĐ, khối, khu vực, công chuẩn, kiểu công (đủ công, nghỉ việc, vào giữa kỳ, có điều chỉnh), có hay không KPI, trang phục, nhà ở, ô (32), khoản không rõ nguồn. Mức tiền và số công đã đổi; không dòng nào trùng số với người thật. Chung: lương thời gian 6.400.000 và chuyên cần 1.000.000 (cả hai tính BH ở chế độ mặc định), tiền cơm 1.100.000, trang phục 350.000 khi có (chưa chạm trần năm).

| Người | Loại HĐ | Khối | KV | Chuẩn | (17) | Xăng xe | Điện thoại | Trang phục | Nhà ở | KPI | % KPI | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NV A | Không thời hạn | BO | HCM | 22 | 22 | 2.300.000 | 500.000 | có | 2.200.000 | 5.500.000 | 100% | |
| NV B | Không thời hạn | BO | HCM | 22 | 22 | 2.300.000 | 500.000 | có | 3.500.000 | 6.500.000 | 100% | |
| NV C | Không thời hạn | KD | HCM | 22 | 22 | 1.400.000 | 420.000 | có | 1.700.000 | 3.500.000 | 100% | |
| NV D | 12 tháng | KD | HCM | 22 | 22 | 800.000 | 420.000 | có | – | 2.500.000 | 100% | (32) 700.000 |
| NV E | 12 tháng | KD | HCM | 22 | 8,5 | 2.050.000 | 420.000 | – | – | 4.500.000 | 0% | Nghỉ việc 09/10 (giả định): tháng 10 có 15 ngày không hưởng lương, chỉ BHYT; chi sau ngày nghỉ |
| NV F | 12 tháng | KD | HCM | 22 | 19,5 | 1.000.000 | 420.000 | – | – | 4.700.000 | 80% | (32) 700.000 |
| NV G | Thử việc | BO | HCM | 22 | 20 | – | 450.000 | – | – | – | công thức | Công đã gồm điều chỉnh −0,5 |
| NV H | Thử việc | BO | HCM | 22 | 14 | – | 450.000 | – | – | 3.700.000 | công thức | Nghỉ việc, chi sau ngày nghỉ |
| NV I | Thử việc | BO | HCM | 22 | 18,5 | 1.500.000 | 500.000 | có | – | 6.100.000 | công thức | |
| NV J | Thử việc | KD | HCM | 22 | 13 | 1.000.000 | 450.000 | – | – | 4.500.000 | công thức (file: 0%) | Vào giữa kỳ |
| NV K | Không thời hạn | KD | HN | 24 | 24 | 3.150.000 | 500.000 | có | 2.700.000 | 5.500.000 | 100% | |
| NV L | Thử việc | KD | HN | 24 | 24 | 1.000.000 | 420.000 | – | – | 4.700.000 | công thức (file: 80%) | File: khoản 350.000 không rõ nguồn |

**Chế độ cấu hình mặc định** (spec 5, 5.9, D01–D15): xăng xe chịu thuế; điện thoại miễn tới mức ở hồ sơ, trang phục miễn (chưa chạm trần năm); lương thời gian và chuyên cần tính BH (lương đóng 7.400.000); (32) của NV D, NV F là hỗ trợ (chịu thuế, vào chi phí); KPCĐ 2%; % KPI thử việc theo công thức; khoản không rõ nguồn không nhập; thử việc đang làm có cam kết nhập ở hồ sơ (dữ liệu vào của bộ vàng, không phải mặc định); NV E, NV H theo D10, cơ sở D02.

| Mã | Người | (16) | (18) | (19) | (20) | (24) | (26) | (27) | (28) | (29) | (30) | (32) | (33) | (34) | (37) | (38) | (40) | (41) | (42) | (43) | (44) | (45) | (46) | (47) | (48) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L-K3-S01 | NV A | 19.350.000 | 629.545 | 100% | 5.500.000 | 0 | 19.350.000 | 7.400.000 | 592.000 | 111.000 | 74.000 | 0 | 1.950.000 | 17.400.000 | 777.000 | 1.123.000 | 56.150 | 833.150 | 18.516.850 | 1.295.000 | 222.000 | 74.000 | 148.000 | 1.739.000 | 21.089.000 |
| L-K3-S02 | NV B | 21.650.000 | 688.636 | 100% | 6.500.000 | 0 | 21.650.000 | 7.400.000 | 592.000 | 111.000 | 74.000 | 0 | 1.950.000 | 19.700.000 | 777.000 | 3.423.000 | 171.150 | 948.150 | 20.701.850 | 1.295.000 | 222.000 | 74.000 | 148.000 | 1.739.000 | 23.389.000 |
| L-K3-S03 | NV C | 15.870.000 | 562.273 | 100% | 3.500.000 | 0 | 15.870.000 | 7.400.000 | 592.000 | 111.000 | 74.000 | 0 | 1.870.000 | 14.000.000 | 777.000 | 0 | 0 | 777.000 | 15.093.000 | 1.295.000 | 222.000 | 74.000 | 148.000 | 1.739.000 | 17.609.000 |
| L-K3-S04 | NV D | 12.570.000 | 457.727 | 100% | 2.500.000 | 0 | 12.570.000 | 7.400.000 | 592.000 | 111.000 | 74.000 | 700.000 | 1.870.000 | 11.400.000 | 777.000 | 0 | 0 | 777.000 | 12.493.000 | 1.295.000 | 222.000 | 74.000 | 148.000 | 1.739.000 | 15.009.000 |
| L-K3-S05 | NV E | 15.470.000 | 498.636 | 0% | 0 | 0 | 4.238.409 | 7.400.000 | 0 | 111.000 | 0 | 0 | 587.273 | 3.651.136 | 111.000 | 0 | 0 | 111.000 | 4.127.409 | 0 | 222.000 | 0 | 0 | 222.000 | 4.460.409 |
| L-K3-S06 | NV F | 14.620.000 | 450.909 | 80% | 3.760.000 | 0 | 12.552.727 | 7.400.000 | 592.000 | 111.000 | 74.000 | 700.000 | 1.347.273 | 11.905.454 | 777.000 | 0 | 0 | 777.000 | 12.475.727 | 1.295.000 | 222.000 | 74.000 | 148.000 | 1.739.000 | 14.991.727 |
| L-K3-S07 | NV G | 8.950.000 | 366.136 | 81,8182% | 0 | 0 | 7.322.727 | 0 | 0 | 0 | 0 | 0 | 1.268.182 | 6.054.545 | 0 | 0 | 0 | 0 | 7.322.727 | 0 | 0 | 0 | 0 | 0 | 7.322.727 |
| L-K3-S08 | NV H | 12.650.000 | 366.136 | 57,2727% | 2.119.091 | 0 | 7.245.000 | 0 | 0 | 0 | 0 | 0 | 887.727 | 6.357.273 | 0 | 0 | 724.500 | 724.500 | 6.520.500 | 0 | 0 | 0 | 0 | 0 | 7.245.000 |
| L-K3-S09 | NV I | 16.950.000 | 443.864 | 75,6818% | 4.616.591 | 0 | 12.828.068 | 0 | 0 | 0 | 0 | 0 | 1.475.795 | 11.352.273 | 0 | 0 | 0 | 0 | 12.828.068 | 0 | 0 | 0 | 0 | 0 | 12.828.068 |
| L-K3-S10 | NV J | 14.450.000 | 407.045 | 53,1818% | 2.393.182 | 0 | 7.684.773 | 0 | 0 | 0 | 0 | 0 | 824.318 | 6.860.455 | 0 | 0 | 0 | 0 | 7.684.773 | 0 | 0 | 0 | 0 | 0 | 7.684.773 |
| L-K3-S11 | NV K | 20.700.000 | 633.333 | 100% | 5.500.000 | 0 | 20.700.000 | 7.400.000 | 592.000 | 111.000 | 74.000 | 0 | 1.950.000 | 18.750.000 | 777.000 | 2.473.000 | 123.650 | 900.650 | 19.799.350 | 1.295.000 | 222.000 | 74.000 | 148.000 | 1.739.000 | 22.439.000 |
| L-K3-S12 | NV L | 14.620.000 | 372.000 | 90% | 4.230.000 | 0 | 13.158.000 | 0 | 0 | 0 | 0 | 0 | 1.368.000 | 11.790.000 | 0 | 0 | 0 | 0 | 13.158.000 | 0 | 0 | 0 | 0 | 0 | 13.158.000 |
| Σ | | 187.850.000 |  |  | 40.618.864 | 0 | 155.169.704 | 51.800.000 | 3.552.000 | 777.000 | 444.000 | 1.400.000 | 17.348.568 | 139.221.136 | 4.773.000 | 7.019.000 | 1.075.450 | 5.848.450 | 150.721.254 | 7.770.000 | 1.554.000 | 444.000 | 888.000 | 10.656.000 | 167.225.704 |

**Chế độ "như file HR"** (cấu hình T10, D01 "như file HR"): một khoản "Xăng xe + ĐT" miễn thuế; cơm, trang phục miễn hết; chỉ lương thời gian tính BH; KPCĐ tắt; cơ sở 10% là (26); (32) của NV D, NV F là hoàn ứng (không chịu thuế, không chi phí); % KPI như HR gõ (NV J 0%, NV L 80%); NV L có thu nhập khác 350.000 chịu thuế; NV H khấu trừ 10%; NV E lũy tiến (ra 0). (16) luôn gồm KPI: file gốc thiếu KPI ở 4 dòng tương ứng NV E, F, J, L, là lỗi file, không tái tạo. Cùng cách tính này, chạy trên file T10 thật bằng script trên máy, khớp 228/228 ô số.

| Mã | Người | (16) | (18) | (19) | (20) | (24) | (26) | (27) | (28) | (29) | (30) | (32) | (33) | (34) | (37) | (38) | (40) | (41) | (42) | (43) | (44) | (45) | (46) | (47) | (48) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L-K3-F01 | NV A | 19.350.000 | 629.545 | 100% | 5.500.000 | 0 | 19.350.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 4.250.000 | 15.100.000 | 672.000 | 0 | 0 | 672.000 | 18.678.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 20.726.000 |
| L-K3-F02 | NV B | 21.650.000 | 688.636 | 100% | 6.500.000 | 0 | 21.650.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 4.250.000 | 17.400.000 | 672.000 | 1.228.000 | 61.400 | 733.400 | 20.916.600 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 23.026.000 |
| L-K3-F03 | NV C | 15.870.000 | 562.273 | 100% | 3.500.000 | 0 | 15.870.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 3.270.000 | 12.600.000 | 672.000 | 0 | 0 | 672.000 | 15.198.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 17.246.000 |
| L-K3-F04 | NV D | 12.570.000 | 457.727 | 100% | 2.500.000 | 0 | 12.570.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 700.000 | 2.670.000 | 9.900.000 | 672.000 | 0 | 0 | 672.000 | 12.598.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 13.946.000 |
| L-K3-F05 | NV E | 15.470.000 | 498.636 | 0% | 0 | 0 | 4.238.409 | 6.400.000 | 0 | 96.000 | 0 | 0 | 1.379.318 | 2.859.091 | 96.000 | 0 | 0 | 96.000 | 4.142.409 | 0 | 192.000 | 0 | 0 | 192.000 | 4.430.409 |
| L-K3-F06 | NV F | 14.620.000 | 450.909 | 80% | 3.760.000 | 0 | 12.552.727 | 6.400.000 | 512.000 | 96.000 | 64.000 | 700.000 | 2.233.636 | 10.319.091 | 672.000 | 0 | 0 | 672.000 | 12.580.727 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 13.928.727 |
| L-K3-F07 | NV G | 8.950.000 | 366.136 | 81,8182% | 0 | 0 | 7.322.727 | 0 | 0 | 0 | 0 | 0 | 1.268.182 | 6.054.545 | 0 | 0 | 0 | 0 | 7.322.727 | 0 | 0 | 0 | 0 | 0 | 7.322.727 |
| L-K3-F08 | NV H | 12.650.000 | 366.136 | 57,2727% | 2.119.091 | 0 | 7.245.000 | 0 | 0 | 0 | 0 | 0 | 887.727 | 6.357.273 | 0 | 0 | 724.500 | 724.500 | 6.520.500 | 0 | 0 | 0 | 0 | 0 | 7.245.000 |
| L-K3-F09 | NV I | 16.950.000 | 443.864 | 75,6818% | 4.616.591 | 0 | 12.828.068 | 0 | 0 | 0 | 0 | 0 | 2.611.023 | 10.217.045 | 0 | 0 | 0 | 0 | 12.828.068 | 0 | 0 | 0 | 0 | 0 | 12.828.068 |
| L-K3-F10 | NV J | 14.450.000 | 407.045 | 0% | 0 | 0 | 5.291.591 | 0 | 0 | 0 | 0 | 0 | 1.356.136 | 3.935.455 | 0 | 0 | 0 | 0 | 5.291.591 | 0 | 0 | 0 | 0 | 0 | 5.291.591 |
| L-K3-F11 | NV K | 20.700.000 | 633.333 | 100% | 5.500.000 | 0 | 20.700.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 5.100.000 | 15.600.000 | 672.000 | 0 | 0 | 672.000 | 20.028.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 22.076.000 |
| L-K3-F12 | NV L | 14.620.000 | 372.000 | 80% | 3.760.000 | 350.000 | 13.038.000 | 0 | 0 | 0 | 0 | 0 | 2.268.000 | 10.770.000 | 0 | 0 | 0 | 0 | 13.038.000 | 0 | 0 | 0 | 0 | 0 | 13.038.000 |
| Σ | | 187.850.000 |  |  | 37.755.682 | 350.000 | 152.656.522 | 44.800.000 | 3.072.000 | 672.000 | 384.000 | 1.400.000 | 31.544.022 | 121.112.500 | 4.128.000 | 1.228.000 | 785.900 | 4.913.900 | 149.142.622 | 6.720.000 | 1.344.000 | 384.000 | 0 | 8.448.000 | 161.104.522 |
| Tròn(Σ đủ) | | 187.850.000 |  |  | 37.755.682 | 350.000 | 152.656.523 ≠ | 44.800.000 | 3.072.000 | 672.000 | 384.000 | 1.400.000 | 31.544.022 | 121.112.501 ≠ | 4.128.000 | 1.228.000 | 785.900 | 4.913.900 | 149.142.623 ≠ | 6.720.000 | 1.344.000 | 384.000 | 0 | 8.448.000 | 161.104.523 ≠ |

Chênh từng dòng (mặc định − như file HR), chỉ cột có chênh:

- NV A: (27) +1.000.000; (28) +80.000; (29) +15.000; (30) +10.000; (33) −2.300.000; (34) +2.300.000; (37) +105.000; (38) +1.123.000; (40) +56.150; (41) +161.150; (42) −161.150; (43) +175.000; (44) +30.000; (45) +10.000; (46) +148.000; (47) +363.000; (48) +363.000
- NV B: (27) +1.000.000; (28) +80.000; (29) +15.000; (30) +10.000; (33) −2.300.000; (34) +2.300.000; (37) +105.000; (38) +2.195.000; (40) +109.750; (41) +214.750; (42) −214.750; (43) +175.000; (44) +30.000; (45) +10.000; (46) +148.000; (47) +363.000; (48) +363.000
- NV C: (27) +1.000.000; (28) +80.000; (29) +15.000; (30) +10.000; (33) −1.400.000; (34) +1.400.000; (37) +105.000; (41) +105.000; (42) −105.000; (43) +175.000; (44) +30.000; (45) +10.000; (46) +148.000; (47) +363.000; (48) +363.000
- NV D: (27) +1.000.000; (28) +80.000; (29) +15.000; (30) +10.000; (33) −800.000; (34) +1.500.000; (37) +105.000; (41) +105.000; (42) −105.000; (43) +175.000; (44) +30.000; (45) +10.000; (46) +148.000; (47) +363.000; (48) +1.063.000
- NV E: (27) +1.000.000; (29) +15.000; (33) −792.045; (34) +792.045; (37) +15.000; (41) +15.000; (42) −15.000; (44) +30.000; (47) +30.000; (48) +30.000
- NV F: (27) +1.000.000; (28) +80.000; (29) +15.000; (30) +10.000; (33) −886.363; (34) +1.586.363; (37) +105.000; (41) +105.000; (42) −105.000; (43) +175.000; (44) +30.000; (45) +10.000; (46) +148.000; (47) +363.000; (48) +1.063.000
- NV G: không chênh
- NV H: không chênh
- NV I: (33) −1.135.228; (34) +1.135.228
- NV J: (19) 0% → 53,1818%; (20) +2.393.182; (26) +2.393.182; (33) −531.818; (34) +2.925.000; (42) +2.393.182; (48) +2.393.182
- NV K: (27) +1.000.000; (28) +80.000; (29) +15.000; (30) +10.000; (33) −3.150.000; (34) +3.150.000; (37) +105.000; (38) +2.473.000; (40) +123.650; (41) +228.650; (42) −228.650; (43) +175.000; (44) +30.000; (45) +10.000; (46) +148.000; (47) +363.000; (48) +363.000
- NV L: (19) 80% → 90%; (20) +470.000; (24) −350.000; (26) +120.000; (33) −900.000; (34) +1.020.000; (42) +120.000; (48) +120.000

Nguyên nhân: xăng xe chịu thuế, điện thoại miễn tới mức ở hồ sơ, trang phục miễn trong trần năm; chuyên cần vào lương đóng BH (7 người chính thức; NV E chỉ BHYT); hỗ trợ vào chịu thuế và chi phí (NV D, NV F); KPCĐ 2% cho 6 người đóng BHXH đủ (NV E chỉ BHYT nên 0); % KPI thử việc theo công thức khi HR không gõ đè (NV J, NV L); không nhập khoản không rõ nguồn (NV L). Dòng tổng (26), (34) của chế độ "như file HR" lệch 1 đồng giữa Σ ô và Tròn(Σ đủ) (D01).

### L. Quyết định của chủ dự án và bài học từ Chấm công

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-L01 | Ghi đè một người thắng mặc định | Mặc định Tiền cơm "miễn tới trần"; ghi đè NV A "chịu thuế" từ T12; bỏ ghi đè từ T3/2027 | T11 NV A theo mặc định; T12–T2 theo ghi đè; từ T3 theo mặc định. Người khác luôn theo mặc định. Tháng đã duyệt giữ giá trị lúc duyệt | spec 6.1, Q1 | shared |
| L-L02 | Đổi cho tất cả từ tháng X | Đổi tỷ lệ thử việc mặc định 90% → 95% từ T12; NV B có ghi đè 90% | T12 mọi người thử việc 95%, riêng NV B 90%. T11 giữ 90% cho tất cả. Nhật ký một dòng "cho tất cả, từ T12" | spec 6.1, Q1 | Cấu hình |
| L-L03 | Ghi đè hiện trên dòng | NV A có ghi đè Tiền cơm | Ô (33) của NV A có chấm màu, tooltip "Riêng NV A từ T12: Tiền cơm chịu thuế · Mở cấu hình". Cột Mã có icon. Hồ sơ lọc "Có cấu hình riêng" ra NV A | spec 4.6 | Bảng lương, Hồ sơ |
| L-L04 | Không có ô "Tự động / Thủ công" | Mở mọi form và lưới | Không có ô chọn chế độ. Ô đóng BH, % KPI thử việc, công làm CN, thuế hiện số tính; HR gõ đè thì bắt lý do, có dấu, có "Bỏ gõ đè" | spec 6.3, Q2 | Bảng lương, Hồ sơ, Cấu hình |
| L-L05 | Kỳ mặc định | Ngày 08/11/2026 mở từng tab không có `?ky` | Kỳ T11/2026 ở mọi tab; Tổng quan năm 2026. Đổi kỳ thì địa chỉ đổi `?ky=`, dán link mở đúng kỳ | spec 4.1 | Mọi tab |
| L-L06 | Lọc đủ ở mọi danh sách | Lọc Bảng lương, Hồ sơ, Phiếu, Nhật ký theo nhân viên, bộ phận, khối, khu vực, trạng thái, tìm "NV A"; kết hợp; Xoá lọc | Mỗi tab đủ bộ lọc, kết hợp đúng, nằm trên địa chỉ. Không có kết quả: "Không có dòng nào khớp" và nút xoá tìm | spec 4.1 | Mọi tab |
| L-L07 | Trạng thái lỗi, rỗng | `?ky=abc`, `?ky=2019-01`, tháng chưa chốt công, tháng tương lai | `abc`, `2019-01`: báo khoảng hợp lệ, không lặng lẽ mở kỳ khác. Chưa chốt công: "Chờ chốt công, gõ trước KPI và tạm ứng được". Tương lai: "Dự tính" | spec 4.17 | Bảng lương |
| L-L08 | Tooltip công thức số thật | Rê vào (18), (33), (40) của NV G (K3) | (18): "(6.400.000 + 1.100.000 + 450.000 + 1.000.000) × 90% ÷ 22 = 366.136". (33): từng khoản miễn và trần đã dùng. (40): cách thuế và lý do ("có cam kết") | Q7 | Bảng lương |
| L-L09 | Liên kết tới cấu hình | Bấm "Mở cấu hình" trong tooltip (33) của T10 đã duyệt | Mở Cấu hình › Tham số luật ở chế độ "Xem cấu hình áp dụng cho T10", tô dòng trần tiền ăn đã dùng | Q6 | Bảng lương, Cấu hình |
| L-L10 | Sao chép khi rê | Rê vào ô tiền, mã, tên, STK | Nút sao chép trên ô; dán vào Excel ra số (không dấu chấm); STK chỉ chép 4 số cuối; nút không vào thứ tự Tab của lưới | Q5 | Bảng lương, Hồ sơ, Phiếu |
| L-L11 | Dòng bấm về nguồn | Bấm ô (17) của NV A; dòng Rà soát; dòng Tổng quan T10; dòng nhật ký "Sửa Tiền cơm" | Mở Bảng công `?ky=2026-10` tô ô của NV A; tới ô lỗi; mở Bảng lương T10; mở hồ sơ NV A ở đúng phiên bản | spec 4.4 | Mọi tab |
| L-L12 | Số từ Chấm công không gõ thẳng | Gõ vào (17) khi kỳ công đã chốt | Ô vào chế độ gõ đè có lý do (L-D32), không sửa ngược Chấm công. Tooltip có liên kết "Mở lại kỳ công" sang Chấm công | spec 4.5 | Bảng lương |
| L-L13 | Lưới như Bảng công | Rê dòng, bấm dòng, cuộn ngang tới dòng cuối | Cả dòng sáng kể cả cột đứng yên; dòng đã bấm giữ viền; chữ băng nhóm bám cột đứng yên; dòng cuối không bị thanh cuộn che | spec 4.22 | Bảng lương |
| L-L14 | Chú giải đếm | Tháng có 3 ô gõ đè, 2 người có cấu hình riêng, 5 cảnh báo | Chú giải dưới lưới ghi đúng ba số; bấm từng số thì lọc ra các dòng đó | spec 11.2 | Bảng lương |
| L-L15 | Nhật ký một tab, không modal | Thêm khoản, sửa mức của NV A, xoá ghi đè; mở Nhật ký | Ba dòng: icon theo việc, chip nhóm, câu thường có mã người, cũ → mới, người làm, dd/mm/yyyy HH:mm. Không mở modal; chi tiết dài mở trong dòng | spec 4.2, 11.9 | Nhật ký |
| L-L16 | Việc không ghi nhật ký | Chuyển tab, mở màn, lọc, rê ô, mở hộp rồi Huỷ | Không có dòng nào. Tải Excel, xem phiếu, hiện STK thì có dòng ở nhóm "Tải và xem" | spec 4.2, L-H11 | Nhật ký |
| L-L17 | Đủ thêm, sửa, xoá | Với từng đối tượng: khoản, tham số, quy tắc, loại HĐ, tuỳ chọn, ghi đè, hồ sơ, NPT, cam kết, STK, ô tháng, truy lĩnh | Mỗi đối tượng thêm, sửa, xoá được (đã dùng ở tháng duyệt thì "Ngừng từ tháng"); mỗi việc một dòng nhật ký | spec 4.2, R5 | Mọi tab |
| L-L18 | Lưu không đổi; thay đổi chạm nhiều tháng | Mở form lưu ngay; đổi một tham số chạm T10–T12 | Lần đầu không ghi. Lần sau một dòng, ghi "Ảnh hưởng: T10 đã duyệt không đổi; T11, T12 nháp tính lại" | spec 11.9, CC | Nhật ký |
| L-L19 | Cảnh báo, không chặn | Lần lượt: thiếu hồ sơ, thực nhận âm, T−1 còn nháp, hồi tố chưa chọn, ghi đè trái luật, ngày chưa xác nhận | Rà soát báo, Duyệt vẫn được (mục đỏ phải tích "Đã xem"). Chỉ chặn: không có quyền, tỷ lệ thử việc < 85%, hệ số làm thêm dưới luật, hai phiên bản cùng ngày, sửa bản duyệt, kỳ công chưa chốt, mở lại tháng đã chuyển khoản | spec 4.8 | Bảng lương, Cấu hình |
| L-L20 | Bố cục ba khổ | Mở mọi tab ở 1440, 1280, 390 px | Không tràn ngang trang; không nút nào xuống dòng một mình; nút gom ba nhóm; chữ ≥ 12 px; ô bấm ≥ 24 px; nhãn ô số Tổng quan không bị cắt | spec 4.3 | Mọi tab |
| L-L21 | Điện thoại | 390 px: Bảng lương, đổi tab, lọc | Mỗi người một thẻ, bấm mở đủ cột theo nhóm; tab đang chọn luôn trong tầm nhìn; nút "Lọc (n)" và "Thêm"; màn đầu thấy ít nhất thẻ đầu tiên | spec 11.10 | Mọi tab |
| L-L22 | Xem không ghi DB | GET bảng lương T3/2027 chưa ai mở | Không tạo `payroll_periods` hay dòng nào; trả "Dự tính" | spec 4.13 | API |
| L-L23 | Đếm người | Kỳ có 11 người đang làm, 2 nghỉ việc trong kỳ | Mọi số đếm ghi "11 đang làm · 2 nghỉ trong kỳ", không gộp 13 | spec 4.14 | Bảng lương, Tổng quan |
| L-L24 | Nhập đầu vào tháng từ Excel | File đúng tiêu đề cột của file HR: (19), (21)–(24), (32) | Xem trước cũ → mới từng ô, lỗi từng dòng; chưa bấm Lưu thì không ghi gì; (32) tách hỗ trợ / hoàn ứng / tạm ứng; Lưu là một dòng nhật ký có số ô đổi | spec 12.2 | Bảng lương |
| L-L25 | Mã không khớp | File có mã thừa số 0 so với Chấm công | Không tự nối. Dòng báo "Mã không có. Gần giống: NV…", HR chọn hoặc bỏ dòng | spec 4.18 | Bảng lương |
| L-L26 | Cột "Xăng xe + ĐT" gộp | Nhập hồ sơ từ file 53 cột | Mặc định đưa hết vào Xăng xe, cảnh báo "Sửa nếu có Điện thoại"; sửa được từng dòng ở xem trước | spec 12.2, câu 3 | Hồ sơ |
| L-L27 | Nhập hồ sơ và số dư đầu năm | Nhập (8)–(15), (49)–(51) có ngày hiệu lực; nhập số dư đầu năm | Hồ sơ thành phiên bản mới từ ngày đó; STK mã hoá, chỉ hiện 4 số cuối; số dư vào số dư đầu năm. Mỗi lần nhập một dòng nhật ký | spec 12.2 | Hồ sơ |
| L-L28 | Lần chốt bất biến | Duyệt lương T10 (lần chốt 1); mở lại, sửa ô, chốt lại kỳ công T10 (lần chốt 2); thử xoá kỳ T10 | Bản duyệt T10 vẫn trỏ lần chốt 1, đọc lại được mã từng ngày của lần 1; lần 2 có bản riêng; xoá kỳ bị từ chối (RESTRICT) | spec 10.1, 4.19 | API |
| L-L29 | Ngày chưa xác nhận | Ngày chính thức do người nhập đặt, chưa xác nhận, dùng để tách đoạn | Rà soát đỏ "Ngày chính thức chưa được HR xác nhận", bấm tới Chấm công › Nhân viên | spec 4.20, câu 35 | Rà soát |
| L-L30 | Tháng đầu trên web | Mở T11/2026, kỳ công T10 do script chốt | Rà soát đỏ nhắc xác nhận lại lần chốt kỳ công | spec 4.21 | Rà soát |
| L-L31 | Giá trị chọn sẵn | Mở hộp Duyệt, Đã chuyển khoản; tải Excel | Người duyệt = HR đang đăng nhập; ngày chuyển khoản = ngày chi trả; Người lập biểu trong Excel = HR đang đăng nhập; ngày chi trả mặc định 05 tháng sau | spec 4.7 | Hộp thoại, Excel |
| L-L32 | Tổng quan tháng và năm | Chọn năm 2026 xem theo tháng; chuyển "theo năm" | Theo tháng: 12 cột, mỗi số có nhãn Đã duyệt / Nháp / Dự tính. Theo năm: mỗi năm một dòng tách ba loại. Không có số gộp không nhãn | Q8, spec 11.8 | Tổng quan |
| L-L33 | Tải nhiều tháng, nhiều phiếu | Chọn T8–T10 ở Tổng quan; chọn 5 người ở Phiếu lương | Cùng một hộp tải. File nhiều sheet theo bản của từng tháng; phiếu mỗi người một sheet | Q9, spec 12.1 | Tổng quan, Phiếu |
| L-L34 | Khối ký tên chỉ ở Excel | Xem Bảng lương; xem và in phiếu; tải Excel | Web và bản in không có khối ký tên; Excel có Người lập biểu, Kế toán trưởng, Giám đốc | Q4 | Bảng lương, Phiếu, Excel |
| L-L35 | Màu | Xem chip trạng thái và ô | Đỏ chỉ cho lỗi và cảnh báo đỏ. Nháp xám, Đã duyệt xanh lá, Đã chuyển khoản xanh dương, Chờ chốt công vàng | spec 4.16 | Mọi tab |

### M. Hộp thoại

| Mã | Tình huống | Thao tác | Kết quả mong đợi | Căn cứ | Màn hình |
|---|---|---|---|---|---|
| L-M01 | Hộp Duyệt | Bấm Duyệt T11, còn 2 cảnh báo đỏ, 3 vàng | Hộp hiện số người, tổng thực nhận, tổng chi phí, 2 đỏ / 3 vàng (bấm tới Rà soát), ngày chi trả, người duyệt = HR đang đăng nhập. "Duyệt lần 1" mờ tới khi tích "Đã xem cảnh báo đỏ". Xong: chip "Đã duyệt · lần 1 · lúc · bởi", dải khoá | spec 11.4, R4 | Bảng lương |
| L-M02 | Duyệt khi chưa tính lại | Sửa một ô rồi bấm Duyệt | Nút Duyệt trong hộp mờ, câu "Có thay đổi lúc …, bấm Tính lại trước" | spec 11.4 | Bảng lương |
| L-M03 | Hộp Mở lại | Bấm Mở lại T10 đã duyệt, chưa chuyển khoản | Hộp ghi bản lần N (lúc, bởi, tổng thực nhận) và "Sau khi mở: về Nháp, tính lại theo cấu hình của T10, gồm 1 thay đổi hồi tố; bản lần N vẫn giữ". Lý do trống thì nút mờ. Xong: Nháp, chênh so với lần N hiện trên lưới, nhật ký có lý do | R7, spec 11.4 | Bảng lương |
| L-M04 | Mở lại không được | Bấm Mở lại T10 đã chuyển khoản; bấm Mở lại T9 khi T10 đã duyệt | Hộp nói lý do, không có ô lý do. T10: nút "Tạo truy lĩnh / truy thu ở T11" mở L-M09. T9: "Mở lại T10 trước" | R7, spec 4.8 | Bảng lương |
| L-M05 | Hộp Đã chuyển khoản | Bấm Đã chuyển khoản T10 | Ngày mặc định = ngày chi trả; số người; tổng thực nhận bản lần N; ghi chú. Cảnh báo nếu ngày qua mốc tham số thuế (L-A06), thiếu STK, STK đổi sau duyệt (L-B23). Xong: chip "Đã chuyển khoản dd/mm", nút Mở lại ẩn | spec 11.4, câu 31 | Bảng lương |
| L-M06 | Bỏ đánh dấu đã chuyển khoản | Đánh dấu nhầm, bấm "Bỏ đánh dấu" | Bắt lý do; về Đã duyệt; Mở lại hiện lại; nhật ký ghi | spec 11.4, 4.2 | Bảng lương |
| L-M07 | Hộp hồi tố | Lưu tăng lương NV C từ 01/10 khi T10 đã duyệt, T11 nháp | Hộp "Thay đổi chạm tháng đã duyệt": T10 (Đã duyệt lần 1, 1 người, tổng chênh); bảng chênh từng cột; (a) chọn sẵn; (b) hiện vì T10 chưa chuyển khoản; (c). Huỷ thì thay đổi không được lưu | R6, spec 11.4 | Hồ sơ |
| L-M08 | Chọn (a) | Ở L-M07 chọn (a), sửa lý do, Lưu | T11 có dòng truy lĩnh NV C ghi "gốc T10" và lý do, chịu thuế ở T11. T10 không đổi, có nhãn "Có thay đổi sau duyệt, xử lý ở T11" | R6 | Bảng lương, Excel |
| L-M09 | Thêm truy lĩnh / truy thu tay | Trên T11 nháp thêm truy thu NV D 2.000.000 gốc T10, lý do trống; rồi một truy thu lớn hơn thực nhận | Lý do trống: không lưu. Lớn hơn thực nhận: cảnh báo, gợi ý chia nhiều tháng. Chịu thuế mặc định Có với tiền lương, Không với BH | spec 11.4 | Bảng lương |
| L-M10 | Chốt lại kỳ công khác số | Chấm công chốt lại T10, NV E đổi công; lương T10 đã duyệt | Người có quyền Lương vào Bảng lương thấy hộp hồi tố với chênh từ kỳ công; người chỉ có quyền Chấm công thấy câu chung, không số | R6, R7, L-C07 | Bảng lương, Chấm công |
| L-M11 | Hộp xoá | Xoá một ghi đè chưa dùng; xoá khoản đã dùng ở T10 | Hộp xác nhận chung ghi cái gì bị xoá và tháng nào tính lại. Khoản đã dùng: hộp đổi thành "Ngừng từ tháng" | spec 11.4, R5 | Cấu hình |
| L-M12 | Gõ đè không mở modal | Gõ đè (40) của NV H | Ô sửa ngay trên lưới, có ô lý do; Enter lưu, Esc huỷ; lý do trống không lưu; có dấu và "Bỏ gõ đè" | spec 6.3, 11.4 | Bảng lương |

**Số tình huống:** A 33, B 28, C 24, D 37, E 17, F 23, G 13, H 13, I 11, J 11, K 112 (K1 24, K2 64, K3 24), L 35, M 12. Tổng **369**.

---

## 2. Thay đổi so với bản 06/11

| Ca | Sửa | Vì sao |
|---|---|---|
| L-C11, L-K1-19 | Làm lễ lấy `holidayWorked`, bỏ MIN với OT | OT = 0 khi đi làm đủ nên MIN luôn ra 0, trái BLLĐ Đ.98 |
| L-D30, L-K1-12 | Tiền phép chưa nghỉ miễn thuế | NĐ 253 Đ.26 k2 |
| L-A01, L-A17, L-D24 | Xăng xe một cách cho cùng tháng, mặc định chịu thuế | Hai ca cũ và phác thảo ghi ngược nhau |
| L-D12 | Bỏ lý do "công ty trả thay phần BH", đổi số | File không ghi lý do; số cũ trùng số trong file |
| L-B02, L-D14, L-E01, L-E06, L-E15, L-J10 | Chặn → cảnh báo | Quyết định của chủ dự án; luật không bắt chặn |
| L-B17, L-C13, L-C14, L-C16, L-C18, L-C19, L-C20 | Gắn BH-1, BH-2 | Spec cũ có hai quy tắc 14 ngày cho kết quả khác nhau |
| L-D15, L-K1-21 | Định nghĩa lại làm tròn | "Như file HR" không phải một quy tắc |
| L-D28, L-K1-16, L-K1-17 | Điều kiện cam kết | NĐ 253 Đ.50 k2 |
| L-K1-10 (TL-109 cũ) | 12 < 14: không đóng tháng 10 | Bản cũ ghi "12 ≥ 14" |
| L-K1-15 (TL-114 cũ) | Đổi số công để (26) < 5 tr | Tiêu đề và kỳ vọng mâu thuẫn |
| L-K1-17 (TL-116 cũ) | Thêm điều kiện ước tính năm | "Luật cho 0" thiếu điều kiện |
| L-K1-18 (TL-273 cũ) | Thứ tự như Bảng công | Bản chốt không lưu thứ tự của file |
| L-K2-17…32, L-K2-49…64 (32 ca ma trận cũ) | (17) = 14 thay cho 11, tính lại mọi cột | Công lấy theo kỳ công; 11 là số của tháng dương lịch, chỉ dùng cho BH |
| L-K3 | Bộ vàng ẩn danh, tính lại cả hai chế độ | Bản cũ ghi mã nhân viên thật cạnh từng dòng |
| L-C20 và các ca có ngày vào, nghỉ | Ghi rõ là ngày giả định | File của HR không có ngày vào, nghỉ, chính thức |
| Mục 1 bản cũ (R1–R9) | Bỏ, dẫn sang spec mục 7 | Một nguồn duy nhất |
| Mục 3 bản cũ (25 chỗ thiếu) | Bỏ | Đã đưa vào spec 08/11 |

## 3. Thay đổi khi chốt spec mục 17 (08/11)

| Ca | Sửa | Vì sao |
|---|---|---|
| Hồ sơ K, L-K1-01–L-K1-07, L-K1-19, L-K1-20, cả K2, K3-S | Lương đóng BH gồm PC trách nhiệm và chuyên cần (Hồ sơ K 10.500.000, bộ vàng 7.400.000; Hồ sơ K chuyển 500.000 từ PC trách nhiệm sang nhà ở để lương đóng không trùng số thật, thu nhập và thuế khoản không đổi); tính lại BH, KPCĐ, thuế, thực nhận, chi phí | Câu 16: NĐ 158/2025 Đ.7 k1 b, c |
| L-K1-02, L-K1-10, L-K1-11, L-K1-14, L-B17, L-C18–L-C20, K2-17…32 | Tháng vào, nghỉ, đổi HĐ: đếm ngày không hưởng lương gồm ngày ngoài HĐ đóng BH; nghỉ 15/10 và HĐLĐ từ 15/10 nay đóng đủ tháng 10 | Câu 14: Luật BHXH 2024 Đ.33 k5 đọc theo chữ; QĐ 595 hết hiệu lực |
| K2-18, 20, 22, 24, 26, 28, 30, 32 | 10% tính trên (26) + hỗ trợ | Câu 13 (D02) |
| L-K1-12, L-D30 | Tiền phép chỉ tính trên lương theo HĐ: 1.431.818 thay 3.061.364 | Câu 18: NĐ 145/2020 Đ.67 k3, NĐ 253 Đ.26 k2, k3 |
| L-C09, L-K1-20 | CN bù ngày thường vẫn tổng 200% | Câu 19: BLLĐ Đ.98, Đ.107, Đ.111 |
| L-C15, L-C16, thêm L-K1-23, L-K1-24 | Ốm, thai sản từ 14 ngày: BHXH đóng BHYT; ốm tháng đầu vẫn đóng BHXH | Câu 15: Luật BHYT Đ.12 k2 b; Luật BHXH 2024 Đ.33 k6 |
| L-D23, thêm L-K1-22 | Điện thoại miễn tới mức HĐLĐ / quy chế; trang phục trần 5.000.000/năm | Câu 2: NĐ 253 Đ.8 k2 đ, VBHN 19/VBHN-BTC Đ.10 k8 |
| L-K1-18 | Thứ tự dòng theo nhóm của file T10 | Câu 26 (D13) |
| L-D12, L-D13 | Khoản (32) không chọn loại là Hỗ trợ; hoàn ứng chỉ khi trả lại tiền NLĐ đã chi | Câu 4 |
| L-E16, thêm L-E17 | Tự duyệt theo D14 | Câu 28 |
| L-E07 | Số dư đầu năm theo ngày chi, thêm trang phục đã trả | Câu 34 |
| Thêm L-B28 | Danh sách kiểm trước tháng đầu | Spec 17.2 |
| L-A04, L-A18, L-A27, L-B21, L-J03 | Bỏ "kế toán xác nhận" ở chỗ đã có văn bản; Chuyên cần mặc định tính BH | Câu 8, 10, 11, 16, 29 |
| K3-F (như file HR) | Không đổi số; ghi rõ chỉ lương thời gian tính BH và cơ sở 10% là (26) | Chế độ tái tạo file T10 |

