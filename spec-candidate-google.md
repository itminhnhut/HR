# Spec: Ứng viên chỉ đăng nhập bằng Google

## 1. Problem

Đăng nhập ứng viên bằng số điện thoại cần mã OTP. Gửi OTP qua Zalo hay SMS đều cần OA xác thực hoặc brandname, mẫu
tin được duyệt và trả phí theo tin. Trên trang thật, đăng nhập bằng số điện thoại đang trả 503. Đã chốt: bỏ hẳn đăng
nhập bằng số điện thoại, ứng viên chỉ đăng nhập bằng Google.

Tài khoản ứng viên hiện gắn với **số điện thoại**. Không còn OTP thì không chứng minh được ai sở hữu số nào, nên phải
đổi sang gắn với **email Google** (Google đã xác minh).

## 2. Requirements

**Must have:**

- Trang `/dang-nhap` chỉ còn nút "Tiếp tục với Google". Bỏ ô số điện thoại, ô nhập mã và mọi chữ nói về OTP/Zalo.
- Đăng nhập Google lần đầu tạo tài khoản ngay, không hỏi số điện thoại (bỏ bước `needsPhone` của BR-22).
- Tài khoản gắn với email Google (chữ thường). Đổi khoá chính bảng `candidates` từ `phone` sang `id`, có `email` duy
  nhất.
- "Hồ sơ của tôi" hiện các hồ sơ có `email` trùng email Google của tài khoản (không phân biệt hoa thường).
- Khi đã đăng nhập mà nộp hồ sơ: ô email điền sẵn email Google và khoá lại, nên hồ sơ luôn hiện trong tài khoản.
- Số điện thoại vẫn bắt buộc khi nộp hồ sơ (để HR gọi hoặc nhắn Zalo). Trong tài khoản, số điện thoại là trường không
  bắt buộc, chưa xác minh, dùng để điền sẵn form và nhận báo việc mới.
- Nhận báo việc mới (BR-10) trong tài khoản: gắn với số điện thoại ứng viên tự nhập trong hồ sơ. Chưa nhập số thì
  không bật được, giao diện nhắc nhập số.
- Xoá dữ liệu (BR-14): xoá tài khoản, tin đã lưu, mọi hồ sơ có email trùng email Google (kèm file CV), và đăng ký nhận
  báo của số điện thoại trong tài khoản.
- Bỏ khỏi BE: `POST /candidate/otp`, `POST /candidate/otp/verify`, bảng `otp_codes`, `lib/otp.ts`, cookie
  `candidate_google`.
- `POST /candidate/google` trả `CandidateMe`. Đổi kiểu `CandidateMe`: `email: string` bắt buộc, `phone: string | null`.
- Hợp đồng API trong `http.ts`, bản mock và test cập nhật theo.

**Out of scope:**

- Đăng nhập bằng số điện thoại hoặc email/mật khẩu cho ứng viên.
- Gửi tin Zalo hoặc SMS (OTP, cảm ơn, báo việc mới).
- Gộp hồ sơ nộp bằng email khác email Google đang đăng nhập.

## 3. Approach

- **Nối hồ sơ bằng email**, không thêm cột mới: `applications.email` đã có. Email do Google xác minh, nên người đăng
  nhập chỉ thấy hồ sơ nộp bằng chính email của họ.
- **Migration** `0002`: tạo lại bảng `candidates` (`id` uuid, `email` unique, `phone` null, các cột cũ giữ nguyên);
  `saved_jobs` đổi khoá ngoại sang `candidate_id`; xoá `otp_codes`. Trang thật hiện chưa có ứng viên hay tin đã lưu nào,
  nên tạo lại bảng không mất dữ liệu. Migration vẫn chép sang các dòng `candidates` có email, phòng có dữ liệu.
- **Phiên đăng nhập**: cookie `candidate_session` lưu `id` tài khoản thay cho số điện thoại.
- **Ở máy (chưa có Google Client ID)**: giữ đường đăng nhập dev bằng `VITE_DEV_GOOGLE_EMAIL` như hiện tại.

## 4. Impact Analysis

