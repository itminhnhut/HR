# Spec: BE Hono theo hợp đồng `http.ts`

## 1. Problem

FE (`apps/web`) đã xong nhưng đang chạy bằng `mock.ts`: dữ liệu chỉ nằm trong trình duyệt của từng người, ứng viên nộp
hồ sơ thì HR không nhận được. `apps/api` là BE cũ, chưa khớp types mới trong `packages/shared` và chưa có phần tài
khoản ứng viên. Cần một BE thật làm đúng hợp đồng ở đầu `apps/web/src/api/http.ts`, chạy cùng domain với FE trên
Vercel, và giữ nguyên luật nghiệp vụ mà `mock.ts` đang cài.

## 2. Requirements

**Must have:**

- Đủ mọi endpoint trong hợp đồng `http.ts` (public, candidate, HR), trả đúng DTO của `@careers/shared`.
- Luật nghiệp vụ bê từ `mock.ts`, có test cho từng luật:
  - BR-01 / BR-18: hạn nộp bắt buộc khi đăng, tối đa 60 ngày từ hôm nay. Sửa tin đang chạy không đẩy hạn quá 60 ngày
    từ ngày đăng.
  - BR-04: slug không đổi sau khi đã đăng. Gia hạn +14 ngày, không vượt mốc 60 ngày.
  - BR-05: tin đã đóng vẫn trả 200 (không 404), kèm tối đa 3 tin tương tự. Chỉ tin nháp mới 404.
  - BR-07: cùng SĐT nộp lại cùng tin trong 30 ngày thì cập nhật hồ sơ cũ, trả `updatedExisting` và `previousDate`.
  - BR-11 / BR-12: consent bắt buộc, lưu `consentAt` và `policyVersion`. Đăng ký nhận tin có consent riêng (BR-10).
  - BR-14: ứng viên tự xoá dữ liệu thì xoá ngay hồ sơ, file CV, đăng ký nhận tin, tin đã lưu và tài khoản. Bỏ tick
    "giữ hồ sơ" áp dụng ngay cho mọi hồ sơ cũ.
  - BR-19: tin tạm dừng qua hạn thì thành hết hạn, chỉ mở lại được khi còn hạn.
  - Nộp hồ sơ: 409 `job_closed` khi tin không nhận hồ sơ. Được nộp thêm 60 phút sau hạn nếu đã mở form trước hạn.
    Honeypot `website` có giá trị thì trả ok giả, không lưu.
  - CV: PDF, tối đa 4 MB, hoặc link http(s). Phải có một trong hai.
  - Mở chi tiết hồ sơ thì chuyển `new` thành `seen`.
- OTP cho ứng viên: mã 6 số, hết hạn sau 5 phút, tối đa 5 lần nhập sai, gửi lại cách nhau ít nhất 60 giây. Gửi qua
  interface `OtpSender`. Bản dev chỉ ghi log và trả `devCode`. Production chưa có provider thì trả 503 với câu báo rõ.
- Đăng nhập Google cho HR: kiểm tra ID token, email phải nằm trong `HR_EMAILS`, sai thì 403. Kiểm tra lại danh sách ở
  mọi request.
- Đăng nhập Google cho ứng viên (BR-22): lần đầu trả `needsPhone: true` và giữ email tạm. Xác minh OTP xong thì gắn
  email vào tài khoản theo SĐT. Lần sau đăng nhập Google vào thẳng.
- CSRF: mọi request ghi (POST, PUT, PATCH, DELETE) phải có header `x-requested-with: careers-web`.
- Phần thêm ngoài hợp đồng (đã chốt):
  - `GET /hr/applications/:id/cv`: HR mở file CV (stream từ Vercel Blob private). FE thêm nút "Xem CV".
  - `DELETE /hr/jobs/:id`: chỉ xoá được tin nháp. FE thêm nút xoá cho tin nháp.
  - "Đăng lại" (BR-04): FE đã làm sẵn bằng form `?tu=<id>` gọi `POST /hr/jobs`, BE không cần endpoint riêng, chỉ cần
    test rằng tin mới có link mới và hồ sơ cũ ở lại tin cũ.
  - `/share/jobs/:slug` (thẻ `og:` cho Facebook và Zalo), `/sitemap.xml`, `/robots.txt`. Tin đóng không có trong sitemap
    (BR-16).
- Seed dữ liệu mẫu cho dev, lấy từ `mock-seed.ts`.

**Out of scope:**

