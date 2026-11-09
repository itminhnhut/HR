# Spec: Sửa thông tin hồ sơ ứng viên trong drawer

## 1. Problem

HR cần sửa thông tin sai trong hồ sơ, ví dụ ứng viên gõ sai tên hoặc số điện thoại, hoặc CV không ghi giới tính.

Link "Sửa liên hệ" hiện có hai hạn chế:
- chỉ sửa được SĐT, email, nguồn và người giới thiệu, không sửa được tên và giới tính;
- chỉ dùng được với hồ sơ HR tự thêm. Hồ sơ ứng viên tự nộp bị khoá.

## 2. Requirements

**Must have:**
- Nút **"Sửa thông tin"** trong hồ sơ, thay cho link "Sửa liên hệ". Bấm vào mở drawer bên phải gồm các ô:
  - **Họ tên**: bắt buộc, giới hạn độ dài như form nộp hồ sơ;
  - **Số điện thoại**: kiểm như hiện tại, không trùng hồ sơ khác cùng vị trí;
  - **Email**: được để trống;
  - **Giới tính**: chọn Nam, Nữ hoặc Theo CV. "Theo CV" là không ghi đè, dùng giới tính đọc được từ CV;
  - **Nguồn** và **Ai giới thiệu**: như hiện tại, chỉ cho hồ sơ HR thêm.
- Áp dụng cho mọi hồ sơ, kể cả hồ sơ ứng viên tự nộp.
- Lưu một lần. Mỗi ô thay đổi ghi một dòng vào **Nhật ký hồ sơ**: ô nào, giá trị cũ → mới, ai sửa, lúc nào. Nhờ vậy luôn xem lại được ứng viên đã gửi gì.
- Ô giới tính trong hồ sơ ghi **"(HR sửa)"** khi HR đã ghi đè, **"(theo CV)"** khi chưa.
- Drawer có nút "Huỷ" và phím Esc. Đóng khi còn thay đổi chưa lưu thì hỏi lại.

**Out of scope:**
- Sửa năm sinh, tuổi.
- Sửa CV, vị trí ứng tuyển, ngày nộp.

## 3. Approach

- **API:** mở rộng `PATCH /api/hr/applications/:id/contact` nhận thêm `fullName` và `gender` (`male`, `female` hoặc `null`).
  - Bỏ chặn hồ sơ tự nộp cho tên, SĐT, email, giới tính.
  - Nguồn và người giới thiệu vẫn chỉ cho hồ sơ HR thêm, vì hồ sơ tự nộp có nguồn do web tự ghi.
- **DB:** thêm cột `applications.gender` (null = theo CV). Hiển thị là `gender ?? cvGender`.
- **Nhật ký:** dùng `logActivity` kiểu `contact` như hiện tại, thêm `fullName` và `gender` vào các trường được ghi.
- **Web:**
  - drawer mới `EditApplicantDrawer`, giữ cách kiểm lỗi từng ô như form hiện có;
  - `activityLines` đọc được hai trường mới, vd "Họ tên: Nguyen Van A → Nguyễn Văn A".

## 4. Impact Analysis

- **Files:**
  - shared: `validation.ts` (`hrContactSchema`), `types.ts` (thêm `gender` vào DTO);
  - API: `schema.ts` + migration 0032 (số cuối khi merge sẽ theo thứ tự), `hr-intake.ts`, `hr-applications.ts`;
  - web: `ContactOrigin.tsx`, drawer mới, `DetailFacts.tsx`, `activityLines.ts`.
- **Public API thay đổi:** thêm 2 trường không bắt buộc. Gửi như cũ vẫn chạy.
- **Breaking change:** không.

## 5. Test Strategy

- TC-SH-01: sửa tên và SĐT của hồ sơ tự nộp. Lưu được, nhật ký có 2 dòng cũ → mới.
- TC-SH-02: SĐT trùng hồ sơ khác cùng vị trí thì báo trùng như hiện tại.
- TC-SH-03: giới tính Nam thì hồ sơ ghi "Nam (HR sửa)". Đổi về "Theo CV" thì hiện lại giới tính từ CV.
- TC-SH-04: hồ sơ tự nộp không đổi được nguồn (409). Hồ sơ HR thêm thì đổi được.
- TC-SH-05: không đổi ô nào thì không ghi dòng nhật ký nào.
- TC-SH-06: tên rỗng hoặc email sai thì báo lỗi đúng ô.
- Web:
  - drawer mở, lưu, huỷ, Esc, hỏi lại khi đóng mà chưa lưu;
  - dòng nhật ký hiện đúng chữ.
- Thử tay trên web và điện thoại.

## 6. Implementation Steps

- [ ] Step 1: shared schema và migration cột `gender`, kèm test.
- [ ] Step 2: API: tên, giới tính, mở cho hồ sơ tự nộp, nhật ký (TC-SH-01..06).
- [ ] Step 3: web: drawer "Sửa thông tin", hiển thị "(HR sửa)", dòng nhật ký.
- [ ] Step 4: thử tay.

## 7. Risks

- **Ứng viên tra cứu hồ sơ bằng SĐT:** nếu HR đổi số thì tra bằng số cũ sẽ không thấy hồ sơ nữa. Drawer sẽ báo trước câu này khi HR đổi SĐT của hồ sơ tự nộp.
- **Trùng hồ sơ:** đổi SĐT có thể làm trùng với hồ sơ khác. Vẫn kiểm trùng và khoá như khi thêm hồ sơ.
