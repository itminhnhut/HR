# Spec: Giấy tờ kèm đơn nghỉ (ảnh, PDF)

## 1. Problem

HR ghi nghỉ ốm có giấy BHXH, thai sản, cưới, tang ở tab Nghỉ, nhưng chưa có chỗ giữ giấy tờ.
Giấy hiện nằm trong Zalo hoặc giấy rời, nên khi rà soát, chốt kỳ hay kế toán làm hồ sơ BHXH phải đi tìm lại.
Một lần nghỉ có thể có nhiều ảnh, ví dụ giấy ra viện 2 trang và đơn thuốc.

## 2. Requirements

**Must have:**
- Gắn nhiều file vào một dòng nghỉ: ảnh JPG, PNG, WEBP và PDF. Tối đa 10 file mỗi dòng.
- Gắn được lúc tạo, lúc sửa, và sau khi đã duyệt. Dòng của kỳ đã chốt vẫn gắn và xem được, vì giấy thường về muộn.
- Trên điện thoại có nút "Chụp ảnh" (mở camera) và "Chọn file". Trên máy tính thì kéo thả.
- Ảnh được thu nhỏ ngay trên trình duyệt trước khi gửi (cạnh dài tối đa 2000px, JPEG), nên ảnh điện thoại 5–10 MB còn khoảng 0,5–1 MB. Mỗi file gửi một lần, có thanh % riêng. File lỗi không làm hỏng các file khác.
- Xem file:
  - Danh sách Nghỉ có cột "Giấy tờ": biểu tượng kẹp giấy kèm số file. Bấm vào mở khung xem.
  - Khung xem là lưới ảnh nhỏ. Bấm một ảnh mở to: có nút trước/sau (phím ← →), phóng to, xoay 90°, tải về và xoá. PDF hiện biểu tượng và mở ở tab mới.
- Cấu hình (tab Cấu hình, mục Lý do nghỉ): mỗi lý do có công tắc "Cần giấy tờ". HR bật/tắt cho tất cả lý do có sẵn và lý do HR tự thêm.
  - Mặc định bật: Ốm có giấy BHXH, Thai sản, Bản thân kết hôn, Con kết hôn, Tang cha mẹ, vợ chồng, con.
  - Đây chỉ là đề xuất, HR đổi được. Không có điều luật nào bắt web phải giữ bản chụp.
- Thiếu giấy:
  - Dòng cần giấy mà chưa có file hiện nhãn "Thiếu giấy" trong danh sách.
  - Rà soát kỳ liệt kê các dòng thiếu giấy, có nút nhảy tới dòng đó.
  - Chỉ cảnh báo, không chặn chốt kỳ.
- Nhật ký: ghi việc thêm file và xoá file (tên người, dòng nghỉ, tên file). Không ghi việc mở xem.
- Huỷ một dòng nghỉ thì xoá cả file của nó, có ghi nhật ký.

**Out of scope:**
- Đọc chữ trên giấy (OCR) để tự điền ngày.
- Gửi giấy sang cơ quan BHXH.
- Nhân viên tự gửi giấy (chưa có tài khoản nhân viên).
- Tự xoá file sau một số năm. Làm sau, khi HR chốt thời hạn giữ.
- File Word, Excel, video.

## 3. Approach

- **Lưu file:** dùng lại kho Vercel Blob PRIVATE đang giữ CV (`cv-store.ts`), thư mục `absence/<absenceId>/<uuid>.<đuôi>`.
  - Không có link công khai. File chỉ đọc được qua API khi HR đã đăng nhập, với `Cache-Control: private, no-store`.
  - Giấy khám bệnh là thông tin sức khoẻ, nên giữ kín như CV hoặc kín hơn.
- **Bảng mới** `timesheet_absence_files`: `id`, `absence_id` (FK, xoá theo dòng nghỉ), `pathname`, `name`, `content_type`, `size`, `created_by`, `created_at`.
- **Cột mới** `needs_paper boolean` trên `timesheet_absence_kinds` cho lý do HR tự thêm. Lý do có sẵn lưu trong bảng nhỏ `timesheet_reason_settings` (`reason_key`, `needs_paper`), với giá trị mặc định ở trên.
- **API:**
  - `POST /hr/timesheet/absences/:id/files`: multipart, 1 file mỗi lần.
  - `GET /hr/timesheet/absence-files/:fileId`: trả luồng file.
  - `DELETE /hr/timesheet/absence-files/:fileId`.
  - `GET` danh sách Nghỉ trả thêm `files[]` và `needsPaper`.
