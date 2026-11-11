# Bảng lương: tài liệu, tiến độ và cách làm tiếp

Cập nhật: 11/11/2026, 10:30, sau lượt kiểm tra toàn bộ nhánh `feat/payroll`.
Chưa có gì được commit hay deploy. Database production không bị đụng tới.

**Kết quả kiểm tra 11/11 (cây `HR-payroll`, 273 tệp đã stage):**

| Việc kiểm | Kết quả |
|---|---|
| Build `@careers/shared` | Đạt |
| Test engine + API (`packages/shared`, `apps/api`) | 190 tệp đạt, 1 tệp bỏ qua; 4.174 test đạt, 1 bỏ qua, 24 để dành (`it.todo`) |
| Test web | 162 tệp, 1.506 test đạt (màn hình 135 tệp / 1.292; phần còn lại 27 tệp / 214) |
| Kiểm kiểu api, web; build web | Sạch; build đạt |
| Soát phần đã stage | Không có khoá bí mật, không có mã nhân viên thật, không `console.log`, không `any` / `!`, không test bị tắt |
| Migration | `0039`–`0049` đủ, liền số, khớp `_journal.json`; `drizzle-kit generate` báo không còn thay đổi schema |

---

## 1. Tài liệu gốc

| Tài liệu | Ở đâu | Ghi chú |
|---|---|---|
| Spec bảng lương | `/Users/smed/dev/HR-timesheet/spec-luong.md` | Đã đồng bộ 11/11 với code: khối, cộng dồn năm thuế, tiền phép chưa nghỉ, truy lĩnh / truy thu, Tổng quan, các liên kết |
| Danh mục test case | `/Users/smed/dev/HR-timesheet/docs/test-cases-luong.md` | 404 ca (A–M như cũ 369 ca; thêm mục N 35 ca theo code 11/11) |
| Rà soát nghiệp vụ của BA | `docs/luong-ra-soat-ba.md` (thư mục này) | Q1–Q10 cho chủ dự án; L1, L2, L4 đã làm xong 11/11 |
| File lương thật của HR | `~/Downloads/` (file CSV tháng 10 và 2 file PDF) | Chỉ đọc. **Không chép vào repo.** |
| Script so khớp với file thật | Thư mục tạm cũ ghi ở bản trước **không còn** | Bước 28 cần dựng lại script trên máy, không commit |

⚠️ Spec và danh mục test case **chưa commit**: chúng nằm ở nhánh `feat/luong` trong thư mục `HR-timesheet`. Hai bảng số K2, K3 trong danh mục **chưa đối chiếu lại** với fixture sau 10/11 (lượt này không đổi fixture nào).

---

## 2. Các quyết định nghiệp vụ đã chốt

BA chốt 35 điểm ở spec §17. Mỗi điểm dựa trên **văn bản luật**, **cách file lương tháng 10 của HR đang làm**, hoặc **quy tắc chủ dự án đã nêu**.

**Quy tắc của chủ dự án, áp dụng cho mọi phần:**
- Mọi giá trị là cấu hình có mặc định, áp cho tất cả hoặc từng người. Không có kiểu "tự động hay nhập tay".
- Mỗi tháng dùng đúng cấu hình của tháng đó: Excel tháng 10 lấy cấu hình tháng 10.
- Khung chữ ký chỉ có trong Excel, không có trên web.
- Không đoán; mọi quyết định có nguồn.

### 2.1 Quyết định 09–11/11

