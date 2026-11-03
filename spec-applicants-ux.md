# Spec: Bố cục trang Hồ sơ ứng viên dễ dùng hơn

## 1. Problem

HR thấy trang Hồ sơ ứng viên còn khó dùng. Việc chính của HR là: lướt danh sách, đọc CV, quyết định, liên hệ, ghi chú,
sang hồ sơ tiếp theo. Xem trên dữ liệu mẫu ở 1440, 1280 và 390 px thấy:

- **Mất nhiều chỗ trước khi thấy ứng viên:** tiêu đề, tìm kiếm, bộ lọc, nút và tab chiếm khoảng 320 px trên màn hình cao
  900 px. Bộ lọc vị trí nằm xa ô tìm kiếm, nút hành động xếp lẫn với bộ lọc.
- **Danh sách khó lướt:** cột phải mỗi dòng xếp chồng trạng thái, ngày, %, CV nên dòng cao thấp không đều. Trạng thái bị
  lặp khi đang ở tab trạng thái đó.
- **Cả trang cuộn chung:** kéo xuống đọc chi tiết thì danh sách trôi mất; muốn sang người khác phải kéo lên lại.
- **CV, việc quan trọng nhất, không có sẵn trong trang.**
- **Thao tác nằm rải rác:** Gọi và Zalo là nút to, trạng thái ở dòng khác, Soạn thư ở dòng khác nữa. SĐT, email, ghi chú
  nằm dưới màn hình đầu.
- **Điện thoại:** tên xuống dòng chiếm chỗ; kéo xuống đọc thì mất các nút hành động.

## 2. Requirements

**Must have:**

- Đầu trang gọn: một hàng công cụ gồm tìm kiếm, vị trí, nguồn, xếp theo %. "Thêm hồ sơ" là nút chính; "Gửi sếp duyệt" và
  "Quản lý nguồn" vào menu "Thêm".
- Danh sách cuộn riêng, luôn trong tầm nhìn, rộng khoảng 340 px (từ 1024), 400 px (từ 1280), 440 px (từ 1536); mỗi dòng
  cao đều: dòng 1 tên và %, dòng 2 vị trí và ngày; chỉ hiện nhãn khi đáng chú ý (không có CV, HR thêm). Chỉ hiện trạng
  thái ở tab "Tất cả". Ghi chú có dòng riêng, tối đa 2 dòng, đủ nội dung ở tooltip; chỉ dòng có ghi chú mới cao hơn.
- Chi tiết cuộn riêng, phần đầu dính cố định: tên, trạng thái, Gọi, Zalo, Soạn thư, Hồ sơ trước, Hồ sơ tiếp và vị trí
  dạng "2/8".
- Phím tắt J (hồ sơ tiếp) và K (hồ sơ trước): không chạy khi đang gõ trong ô nhập, không chạy khi đang mở hộp thoại hoặc
  menu. Dòng đang mở luôn được đánh dấu; thao tác ở chi tiết hiện ngay ở danh sách; đổi tab trạng thái, vị trí, nguồn hoặc gõ tìm
  kiếm thì đóng hồ sơ đang mở; mở link tới hồ sơ không có trong danh sách thì giữ chi tiết và báo rõ.
- Máy tính rộng: các khối trong chi tiết xếp 2 cột cho hết bề ngang (chỉ là cách xếp, vẫn chung một thanh cuộn): trái giờ
  phỏng vấn, Chấm CV, dòng CV; phải SĐT, email, ghi chú, lịch sử. Màn hình hẹp hơn thì xếp một cột.
- Không xem CV trong trang (chủ sản phẩm chốt): nút "Xem CV" ở đầu chi tiết cạnh Gọi, Zalo, Soạn thư mở tab mới, CV là
  link thì mở link, chưa có CV thì nút bị khoá. "Đổi CV", "Thêm CV" là một dòng gọn trong thân chi tiết.
- Điện thoại: tên một dòng; thanh Gọi, Zalo, Soạn thư, Xem CV dính ở đáy.
- Giữ nguyên mọi chức năng, đường dẫn, quyền và dữ liệu hiện có.

**Trạng thái, cuộn và drawer (chủ sản phẩm chốt thêm, ưu tiên hơn các mục trên nếu khác):**