- **Kiểm file ở server, theo nội dung chứ không theo tên:**
  - JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF....WEBP`, PDF `%PDF-` và có `%%EOF`, như CV.
  - Tối đa 4 MB mỗi file, vì giới hạn body của Vercel là 4,5 MB.
  - Tối đa 10 file mỗi dòng.
- **Ảnh HEIC của iPhone:** Safari tự đổi sang JPEG khi chọn từ Ảnh. Trình duyệt khác gửi HEIC thì báo "Ảnh HEIC chưa đọc được, chụp lại hoặc xuất JPEG".
- Gửi từng file một thay vì gộp, để không vượt 4,5 MB và để file lỗi không kéo theo file khác.

## 4. Impact Analysis

- **Files thay đổi:**
  - `apps/api/src/db/schema.ts`, migration `0031_absence_files`;
  - `apps/api/src/lib/cv-store.ts` (thêm hàm put có đuôi và contentType), `services/timesheet-absences.ts`, `routes/hr-timesheet.ts`, `services/timesheet-log.ts`;
  - `packages/shared`: DTO file, giới hạn, danh sách lý do mặc định cần giấy;
  - `apps/web`: `AbsenceTable.tsx`, form nghỉ, `ConfigTab`, ReviewDialog, và hai thành phần mới `AbsenceFiles` (khung xem, ảnh to) và `PaperDrop` (chọn, chụp, kéo thả, thu nhỏ ảnh).
- **Public API thay đổi:** có, thêm 3 route và 2 trường. Không đổi route cũ.
- **Breaking change:** không.

## 5. Test Strategy

- **Unit (shared, web):**
  - kiểm đầu file từng loại;
  - thu nhỏ ảnh giữ tỉ lệ và không phóng to ảnh nhỏ;
  - nhãn "Thiếu giấy" theo cấu hình;
  - phím ← → trong khung ảnh to.
- **Integration (API, PGlite, kho file giả):**
  - TC-GT-01: gắn 3 ảnh vào một dòng, danh sách trả về đủ 3, đúng thứ tự.
  - TC-GT-02: file đổi đuôi `.jpg` nhưng nội dung là `.exe` bị từ chối.
  - TC-GT-03: file thứ 11 bị từ chối.
  - TC-GT-04: file trên 4 MB bị từ chối.
  - TC-GT-05: chưa đăng nhập thì không đọc được file (401).
  - TC-GT-06: huỷ dòng nghỉ thì file trong kho bị xoá và nhật ký có dòng ghi việc đó.
  - TC-GT-07: dòng của kỳ đã chốt vẫn gắn được file, số công không đổi.
  - TC-GT-08: tắt "Cần giấy tờ" cho Ốm thì nhãn "Thiếu giấy" mất, Rà soát cũng hết cảnh báo.
  - TC-GT-09: lý do HR tự thêm có công tắc riêng.
  - TC-GT-10: thêm và xoá file đều ghi nhật ký. Mở xem không ghi.
- **Manual (Playwright và điện thoại thật):**
  - chụp 2 ảnh trên iPhone rồi gửi;
  - kéo thả 5 ảnh trên máy tính, thấy % từng file;
  - mở ảnh to, xoay, tải về;
  - PDF mở tab mới.

## 6. Implementation Steps

- [x] Step 1: shared (giới hạn, DTO, lý do mặc định cần giấy) và hàm kiểm đầu file, kèm test.
- [x] Step 2: migration 0031, bảng file, cấu hình cần giấy, kèm test schema.
- [x] Step 3: API gửi, đọc, xoá file và ghi nhật ký (TC-GT-01..07, 10).
- [x] Step 4: cấu hình "Cần giấy tờ" ở tab Cấu hình và nhãn "Thiếu giấy" (TC-GT-08, 09).
- [x] Step 5: web phần gửi file: chọn, chụp, kéo thả, thu nhỏ ảnh, % từng file.
- [x] Step 6: web phần xem: cột Giấy tờ, khung lưới, ảnh to, PDF.
- [ ] Step 7: Rà soát kỳ liệt kê dòng thiếu giấy. Thử tay trên điện thoại và máy tính. (Code và test xong; còn thử tay.)

## 7. Risks

- **Ảnh HEIC, ảnh xoay ngang theo EXIF:** thu nhỏ bằng `createImageBitmap(..., { imageOrientation: 'from-image' })` để ảnh đứng đúng chiều.
- **Mạng chập chờn khi gửi nhiều ảnh:** mỗi file có nút "Gửi lại".
- **File mồ côi:** gửi xong nhưng lưu DB lỗi thì xoá file trong kho, như CV đang làm.
- **Dung lượng kho:** khoảng 1 MB một ảnh. 20 người, mỗi năm vài chục giấy, thì khoảng dưới 1 GB một năm. Cần xem gói Vercel Blob hiện tại.
- **Quyền xem:** mọi tài khoản HR đều xem được. Nếu sau này có tài khoản không phải HR thì phải chặn riêng.

## 8. Cần bạn chốt trước khi làm

1. Danh sách lý do mặc định "Cần giấy tờ" ở mục 2 có đúng ý HR không?
2. 10 file mỗi dòng, 4 MB mỗi file: có đủ không?
3. Thiếu giấy chỉ cảnh báo, không chặn chốt kỳ: có đúng không?