| # | Quyết định | Web làm thế nào |
|---|---|---|
| 1 | **Mặc định theo file lương tháng 10 của HR** | Chỗ nào file và luật khác nhau mà chủ dự án chọn "như file" thì mặc định theo file, HR đổi được ở Cấu hình; Rà soát nhắc điều luật (vàng, không chặn) |
| 2 | **Tự tính + thêm, sửa, xoá cho một hoặc nhiều người + số nào cũng bấm được về nguồn** | Ô nào web tính được thì luôn hiện số tính; HR gõ đè có lý do. Hồ sơ và cấu hình sửa được cho một người hoặc nhiều người một lần. Mỗi số mở được ngăn nguồn: công thức, hồ sơ, cấu hình, Bảng công |
| 3 | **% KPI theo khối** | Khối BO tự tính = ngày công ÷ công chuẩn (thử việc × 90%); khối KD do HR nhập. Bản chốt công chưa có khối thì tháng nháp đọc khối hiện tại của nhân viên |
| 4 | **KPCĐ 2% tắt** | Mặc định không tính, như file T10. Bật lại được cho công ty hoặc từng người. Luật Công đoàn 2024 Đ.29 vẫn yêu cầu đóng: xem Q6 của bản rà soát BA |
| 5 | **Cam kết thuế kèm hợp đồng** | HĐ thử việc / dưới 3 tháng có sẵn "Cam kết thuế kèm hợp đồng": không khấu trừ 10% mà HR không phải nhập. Tắt được cho tất cả, một hoặc nhiều người; khi tắt thì trừ 10% tới khi có cam kết ký riêng |
| 6 | **Công ty trả thay BH** | Khoản (32) định kỳ loại "Công ty trả thay BH": mỗi tháng tự bằng BH người lao động của tháng đó; mặc định không tính thuế như file; Rà soát vàng khi không tính thuế |
| 7 | **Cộng dồn năm thuế** | Số cộng dồn của tháng M = số dư đầu năm + các tháng trước cùng năm thuế (theo ngày chi trả), lấy bản duyệt gần nhất; tháng còn nháp thì lấy số nháp và báo vàng. Dùng cho trần trang phục 5 triệu/năm, 200 giờ làm thêm/năm, ước tính cam kết |
| 8 | **Tiền phép chưa nghỉ** | Tự tính khi ngày làm việc cuối nằm trong kỳ công: lương theo HĐ của ngày cuối kỳ trước ÷ công chuẩn kỳ trước × số ngày phép còn; miễn thuế. HR gõ đè: trống = tự tính, 0 = không trả; phần gõ cao hơn mức luật chịu thuế |
| 9 | **Truy lĩnh / truy thu** | Tháng đã duyệt không bao giờ đổi. Web tính lại tháng đó "như bây giờ", phần chênh so với bản duyệt tự vào tháng mở kế tiếp, theo từng người. HR "Bỏ ra" hoặc gõ số khác, có lý do |

**⚠️ Còn mở, cần chủ dự án chốt — thuế của phần truy lĩnh:** spec R6 ghi "chịu thuế ở tháng chi" (gộp vào thu nhập tháng nhận rồi tính lũy tiến lại). Code đang cộng phần chênh **theo từng ô của tháng gốc** (thu nhập, BH, thuế, chi phí công ty): thuế của phần chênh tính theo biểu của tháng gốc, kê ở tháng chi. Hai cách ra số thuế khác nhau khi người đó đổi bậc thuế.

### 2.2 Ba điểm làm số tiền khác file tháng 10, theo luật

1. Phụ cấp trách nhiệm tính vào lương đóng BH (Luật BHXH 2024 Đ.31; NĐ 158/2025 Đ.7). Tháng 10 mọi người đều 0 đồng nên chưa lệch.
2. Vào hoặc nghỉ giữa tháng: đếm 14 ngày đúng như luật ghi. Ví dụ nghỉ ngày 15/10 vẫn đóng đủ BHXH tháng 10.
3. Khấu trừ 10% với khoản chi từ 5 triệu cho HĐ dưới 3 tháng **khi đã tắt "cam kết kèm hợp đồng" và chưa có cam kết ký riêng** (NĐ 253/2026 Đ.50).

### 2.3 K1–K5 (chốt 09/11/2026)

| # | Điểm | Chốt | Căn cứ |
|---|---|---|---|
| K1 | Ngày chi trả lương | Ngày 05 tháng sau, HR đổi được trong Cấu hình | BLLĐ 2019 Đ.97 k2: do công ty và NLĐ thoả thuận |
| K2 | Mức miễn thuế điện thoại, đồng phục | Đồng phục tối đa 5 triệu/năm. "Xăng xe + ĐT" là 1 khoản, miễn thuế toàn bộ, như file T10 | File T10; điều kiện: mức có ghi trong HĐLĐ hoặc quy chế (NĐ 253/2026 Đ.8 k2 đ) |
| K3 | Chuyên cần có tính BH không | Không tính vào lương đóng BH; có công tắc trong Cấu hình | File T10; NĐ 158/2025 Đ.7 |
| K4 | BH tháng vào hoặc nghỉ giữa tháng | Từ 14 ngày không hưởng lương thì không đóng BHXH, BHTN; BHYT vẫn đóng, trừ ốm / thai sản từ 14 ngày và trừ tháng HĐ đóng BH bắt đầu | Luật BHXH 2024 Đ.33; nên hỏi lại cơ quan BHXH theo QĐ 366/QĐ-BHXH |
| K5 | Mức tính 10% | Thu nhập thực tế (26) + hỗ trợ, không trừ khoản miễn thuế | NĐ 253/2026 Đ.50 k2 |