- Cron tự xoá dữ liệu theo hạn (BR-09, BR-10, BR-20) và email nhắc HR tin sắp hết hạn (BR-03). Để đợt sau.
- Provider OTP thật (Zalo ZNS, SMS). Chỉ có interface và bản dev.
- SSR cho FE, đổi framework FE.
- Gửi tin nhắn cảm ơn qua Zalo (BR-21). Hiện chỉ đánh dấu `thanked`.

## 3. Approach

- **Stack giữ như BE cũ:** Hono, Neon Postgres và Drizzle, Vercel Blob (private) cho CV, `jose` cho cookie phiên ký
  HS256 và kiểm tra Google ID token.
- **Chạy cùng project Vercel, dưới `/api`.** Thêm `api/index.ts` ở gốc repo, export app Hono. `vercel.json` ở gốc
  rewrite `/api/*`, `/share/*`, `/sitemap.xml`, `/robots.txt` vào function này, các đường dẫn khác vẫn về `index.html`.
  FE đặt `VITE_API_URL=/api`, nên cookie là first-party và không cần CORS. Region `sin1`.
- **Code BE trong `apps/api/src`, viết lại tại chỗ:**
  - `app.ts`: `createApp(deps)`. Các phụ thuộc bên ngoài được truyền vào: DB, kho CV, `OtpSender`, bộ kiểm tra
    Google token, đồng hồ `now()`. Production dùng bản thật, test dùng bản giả cho những thứ bên ngoài, còn DB dùng
    Postgres thật.
  - `routes/`: `public.ts`, `candidate.ts`, `hr.ts`, `share.ts`.
  - `services/`: luật nghiệp vụ tách khỏi HTTP (apply, job, candidate, otp), mỗi file dưới 400 dòng.
  - `db/schema.ts`: `jobs`, `applications`, `subscribers`, `candidates`, `saved_jobs`, `otp_codes`. Migration sinh bằng
    `drizzle-kit generate`, để test và production dùng chung một bộ migration.
- **Dùng lại `@careers/shared`** cho mọi type, zod schema và luật trạng thái tin (`effectiveStatus`, `extendTarget`,
  `validateDeadline`…). Không viết lại luật ở BE.
- **Dev local:** `npm run dev:api` chạy Hono ở cổng 8787. Vite proxy `/api` và `/share` sang 8787. Bật BE thật ở local
  bằng `VITE_API_URL=/api` trong `apps/web/.env.local`, không đặt thì FE vẫn chạy mock như hiện tại.

## 4. Impact Analysis

- Files thay đổi:
  - `apps/api/**`: viết lại. Xoá `apps/api/vercel.json` và route `cron.ts` cũ.
  - `api/index.ts` (mới), `vercel.json` ở gốc (thêm rewrites và region).
  - `apps/web/src/api/http.ts`, `types.ts`, `mock.ts`: thêm `hrDeleteJob` và `cvUrl`.
  - `apps/web/src/pages/hr/HrApplicantsPage.tsx` (nút "Xem CV"), `HrJobsPage.tsx` (nút xoá tin nháp).
  - `apps/web/vite.config.ts` (proxy dev), `apps/web/README.md`, `apps/api/.env.example`.
- Public API thay đổi: có. Thêm 2 endpoint ngoài hợp đồng (`GET /hr/applications/:id/cv`, `DELETE /hr/jobs/:id`) và
  bổ sung vào chú thích hợp đồng trong `http.ts`. Không đổi endpoint nào đang có.
- Breaking change: không. FE vẫn chạy mock khi chưa đặt `VITE_API_URL`.

## 5. Test Strategy

- **Integration (chính):** vitest gọi API qua `app.request()` giống FE gọi thật, trên Postgres thật chạy trong tiến trình
  (PGlite) với migration thật. Chỉ thay bằng bản giả cho phụ thuộc bên ngoài: Vercel Blob, `OtpSender`, Google token,
  đồng hồ. Mỗi luật ở mục 2 có ít nhất một test, đặt tên theo hành vi, gắn mã BR như `mock.test.ts`.
- **Unit:** sinh và kiểm OTP, ký và đọc cookie phiên, slugify.
- **Kiểm tra trước mỗi commit:** `npm test`, `npm run typecheck` (thêm `@careers/api`), `npm run format:check`.
- **Manual:**
  1. `npm run db:push` và `npm run db:seed` trên Neon dev.
  2. `npm run dev:api`, FE đặt `VITE_API_URL=/api`, chạy hết luồng: nộp hồ sơ, nộp lại trong 30 ngày, đăng nhập OTP
     (mã lấy từ log), HR đăng nhập Google, đăng tin, gia hạn, xem CV, xoá dữ liệu ứng viên.
  3. Deploy preview trên Vercel, kiểm tra `/api/jobs`, `/share/jobs/<slug>`, `/sitemap.xml` và cookie đăng nhập.

