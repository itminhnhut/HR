# Bảng lương: tài liệu, tiến độ và cách làm tiếp

Cập nhật: 09/11/2026, 00:45. Mọi agent đã **dừng** theo yêu cầu.
Chưa có gì được commit hay deploy. Database production không bị đụng tới.

---

## 1. Tài liệu gốc

| Tài liệu | Ở đâu | Ghi chú |
|---|---|---|
| Spec bảng lương (đã chốt) | `/Users/smed/Desktop/HR-timesheet/spec-luong.md` | Khoảng 560 dòng. §4 Bài học từ Chấm công, §5 công thức, §6 cấu hình, §9 tuỳ chọn D01–D15, §10 database, §11 màn hình, §12 Excel, §15 kế hoạch 28 bước, §17 35 điểm đã chốt kèm nguồn luật |
| Danh mục test case | `/Users/smed/Desktop/HR-timesheet/docs/test-cases-luong.md` | 369 ca (nhóm A–M, K1–K3 là phần tính lương và tháng mẫu) |
| File lương thật của HR | `~/Downloads/Bảng Lương- 2026(10 (1).csv` và 2 file PDF | Chỉ đọc. **Không chép vào repo.** |
| Script so khớp với file thật, bản sao lưu BA | `/private/tmp/claude-502/-Users-smed-Desktop-HR/104c0ff0-a15b-4a57-8e52-7059c9afab03/scratchpad/` (các thư mục `payroll/`, `tools/`, `private/`, `ba2/`) | **Có dữ liệu thật**, là thư mục tạm. Xoá khi không cần nữa. |

⚠️ Spec và danh mục test case **chưa commit**: chúng nằm ở nhánh `feat/luong` trong thư mục `HR-timesheet`. Cần commit hoặc chép ra chỗ an toàn trước khi dọn thư mục đó.

---

## 2. Các quyết định nghiệp vụ đã chốt (spec §17)

BA tự chốt cả 35 điểm. Mỗi điểm dựa trên **văn bản luật** (ghi số điều, khoản), hoặc **đúng cách file lương tháng 10 của HR đang làm**, hoặc **quy tắc chủ dự án đã nêu**.

**Quy tắc của chủ dự án, áp dụng cho mọi phần:**
- Mọi giá trị là cấu hình có mặc định, áp cho tất cả hoặc từng người. Không có kiểu "tự động hay nhập tay".
- Mỗi tháng dùng đúng cấu hình của tháng đó: Excel tháng 10 lấy cấu hình tháng 10.
- Khung chữ ký chỉ có trong Excel, không có trên web.
- Không đoán; mọi quyết định có nguồn.

**3 điểm làm số tiền khác file tháng 10, theo luật:**
1. Phụ cấp trách nhiệm và chuyên cần tính vào lương đóng BH (Luật BHXH 2024 Đ.31; NĐ 158/2025 Đ.7).
2. Vào hoặc nghỉ giữa tháng: đếm 14 ngày đúng như luật ghi. Ví dụ nghỉ ngày 15/10 vẫn đóng đủ BHXH tháng 10.
3. Khấu trừ 10% với khoản chi từ 5 triệu cho HĐ dưới 3 tháng chưa ký cam kết thuế (NĐ 253/2026 Đ.50).

**5 điểm cần kế toán ký xác nhận.** Web đã chạy theo mặc định an toàn:

| # | Điểm | Mặc định đang dùng |
|---|---|---|
| K1 | Ngày chi trả lương | Ngày 05 tháng sau |
| K2 | Mức miễn thuế điện thoại, đồng phục | Điện thoại theo mức trong hồ sơ từng người; đồng phục tối đa 5 triệu/năm |
| K3 | Chuyên cần là khoản cố định | Tính vào lương đóng BH |
| K4 | BH tháng vào hoặc nghỉ giữa tháng; BHYT khi không đóng BHXH | Đếm 14 ngày theo luật; BHYT vẫn đóng, trừ khi ốm hoặc thai sản từ 14 ngày |
| K5 | Mức tính 10% | Thu nhập thực tế (26) + hỗ trợ, không trừ khoản miễn thuế |

Bảng đầy đủ 35 điểm và đường dẫn văn bản luật: spec §17, §17.4.

---

## 3. Tiến độ 28 bước (spec §15)