Bảng đầy đủ 35 điểm và đường dẫn văn bản luật: spec §17, §17.4.

---

## 3. Tiến độ 28 bước (spec §15)

Trạng thái đối chiếu với code trong `HR-payroll` ngày 11/11, không chép từ bản trước.

| Bước | Nội dung | Tình trạng | Ghi chú |
|---|---|---|---|
| 1 | Kiểu dữ liệu, làm tròn, cấu hình theo tháng | ✅ Xong | `packages/shared/src/payroll/` |
| 2 | Thu nhập (16)–(26) | ✅ Xong | |
| 3 | Bảo hiểm (27)–(31), (43)–(47) | ✅ Xong | |
| 4 | Thuế (33)–(40) | ✅ Xong | |
| 5 | Thực nhận, dòng tổng, 64 tình huống ma trận | ✅ Xong | |
| 6 | Tháng mẫu, cấu hình mặc định | ✅ Xong | |
| 7 | Chế độ "như file HR" | ✅ Xong | Lần so với file thật gần nhất: trước 10/11 |
| 8 | Tách đoạn giữa tháng, gợi ý KPI | ✅ Xong | |
| 9 | Rà soát (cảnh báo) | ✅ Xong | |
| 10 | Quyền xem lương, nhật ký lương riêng | ✅ Xong | |
| 11 | Bản chốt chấm công không đổi được | ✅ Xong | migration `0040` |
| 12 | Khối, ngày chính thức, xác nhận ngày, báo Lương khi mở lại kỳ công | ✅ Xong | Thêm 10/11: khối đọc từ nhân viên khi bản chốt chưa có |
| 13 | Cấu hình theo tháng + ghi đè từng người | ✅ Xong | Còn 15 ca để dành (`it.todo`) |
| 14 | Hồ sơ lương | ✅ Xong | Còn 9 ca để dành |
| 15 | Tháng lương nháp | ✅ Xong | Thêm 11/11: cộng dồn năm thuế, tiền phép chưa nghỉ |
| 16 | Duyệt, Mở lại, Đã chuyển khoản | ✅ Xong | |
| 17 | Truy lĩnh / truy thu | ✅ Xong phần tự động | Chưa có: thêm tay một khoản, hộp "Thay đổi chạm tháng đã duyệt" lúc lưu. Thuế của phần chênh: chờ chốt (mục 2.1) |
| 18 | Khung trang `/hr/luong`, thanh lọc, menu theo quyền | ✅ Xong | 5 tab: Bảng lương, Hồ sơ lương, Cấu hình, Tổng quan, Nhật ký |
| 19 | Lưới bảng lương | ✅ Xong | |
| 20 | Rà soát và các hộp thoại | ✅ Xong | Duyệt, Mở lại, Đã chuyển khoản, bảng truy lĩnh |
| 21 | Màn hình Hồ sơ lương và Cấu hình | ✅ Xong | |
| 22 | Tab Nhật ký lương | ✅ Xong | |
| 23 | Xuất Excel lương | ⚠️ Mới xong phần dựng file | Code dựng file và test có đủ (`payroll/excel/`), nhưng **chưa có nút "Tải Excel" trên màn hình**: không nơi nào gọi `exportPayroll` |
| 24 | Nhập Excel, có xem trước | ⏸ Để sau | Chủ dự án quyết để sau |
| 25 | Phiếu lương | ⚠️ Mới xong phần dựng file | Như bước 23: **chưa có tab Phiếu lương**, không nơi nào gọi `exportPayslips` / `PayslipCard` |
| 26 | Tổng quan tháng và năm | ✅ Xong phần chính | Chưa có: Dự tính, biểu đồ 12 cột, so tháng trước, ô chọn tháng để tải Excel (L-G03, 04, 08, 09, 12, 13) |
| 27 | Bố cục, điện thoại (1440, 390) | ✅ Xong | Còn 3 chỗ chưa sửa: xem mục 5 |
| 28 | Đối chiếu file thật và chạy song song T11 | ⏳ Chờ | Chờ bảng lương tháng 11 của HR, sau 25/11 |

**Đã xong: 24/28 bước** (1–22, 26, 27). Bước 23 và 25 còn thiếu phần nối vào màn hình; bước 24 để sau; bước 28 chờ dữ liệu.

---

## 4. Thư mục làm việc (git worktree)