## 6. Implementation Steps

Mỗi bước là 1 commit, test xanh mới sang bước sau.

- [x] Step 1: Khung app và DB. Schema mới, migration, `createApp(deps)`, chặn CSRF, định dạng lỗi
      `{ error, fieldErrors, code }`, harness test dùng PGlite. Test: health, thiếu header CSRF bị 403.
- [x] Step 2: Public đọc tin. `GET /jobs`, `GET /jobs/:slug` (BR-05: tin đóng vẫn 200, tương tự tối đa 3, nháp 404).
- [x] Step 3: Nộp hồ sơ và đăng ký nhận tin. `POST /applications` (consent, CV PDF ≤ 4 MB hoặc link, honeypot, 409
      `job_closed`, 60 phút ân hạn, BR-07 dedupe 30 ngày), kho CV private. `POST /subscribers`.
- [x] Step 4: HR đăng nhập và quản lý tin. Google và `HR_EMAILS`, `/hr/me`, `/hr/logout`. `/hr/jobs` CRUD, các action
      publish/extend/pause/resume/fill (BR-01, BR-04, BR-18, BR-19), slug cố định, xoá tin nháp, test "Đăng lại".
- [x] Step 5: HR xử lý hồ sơ. `/hr/applications` (đếm theo trạng thái, lọc theo tin), chi tiết thì đánh dấu `seen`,
      PATCH, `GET /hr/applications/:id/cv`, `/hr/subscribers` và xoá.
- [x] Step 6: Tài khoản ứng viên. OTP (hạn 5 phút, 5 lần sai, gửi lại sau 60 giây), Google kèm `needsPhone` (BR-22),
      `/candidate/me` GET/PATCH (bỏ tick giữ hồ sơ áp dụng ngay, đổi phòng ban nhận tin), tin đã lưu (chưa đăng nhập
      thì trả `[]`), `DELETE /candidate/me` (BR-14, xoá cả file CV), logout.
- [x] Step 7: Share, sitemap, robots, và seed dữ liệu mẫu từ `mock-seed.ts`.
- [x] Step 8: Nối FE. `api/index.ts`, `vercel.json` (rewrites, `sin1`), proxy Vite, thêm `cvUrl` và `hrDeleteJob`
      vào `Api`, nút "Xem CV" và nút xoá tin nháp, cập nhật README và `.env.example`. Deploy preview để kiểm tra.
      _Đã kiểm bằng `vercel build` ở máy và chạy chính function đã đóng gói. Deploy preview thật còn chờ Neon,
      Blob và Google OAuth trên Vercel._

## 7. Risks

- **Function `api/` trong project build tĩnh ở monorepo:** cần xác nhận Vercel bundle được `apps/api` và
  `@careers/shared` (shared phải build trước, `npm run build` ở gốc đã làm việc này). Kiểm tra bằng deploy preview ở
  Step 8. Nếu không được thì chuyển sang project riêng và rewrite (phương án B đã bàn).
- **Driver khác nhau:** production dùng `neon-http`, test dùng PGlite. Code chỉ dùng API chung của Drizzle cho
  Postgres. Driver `neon-http` không hỗ trợ transaction, nên luồng nhiều bước (xoá dữ liệu ứng viên) phải chạy đúng cả
  khi không có transaction, hoặc chuyển sang driver `neon-serverless` (WebSocket) nếu cần.
- **Dedupe khi hai request đến cùng lúc:** thêm ràng buộc hoặc khoá ở DB để không tạo hai hồ sơ trùng.
- **Body 4,5 MB của Vercel:** CV giới hạn 4 MB cộng các trường khác. File gần sát giới hạn có thể bị 413 từ Vercel
  trước khi tới code. FE đã chặn từ 4 MB.
- **Ngày giờ:** mọi luật theo ngày Việt Nam (`todayInVietnam`). Test cố định đồng hồ để không phụ thuộc giờ chạy.
- **Gói Hobby** chỉ cho dùng phi thương mại. Chạy thật cho công ty thì cần Pro.
- **Package mới:** `@electric-sql/pglite` (dev). Kiểm tra security advisory trước khi thêm.