| Bước | Nội dung | Tình trạng | Ở thư mục | Kiểm chứng |
|---|---|---|---|---|
| 1 | Kiểu dữ liệu, làm tròn, cấu hình theo tháng | ✅ Xong | `HR-luong` (bản gốc) | Test qua |
| 2 | Thu nhập (16)–(26) | ✅ Xong | `HR-luong` | Test qua |
| 3 | Bảo hiểm (27)–(31), (43)–(47) | ✅ Xong | `HR-luong` | Test qua |
| 4 | Thuế (33)–(40) | ✅ Xong | `HR-luong` | Test qua |
| 5 | Thực nhận, dòng tổng, 64 tình huống ma trận | ✅ Xong | `HR-luong` | Test qua |
| 6 | Tháng mẫu, cấu hình mặc định | ✅ Xong | `HR-luong` | Test qua |
| 7 | Chế độ "như file HR" | ✅ Xong | `HR-luong` | **Khớp file T10 thật: 300/300 ô tiền, 12/12 ô KPI, 23/23 ô dòng tổng** |
| 8 | Tách đoạn giữa tháng, gợi ý KPI | ✅ Xong | `HR-luong` | Test qua |
| 9 | Rà soát (cảnh báo) | ✅ Xong | `HR-luong` | Bước 1–9: 231 test, mình đã chạy lại |
| 10 | Quyền xem lương, nhật ký lương riêng | ✅ Xong | `HR-luong-api` | Bước 10–12: 75 test, mình đã chạy lại |
| 11 | Bản chốt chấm công không đổi được | ✅ Xong | `HR-luong-api` | Test qua |
| 12 | Khối, ngày chính thức, xác nhận ngày, báo Lương khi mở lại kỳ công | ✅ Xong | `HR-luong-api` | Test qua |
| 13 | Cấu hình theo tháng + ghi đè từng người (CRUD, nhật ký) | ✅ Xong | `HR-luong-api` | Bước 13–14: 57 test, mình đã chạy lại; còn 26 ca để dành cho bước sau |
| 14 | Hồ sơ lương (mức lương, người phụ thuộc, cam kết thuế, tài khoản mã hoá, số dư đầu năm) | ✅ Xong | `HR-luong-api` | Test qua |
| 15 | Tháng lương nháp | ⏸ Dừng giữa chừng | `HR-luong-api` | Đang nối phần tính lương vào API; chưa xong |
| 16 | Duyệt, Mở lại, Đã chuyển khoản | ⏸ Chưa bắt đầu | — | — |
| 17 | Hồi tố, truy lĩnh / truy thu | ⏸ Chưa bắt đầu | — | — |
| 18 | Khung trang `/hr/luong`, thanh lọc, menu theo quyền | ⏸ Dừng giữa chừng | `HR-luong` | Còn 4 lỗi kiểu dữ liệu ở file đang viết dở |
| 19 | Lưới bảng lương | ⏸ Dừng giữa chừng | `HR-luong` | Có dữ liệu mẫu, đang viết màn hình |
| 20 | Rà soát và các hộp thoại | Chưa làm | — | — |
| 21 | Màn hình Hồ sơ lương và Cấu hình | Chưa làm | — | — |
| 22 | Tab Nhật ký lương | Chưa làm | — | — |
| 23 | Xuất Excel lương (1 tháng, nhiều tháng, cả năm; sheet Tham số và Tổng hợp) | ✅ Xong | `HR-luong-excel` | 45 test cho bước 23 và 25; mình đã chạy lại 202/202 test lương + chấm công |
| 24 | Nhập Excel, có xem trước | Chưa làm | — | — |
| 25 | Phiếu lương (từng người hoặc nhiều người một file) | ✅ Xong | `HR-luong-excel` | Như bước 23 |
| 26 | Tổng quan tháng và năm | Chưa làm | — | — |
| 27 | Bố cục, điện thoại (1440, 1280, 390) | Chưa làm | — | — |
| 28 | Đối chiếu file thật và chạy song song T11 với Excel của HR | Chưa làm | — | — |

**Đã xong: 16/28 bước (57%)**, gồm bước 1–14, 23 và 25.

File Excel mẫu (tên và số tiền giả) nằm trong `.../scratchpad/payroll-excel/`: `demo-luong.xlsx`, `demo-phieu-luong.xlsx`, `demo-luong-T08-T10.xlsx`.

---

## 4. Các thư mục làm việc (git worktree)

| Thư mục | Nhánh | Chứa gì | Tình trạng |
|---|---|---|---|
| `HR-timesheet` | `feat/luong` | Spec + danh mục test case | Chưa commit |
| `HR-luong` | `feat/payroll-engine` | **Bản gốc phần tính lương** (`packages/shared/src/payroll/`, `test-fixtures/payroll-*.ts`) + màn hình bước 18–19 đang dở | Chưa commit. Màn hình còn 4 lỗi kiểu dữ liệu. |
| `HR-luong-api` | `feat/payroll-api` | Bước 10–14 + bản sao phần tính lương (đã gộp, build qua) + bước 15 đang dở | Chưa commit. Kiểm kiểu api và web: 0 lỗi. |
| `HR-luong-excel` | `feat/payroll-excel` | Bước 23 và 25 + bản sao phần tính lương | Chưa commit. Kiểm kiểu: 0 lỗi. |

Cả ba nhánh lương tách ra từ `main` ở commit `4d72aa5`. Phần tính lương có **3 bản sao giống nhau**; bản ở `HR-luong-api` mới nhất (có thêm `explain-refs.ts`).

**Migration của lương** (ở `HR-luong-api`): `0032_payroll_rights`, `0033_timesheet_closings`, `0034_payroll_timesheet_link`, `0035_payroll_settings`, `0036_payroll_profiles`.