Chỉ còn **một cây làm việc cho lương**:

| Thư mục | Nhánh | Chứa gì | Tình trạng |
|---|---|---|---|
| `/Users/smed/dev/HR-payroll` | `feat/payroll` | Toàn bộ phần lương: engine, API, màn hình, Excel | 273 tệp đã stage, **chưa commit**; tách từ `main` ở `de89e5f` |
| `/Users/smed/dev/HR-timesheet` | `feat/luong` | Spec + danh mục test case | Chưa commit |
| `/Users/smed/dev/HR` | `chore/mock-fake-name` | Tài liệu này, bản rà soát BA | Chưa commit |

Ba cây cũ `HR-luong` (`feat/payroll-engine`), `HR-luong-api` (`feat/payroll-api`), `HR-luong-excel` (`feat/payroll-excel`) vẫn còn trên máy; nội dung đã gộp vào `HR-payroll`. Xoá được sau khi `feat/payroll` commit xong.

**Migration của lương** (`apps/api/drizzle/`, đã đánh lại số sau `0038` của `main`):

| Số | Tên | Nội dung |
|---|---|---|
| 0039 | `payroll_rights` | Quyền lương, nhật ký lương |
| 0040 | `timesheet_closings` | Lần chốt công bất biến |
| 0041 | `payroll_timesheet_link` | Khối, ngày chính thức, cờ xác nhận, kỳ lương |
| 0042 | `payroll_settings` | Cấu hình có phiên bản |
| 0043 | `payroll_profiles` | Hồ sơ lương |
| 0044 | `payroll_period_state` | Trạng thái tháng lương |
| 0045 | `payroll_month_inputs` | Số HR gõ mỗi tháng |
| 0046 | `payroll_runs` | Bản duyệt |
| 0047 | `payroll_insurance_paid` | Khoản "Công ty trả thay BH" |
| 0048 | `payroll_leave_payout` | Tiền phép chưa nghỉ HR gõ |
| 0049 | `payroll_retro_inputs` | Số HR gõ cho truy lĩnh / truy thu |

**Biến môi trường mới** (chỉ có tên trong `apps/api/.env.example`, không có giá trị thật):
- `PAYROLL_ADMINS`: email tài khoản HR được cấp cả hai quyền lương lần đầu; bỏ qua khi đã có người có quyền.
- `PAYROLL_KEY`: khoá mã hoá số tài khoản ngân hàng. Tạo bằng `openssl rand -base64 32`; chỉ đặt trong biến môi trường Vercel và `.env` local. Thiếu khoá: lưu số tài khoản trả 503.
- `PAYROLL_KEY_VERSION`: số phiên bản của khoá (bắt đầu là 1).

---

## 5. Chưa làm

**Thiếu so với spec:**
- Nút "Tải Excel" và tab Phiếu lương trên màn hình (bước 23, 25: code dựng file đã có, chưa nối).
- Nhập Excel (bước 24, để sau).
- Truy lĩnh: thêm tay một khoản; hộp "Thay đổi chạm tháng đã duyệt" lúc lưu; cột riêng trên lưới và dòng riêng trong Excel / phiếu; người có chênh nhưng không có dòng lương ở tháng nhận chỉ được liệt kê; chỉ so 6 tháng đã duyệt liền trước.
- Tổng quan: Dự tính cho tháng chờ chốt công, biểu đồ 12 cột, so tháng trước, chọn tháng để tải.
- BH của ngày 26–31 vẫn là "tạm": chưa có bước đọc lại khi kỳ công sau chốt (L3 của bản rà soát BA).
- 24 ca test để dành (`it.todo`): cấu hình 13, hồ sơ 6, khoản lương 2, dữ kiện hồ sơ 2, danh sách kiểm 1.

**Giao diện còn lại sau bước 27:**
- Chấm công › Nhân viên: mũi tên ô lọc sát mép — nhánh `main` đã có bản sửa (`b0cafd2`), gộp `main` là hết.
- Bảng lương ở 390: nút chép trong ô rộng 24px.
- Bảng lương ở 320: cột Họ và tên đứng yên chiếm gần hết bề ngang.

**Chờ chủ dự án quyết:**
- Thuế của phần truy lĩnh (mục 2.1).
- Q3, Q4, Q5, Q7, Q9, Q10 của bản rà soát BA (khoản cộng không rõ nguồn ở một dòng của file; người nghỉ việc có cam kết; ngày chi lần cuối; thưởng Tết; hỏi cơ quan BHXH; cảnh báo lương thử việc dưới lương tối thiểu vùng).

