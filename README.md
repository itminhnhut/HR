# Trang tuyển dụng

Monorepo. FE và BE deploy chung **một** project Vercel, cùng domain: FE là trang tĩnh, BE là một Vercel Function
dưới `/api`.

```
apps/web        React 19 + Vite + React Router + TanStack Query + Tailwind v4 (SPA)
apps/api        Hono + Drizzle + Neon Postgres + Vercel Blob (private) – chạy qua api/index.ts
packages/shared Luật nghiệp vụ, validation (zod), kiểu dữ liệu dùng chung FE/BE
```

## Chạy giao diện (dữ liệu giả, không cần BE)

```bash
npm install
npm run dev            # http://localhost:5173
```

Chưa đặt `VITE_API_URL` thì FE dùng BE giả trong trình duyệt (`apps/web/src/api/mock.ts`). Xem `apps/web/README.md`.

## Chạy cả FE + BE ở máy (không cần tài khoản nào)

```bash
printf 'VITE_API_URL=/api\nVITE_DEV_GOOGLE_EMAIL=hr@congty.vn\n' > apps/web/.env.local
npm run dev:api        # http://localhost:8787 – lần đầu tự tạo DB và nạp dữ liệu mẫu
npm run dev            # FE; Vite chuyển /api, /share, /sitemap.xml, /robots.txt sang 8787
```

Thiếu gì trong `apps/api/.env` thì BE ở máy tự thay bằng bản local:

- Không có `DATABASE_URL`: Postgres chạy trong tiến trình (PGlite), lưu ở `apps/api/.data/db`. Xoá thư mục `.data` để
  làm lại từ đầu.
- Không có `BLOB_READ_WRITE_TOKEN`: CV lưu thành file trong `apps/api/.data/files`.
- Không có `GOOGLE_CLIENT_ID`: nút Google của ứng viên đăng nhập bằng `VITE_DEV_GOOGLE_EMAIL`.
- Tài khoản HR ở máy: `hr@congty.vn`, mật khẩu ngẫu nhiên tạo lần đầu, xem `apps/api/.data/hr-login.txt`. Xoá file
  đó rồi chạy lại `dev:api` để đổi mật khẩu.
- Ứng viên chỉ đăng nhập bằng Google; tài khoản theo email, hồ sơ nộp bằng email đó hiện trong "Hồ sơ của tôi".

Những thay thế này chỉ có ở máy; trên Vercel BE bắt buộc có Neon, Blob và Google. Dùng Neon thật ở máy thì điền
`DATABASE_URL` rồi chạy `npm run db:migrate -w @careers/api` và `npm run db:seed -w @careers/api`.

## Tài khoản HR

HR đăng nhập bằng email và mật khẩu riêng (không dùng Google). Mật khẩu băm bằng scrypt mức OWASP (N=2¹⁷); tối
thiểu 12 ký tự, đủ 3 trong 4 loại ký tự, không chứa tên email hay cụm phổ biến. Sai 5 lần thì khoá 15 phút. Tạo tài khoản hoặc đặt lại
mật khẩu (in mật khẩu mới một lần), xoá tài khoản:

```bash
DATABASE_URL=... npm run hr:user -w @careers/api -- --email hr@lee-hr.com --name "Phòng Nhân sự"
DATABASE_URL=... npm run hr:user -w @careers/api -- --email hr@lee-hr.com --delete
```

Đổi mật khẩu thì mọi phiên cũ của tài khoản đó bị đăng xuất; xoá tài khoản thì mất quyền ngay.

## Test

```bash
npm test               # luật dùng chung, API thật trên Postgres trong tiến trình (PGlite), FE
npm run typecheck
npm run format:check
```

Test API gọi qua HTTP (`app.request`) trên Postgres thật với migration thật; chỉ Vercel Blob, Google và đồng hồ
là bản giả.

## Deploy Vercel

Một project, Root Directory `./`, preset `Other`. [`vercel.json`](vercel.json) đã khai báo build, output
`apps/web/dist`, region `sin1` và rewrite:

- `/api/*`, `/share/*`, `/sitemap.xml`, `/robots.txt` → function `api/index.ts`.
- Bot (Zalo, Facebook, Google…) mở `/viec-lam/:slug` → trang HTML có thẻ `og:` và JobPosting do BE render.
- Mọi đường dẫn khác → SPA.

Cần chuẩn bị trên Vercel:

1. Gắn **Neon** (Marketplace, chọn vùng Singapore) → có `DATABASE_URL`. Chạy `npm run db:migrate -w @careers/api`
   với URL đó.
2. Tạo **Blob store loại Private** và gắn vào project.
3. Env của BE theo `apps/api/.env.example`, env của FE theo `apps/web/.env.example` với `VITE_API_URL=/api`.
4. Gói Hobby chỉ cho dùng phi thương mại; trang tuyển dụng thật của công ty cần gói Pro.

Luật nghiệp vụ BR-01 … BR-23: `apps/web/design-mockup/BusinessRules.dc.html`.