⚠️ Các số này **trùng** với migration đang chờ ở thư mục 3344 (`HR-nhom`: `0032`–`0038`). Gộp nhánh nào sau thì đánh lại số migration của nhánh đó:
1. Bỏ file `.sql` cũ và `meta/*_snapshot.json`.
2. Chạy lại `drizzle-kit generate` để tạo migration với số mới.
3. Sửa khối test trong `migrations.test.ts`. Các khối test lương tìm migration theo tên, nên đổi số không làm hỏng test.

**Biến môi trường mới** (chỉ có tên trong `.env.example`, không có giá trị thật):
- `PAYROLL_ADMINS`: email tài khoản HR được cấp quyền lương lần đầu.
- `PAYROLL_KEY`: khoá mã hoá số tài khoản ngân hàng. Tạo bằng `openssl rand -base64 32`; chỉ đặt trong biến môi trường Vercel và `.env` local.
- `PAYROLL_KEY_VERSION`: số phiên bản của khoá.

---

## 5. Làm tiếp theo thứ tự nào

1. **Bước 15–17** ở `HR-luong-api`:
   - Làm nốt việc nối phần tính lương: thay các kiểu dữ liệu tạm ghi "MERGE NOTE" bằng kiểu của phần tính lương.
   - Cho API đọc được mặc định của phần tính lương: ngày chi trả 5, 60 ngày thử việc, cảnh báo lương tối thiểu.
   - Sau đó làm tháng lương nháp, Duyệt / Mở lại / Đã chuyển khoản, rồi truy lĩnh / truy thu.
2. **Bước 18–19** ở `HR-luong`: sửa 4 lỗi kiểu dữ liệu, làm xong khung trang `/hr/luong` và lưới bảng lương (đang chạy trên dữ liệu mẫu).
3. **Gộp 3 nhánh lương lại** (engine, API, Excel), rồi nối màn hình vào API thật.
4. **Bước 20–22, 24, 26–28**.
5. Trước tháng lương đầu (T11/2026): HR làm theo danh sách kiểm ở spec §17.2 (loại HĐ, ngày vào, ngày nghỉ, ngày chính thức, cam kết thuế, người phụ thuộc, số dư đầu năm).

**Quy tắc khi làm tiếp:**
- Viết test trước và thấy nó đỏ, rồi mới viết code.
- Không có dữ liệu thật trong repo.
- Mọi thao tác thêm, sửa, xoá đều ghi nhật ký lương.
- Mọi đường dẫn API lương phải kiểm quyền lương.
- Kiểm giao diện ở 1440 và 390.
- Web trong mỗi thư mục mới cần file `apps/web/.env.local`, chép từ `HR-nhom`. Thiếu file này thì test giao diện báo lỗi giả.

---

## 6. Các điểm agent tự quyết, nên xem lại

- **Tên khoá cấu hình:** dùng tên của phần tính lương, ví dụ `khoan.dien-thoai.muc-quy-che`, không dùng tên ghi ở spec §17. Có thêm vài khoá chỉ API dùng: `tuy-chon.d13`, `tuy-chon.d14`, `quy-tac.thang-dau`, `quy-tac.khoan-32-mac-dinh`, `khu-vuc.<id>.vung`.
- **Mức sàn luật không cấu hình thấp hơn được:** lương thử việc tối thiểu 85%, làm thêm 150/200/300%.
- **BH tháng đầu có ốm:** tính cả ngày thai sản như ngày ốm.
- **Excel:**
  - Cột "Bộ phận" ghi khối BO/KD, như file HR.
  - Dòng tổng có cột Thưởng hiệu suất (file HR để trống ô này).
  - % KPI hiện số tròn.
  - Dòng tổng ghi số, không dùng công thức SUM: ở chế độ "như file HR", tổng làm tròn có thể lệch 1 đồng so với SUM.
- **Quyền lương:**
  - Ai có quyền "Xem, sửa" thì cấp được quyền "Xem, sửa".
  - Chỉ người có quyền Duyệt mới cấp hoặc thu quyền Duyệt.
  - Luôn phải còn ít nhất 1 tài khoản có cả hai quyền.
- **Tài khoản ngân hàng:**
  - Chỉ hiện 4 số cuối.
  - "Hiện đủ" có ghi nhật ký ai đã xem.
  - Đổi số tài khoản thì thêm dòng mới, không sửa dòng cũ.
- **Bảng `payroll_periods`** được tạo từ bước 12, sớm hơn dự kiến. Bước 15 mở rộng bảng này, không tạo bảng mới.

---

## 7. Việc khác đang dừng (không thuộc bảng lương)

| Việc | Ở đâu | Tình trạng |
|---|---|---|
| Lịch nghỉ + Báo cáo phép năm | `HR-nhom` (đang chạy 3344) | Mới viết test và một phần bộ lọc (`absenceFilters.ts`), chưa có màn hình. **3344 vẫn chạy bình thường**; 17 lỗi kiểu dữ liệu chỉ nằm trong 5 file test chưa có code. Làm tiếp, hoặc xoá các file test đó trước khi commit. |
| Review BA (lương + chấm công) | — | Dừng khi đang đọc, chưa có kết quả. Cần chạy lại. |