**Quy tắc cỡ tệp, cỡ hàm (chỉ ghi nhận, chưa sửa):**
- Tệp trên 800 dòng: `apps/web/src/api/mock.ts` 1.095, `apps/api/src/db/schema.ts` 1.074, `apps/api/src/db/migrations.test.ts` 1.046.
- Hàm trên 50 dòng trong tệp lương mới: 35, phần lớn là component màn hình (`ProfilesTab` 105, `ValueEditor` 103, `LevelForm` 103, `SettingForm` 99, `RetroPanel` 97); ngoài màn hình: `profileMockApi` 168, `payrollBands` 92, `monthItems` 55, `buildLine` 52.

---

## 6. Các bước đưa lên chạy thật

Làm đúng thứ tự. Bước 2 phải xong **trước** khi đẩy code.

1. **Sao lưu Neon**: tạo một nhánh sao lưu của database production (Neon › Branches) và ghi lại tên nhánh.
2. **Chạy migration `0039`–`0049`** lên production trước khi đẩy code: `npm run db:migrate -w apps/api` với `DATABASE_URL` của production đặt trong shell, không ghi vào tệp. Migration chỉ thêm bảng và cột có mặc định; code cũ vẫn chạy được trên schema mới.
3. **Đặt biến môi trường trong Vercel**: `PAYROLL_ADMINS`, `PAYROLL_KEY`, `PAYROLL_KEY_VERSION=1`. Lưu `PAYROLL_KEY` ở nơi an toàn: mất khoá là không đọc lại được số tài khoản.
4. **Commit, gộp `main`, đẩy code** (chủ dự án duyệt commit; soát khoá bí mật trước mỗi commit).
5. **Nạp 12 hồ sơ lương bằng script** chạy trên máy, đọc file của HR, không commit. Lượt kiểm 11/11 không thấy script này trong repo hay thư mục tạm: cần dựng lại hoặc chỉ ra chỗ đang để.
6. **Cấp quyền**: tài khoản trong `PAYROLL_ADMINS` đăng nhập, vào Tài khoản HR cấp "Xem, sửa lương" và "Duyệt lương" cho đúng người. Luôn còn ít nhất một người có cả hai quyền.
7. **Danh sách kiểm tháng đầu** (spec §17.2), HR xác nhận từng mục trong Hồ sơ lương: loại HĐ, số ngày thử việc, ngày vào / nghỉ / chính thức, khối, cam kết thuế, người phụ thuộc, khoản (32) định kỳ, số dư đầu năm (thu nhập chịu thuế, thuế đã khấu trừ, giờ làm thêm, trang phục đã trả), lần chốt kỳ công tháng 10.
8. **Chạy song song tháng 11**: sau 25/11 chốt kỳ công, tính lương T11 trên web, so từng ô với bảng lương tháng 11 của HR; ghi lại từng chỗ lệch và nguyên nhân. Chưa bỏ Excel cho tới khi hết chỗ lệch không giải thích được.

**Quy tắc khi làm tiếp:**
- Viết test trước và thấy nó đỏ, rồi mới viết code.
- Không có dữ liệu thật trong repo.
- Mọi thao tác thêm, sửa, xoá đều ghi nhật ký lương; mọi đường dẫn API lương phải kiểm quyền lương.
- Kiểm giao diện ở 1440 và 390.

---

## 7. Các điểm agent tự quyết, nên xem lại

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
- **Truy lĩnh / truy thu:**
  - Nguyên nhân hiện trên màn hình lấy từ nhật ký lương sau lúc duyệt, tối đa 5 dòng: là "các thay đổi có thể liên quan", chưa lọc đúng thay đổi gây chênh.
  - Mỗi lần mở tháng nháp phải tính lại tới 6 tháng đã duyệt liền trước, nên chậm hơn trước.
- **Bảng `payroll_periods`** được tạo từ bước 12, sớm hơn dự kiến. Bước 15 mở rộng bảng này, không tạo bảng mới.

---

## 8. Việc khác đang dừng (không thuộc bảng lương)

Chưa kiểm lại trong lượt 11/11. Bản 09/11 ghi "Lịch nghỉ + Báo cáo phép năm" đang dở ở thư mục `HR-nhom`; thư mục đó không còn trong danh sách worktree ngày 11/11 (có thêm `HR-giay-to`, nhánh `feat/giay-to-nghi`). Cần chủ dự án xác nhận việc này đã gộp hay đã bỏ.
