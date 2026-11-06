# Spec: Trạng thái "Chờ xếp lịch" cho hồ sơ ứng viên

## 1. Problem

HR đã gọi ứng viên. Ứng viên còn quan tâm nhưng chưa chốt được giờ phỏng vấn, ví dụ "đã gọi, nhưng bận thứ 7, chưa xếp được lịch PV".

Hiện chưa có trạng thái nào đúng cho trường hợp này:
- **"Đã xem"** không cho biết là đã liên hệ.
- **"Hẹn phỏng vấn"** bắt buộc chọn giờ, nên HR đặt một giờ tạm (trong ảnh là Thứ Bảy 07/11 9:00).

Đặt giờ tạm làm sai số liệu ở 4 chỗ:
- thống kê đếm người này là "đã hẹn phỏng vấn";
- lịch phỏng vấn ở trang tổng quan có thêm buổi không có thật;
- qua giờ tạm thì hồ sơ tự chuyển sang "Chờ kết quả";
- thư mời phỏng vấn soạn sẵn ghi giờ tạm đó.

## 2. Requirements

**Must have:**
- Trạng thái mới **"Chờ xếp lịch"**, đứng giữa "Đã xem" và "Hẹn phỏng vấn" trên thanh trạng thái. Icon đồng hồ lịch.
- Trạng thái này không cần giờ phỏng vấn. Chuyển sang đây thì giờ tạm (nếu có) bị bỏ. Có ghi nhật ký hồ sơ như các trạng thái khác.
- Khi chốt được lịch, HR bấm "Hẹn phỏng vấn" và chọn giờ như hiện tại.
- Danh sách ứng viên:
  - có bộ lọc "Chờ xếp lịch" kèm số lượng;
  - có màu nhãn riêng.
- Thống kê:
  - trang tổng quan đếm riêng "Chờ xếp lịch";
  - phễu theo nguồn không tính là "đã phỏng vấn".
- Ghi chú nội bộ vẫn là chỗ ghi lý do (vd "bận thứ 7").

**Out of scope (bạn chưa chọn):**
- Ô "Gọi lại ngày" và nhắc gọi lại. Làm sau nếu cần.
- Mẫu thư riêng cho trạng thái này.

## 3. Approach

- Thêm giá trị `scheduling` vào enum `application_status`. Migration dùng `ALTER TYPE ... ADD VALUE 'scheduling' AFTER 'seen'`.
- Nhãn: `APPLICATION_STATUS_LABEL.scheduling = 'Chờ xếp lịch'`.
- Ứng viên tự xem hồ sơ thì thấy **"Đã xem"** (đề xuất, cần bạn chốt ở mục 8). Như vậy web không hứa lịch phỏng vấn khi chưa có.
- Chuyển trạng thái dùng đúng luồng hiện có: ghi nhật ký trạng thái, xoá `interviewAt` khi rời "Hẹn phỏng vấn".

## 4. Impact Analysis

- **Shared:** `types.ts`, `format.ts`, `hiring.ts`, `validation.ts`.
- **API:** `schema.ts` và migration mới, `hr-applications.ts`, `dashboard.ts`, `source-funnel.ts`, `status-log.ts`.
- **Web:**
  - `StatusControl.tsx`, `ApplicantList.tsx`, `HrApplicantsPage.tsx`, `HrDashboardPage.tsx`;
  - `activityLines.ts`, `useMailDraft.ts`;
  - `ApplicationStage.tsx` (trang ứng viên), `mock.ts`.
- **Public API thay đổi:** thêm 1 giá trị trạng thái.
- **Breaking change:** không. Dữ liệu cũ giữ nguyên.

## 5. Test Strategy

- TC-XL-01: chuyển "Đã xem" sang "Chờ xếp lịch" mà không cần giờ, nhật ký ghi lại việc chuyển.
- TC-XL-02: từ "Hẹn phỏng vấn" có giờ chuyển về "Chờ xếp lịch" thì giờ bị bỏ. Hồ sơ không thành "Chờ kết quả" và không có trong lịch phỏng vấn.
- TC-XL-03: từ "Chờ xếp lịch" sang "Hẹn phỏng vấn" vẫn bắt chọn giờ.
- TC-XL-04: bộ lọc và số đếm ở danh sách và trang tổng quan có "Chờ xếp lịch". Phễu theo nguồn không đếm là đã phỏng vấn.
- TC-XL-05: ứng viên xem hồ sơ của mình thấy "Đã xem".
- TC-XL-06: migration giữ nguyên trạng thái các hồ sơ đang có.
- Thử tay: đổi lại hồ sơ trong ảnh từ "Hẹn phỏng vấn" sang "Chờ xếp lịch".

## 6. Implementation Steps

- [x] Step 1: shared (kiểu, nhãn, luật chuyển) và migration enum, kèm test.
- [x] Step 2: API: chuyển trạng thái, thống kê, phễu theo nguồn (TC-XL-01..04, 06).
- [x] Step 3: web: thanh trạng thái, bộ lọc, màu, trang tổng quan, nhật ký hồ sơ.
- [ ] Step 4: trang ứng viên (TC-XL-05) và thử tay.

## 7. Risks

- **`ALTER TYPE ... ADD VALUE`:** trên Postgres cũ không chạy được trong transaction. Neon dùng Postgres 16 nên được, nhưng vẫn kiểm bằng PGlite trong test và đọc lại trạng thái prod sau khi migrate.
- **Số thứ tự migration:** bản sửa chấm công (0030) và upload (0031) chưa vào main, nên migration này lấy số sau đó. Cần merge theo thứ tự.
- **Hồ sơ đang "Hẹn phỏng vấn" với giờ tạm:** migration không tự đổi. HR tự chuyển những hồ sơ đó.

## 8. Cần bạn chốt

1. Ứng viên xem hồ sơ của mình thấy gì khi HR để "Chờ xếp lịch"? Đề xuất: "Đã xem".