- "Cập nhật trạng thái" là một khối: Mới, Đã xem, Hẹn phỏng vấn, Chưa phù hợp (bốn trạng thái code đang có; không có "Đã
  tuyển"). Trạng thái hiện tại tô đậm theo màu riêng (`applicants/statusStyle.ts`: Mới xanh dương, Đã xem xám, Hẹn phỏng vấn cam, Chưa phù hợp hồng, dùng chung cho khối trạng thái, dòng danh sách và gạch chân tab), kèm dấu tick và biểu tượng. "Đã xem" không bấm được (hệ thống tự chuyển khi mở hồ sơ), bấm vào sẽ
  báo lý do. Giữ cổng sếp duyệt, hoàn tác 5 giây, gợi ý soạn thư, giờ phỏng vấn.
- Trên máy tính không có vùng cuộn bọc ngoài: khung trang, `main` và chi tiết cố định theo cửa sổ. Chỉ hai ô cuộn: danh
  sách và chi tiết, không lồng nhau. Mỗi ô có thanh cuộn luôn hiện và không kéo theo ô khác. Dưới 1024 px là một lần cuộn
  trang bình thường.
- Mỗi việc nặng một drawer riêng bên phải. Soạn thư giữ 90vw. Chấm CV rộng khoảng 640 px, toàn màn hình trên điện thoại.
- Chi tiết chỉ còn một dòng Chấm CV: %, hoặc "Chưa đủ dữ liệu" / "Chưa chấm", ba ô Đạt, Không đạt, Không chấm (biểu tượng
  riêng, số to tô màu theo loại, số 0 nhạt; bấm mở drawer đúng tab) và nút "Xem chấm CV". Bấm khi chưa chấm thì bắt đầu
  chấm.
- Drawer Chấm CV có "Xem CV" và đúng 3 tab kèm số: Đạt, Không đạt, Không chấm. Mỗi tab và mỗi dòng có cùng biểu tượng của loại đó. Không chấm gồm dòng không quyết được hoặc không tính
  vào % (kỹ năng mềm, điểm cộng, CV không đọc được), dòng nào cũng có lý do. Mở ở Không đạt nếu có dòng, nếu không thì
  Đạt. CV là link hoặc chưa có CV thì hiện ghi chú và cách tải file PDF.
- Lịch sử liên hệ và vị trí khác đã nộp là một dòng tóm tắt, mở drawer để xem đủ. SĐT, email, ghi chú vẫn hiện thẳng; Xoá
  hồ sơ ở cuối.


**Out of scope:**

- Đổi luồng nghiệp vụ, trạng thái, API, database. Quét link CV.
- Trang Sếp duyệt và các trang admin khác.

## 3. Approach

Chỉ đổi bố cục ở `apps/web`, không đổi API. Tách `ApplicantDetail.tsx` (đang 555 dòng) thành các phần nhỏ. Làm trên nhánh
`fix/add-application-flow` vì nhánh đó cũng sửa các file này; deploy sau khi nhánh đó xong.

## 4. Impact Analysis

- Files thay đổi: `HrApplicantsPage.tsx`, `HrLayout.tsx`, `ui/Dialog.tsx`, `ui/Button.tsx`, `styles.css`,
  `applicants/ApplicantDetail.tsx` và các phần tách ra. Không đổi `CvViewer`.
- Public API thay đổi: không.
- Breaking change: không.

## 5. Test Strategy

- Unit: giữ các test web đang có; sửa test chỉ khi bố cục đổi cách tìm phần tử.
- Web: chọn hồ sơ, Hồ sơ trước/tiếp và "2/8", phím J/K (kể cả lúc phải bỏ qua), dòng đang mở, đổi trạng thái, ghi chú,
  Soạn thư, menu "Thêm", dòng danh sách đủ nhãn, các trạng thái CV.
- Manual: chụp 1440, 1280, 1024, 390 với hồ sơ có PDF, có link, không CV, tên dài; danh sách dài; không tràn ngang.

## 6. Implementation Steps

- [x] Step 1: Đầu trang một hàng công cụ, menu "Thêm" + test.
- [x] Step 2: Dòng danh sách gọn, danh sách và chi tiết cuộn riêng + test.
- [x] Step 3: Chi tiết: đầu dính, các khối 2 cột, nút "Xem CV"; tách file + test.
- [x] Step 4: Điện thoại: thanh hành động dính đáy; kiểm tra các cỡ màn hình.
- [x] Step 5: Hồ sơ trước/tiếp, vị trí "2/8", phím J/K + test.
- [x] Step 6: Khối trạng thái, drawer Chấm CV và các dòng mở drawer + test.
- [x] Step 7: Khoá khung trang theo cửa sổ, hai ô cuộn riêng có thanh luôn hiện; kiểm tra bằng con lăn thật.

## 7. Risks

- Đánh giá này dựa trên dữ liệu mẫu, chưa quan sát HR dùng thật, nên có thể bỏ sót chỗ khó cụ thể của HR.
- Màn hình laptop nhỏ khó đủ chỗ cho danh sách và 2 cột: dưới 1280 px các khối trong chi tiết xếp một cột.
- Nhánh đang có nhiều thay đổi chưa commit; làm sau khi nhánh sửa form đã xong và kiểm tra lại.