- Files thay đổi:
  - BE: `db/schema.ts`, migration `0002`, `routes/candidate.ts`, `services/candidate-auth.ts`,
    `services/candidate-account.ts`, `services/apply.ts` (nộp khi đã đăng nhập), `main.ts`, `deps.ts`, `local-dev.ts`,
    `db/seed.ts`. Xoá `lib/otp.ts`.
  - Shared: `types.ts` (`CandidateMe`).
  - FE: `api/http.ts`, `api/types.ts`, `api/mock.ts`, `api/mock-seed.ts`, `api/queries.ts`,
    `pages/candidate/CandidateLoginPage.tsx`, `pages/candidate/CandidateAccountPage.tsx`, `site/ApplyDialog.tsx`,
    README.
  - Test: `candidate.test.ts`, `contract.test.ts`, `share.test.ts` (seed), `mock.test.ts`, test FE liên quan.
- Public API thay đổi: **có**. Bỏ 2 endpoint OTP; `POST /candidate/google` trả `CandidateMe` thay cho
  `{ email, needsPhone }`; `CandidateMe` đổi kiểu.
- Breaking change: **có** với FE cũ, nhưng FE và BE deploy chung một lần nên không có giai đoạn lệch.

## 5. Test Strategy

- Unit/integration (BE, PGlite, gọi qua HTTP):
  - Google lần đầu tạo tài khoản, lần sau vào lại đúng tài khoản; email không phân biệt hoa thường.
  - "Hồ sơ của tôi" chỉ có hồ sơ cùng email, không có hồ sơ của email khác hay hồ sơ không ghi email.
  - Nộp hồ sơ khi đã đăng nhập luôn dùng email Google, kể cả khi form gửi email khác.
  - Bật báo việc mới khi chưa có số điện thoại thì báo lỗi; có số thì ghi vào `subscribers`.
  - Xoá dữ liệu: xoá đúng hồ sơ và file CV theo email, không đụng hồ sơ người khác; file lỗi thì không xoá gì.
  - Endpoint OTP cũ trả 404.
  - Migration `0002` chạy được trên DB đã có dữ liệu cũ (dòng có email được giữ).
- Test hợp đồng: client `http.ts` của FE chạy với BE thật cho toàn bộ luồng ứng viên mới.
- Test mock (`mock.test.ts`) và test FE cập nhật theo luồng mới.
- Kiểm tra tay: ở máy (đăng nhập dev), rồi trên www.lee-hr.com (Google thật).

## 6. Implementation Steps

Mỗi bước là 1 commit, test xanh mới sang bước sau.

- [ ] Step 1: Schema và migration `0002` (`candidates` theo email, `saved_jobs` theo `candidate_id`, bỏ `otp_codes`),
      đổi `CandidateMe` trong shared. Test migration trên DB có dữ liệu cũ.
- [ ] Step 2: BE: Google tạo hoặc vào tài khoản, "Hồ sơ của tôi" theo email, nộp hồ sơ khi đã đăng nhập, sửa hồ sơ (số
      điện thoại và báo việc mới), tin đã lưu, xoá dữ liệu. Bỏ OTP. Test cho từng luật ở mục 5.
- [ ] Step 3: FE: trang đăng nhập chỉ có Google, trang "Hồ sơ của tôi" (email cố định, số điện thoại sửa được), form
      nộp hồ sơ khoá email khi đã đăng nhập. Cập nhật mock, hợp đồng `http.ts`, test FE và test hợp đồng.
- [ ] Step 4: Chạy migration trên Neon, cập nhật README, kiểm tra trên www.lee-hr.com.

## 7. Risks

- **Hồ sơ nộp bằng email khác hoặc không ghi email** không hiện trong tài khoản. Đã chấp nhận. Hồ sơ vẫn tới HR.
- **Ai đó nộp hồ sơ bằng email Gmail của người khác**: hồ sơ đó sẽ hiện trong tài khoản người kia. Người nộp chỉ làm lộ
  dữ liệu của chính mình, không xem được dữ liệu người khác. Khi người kia xoá dữ liệu, hồ sơ đó bị xoá theo.
- **Người không có Gmail** không có tài khoản, nhưng vẫn nộp hồ sơ được bình thường (nộp không cần đăng nhập).
- **Migration trên Neon** đổi cấu trúc bảng: chạy trước khi deploy code mới. Hiện bảng đang rỗng nên rủi ro thấp. Vẫn
  kiểm tra lại số dòng trước và sau.
- **Google Console**: origin `https://www.lee-hr.com` đã có. Trang chạy ở domain khác (vd `lee-hr.com` không `www`) thì
  phải thêm origin đó.
