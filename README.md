# Trang tuyển dụng

Monorepo, FE và BE tách riêng, deploy thành 2 project Vercel.

```
apps/web        React 19 + Vite + React Router + TanStack Query + Tailwind v4 (SPA)
apps/api        Hono trên Vercel Functions + Drizzle + Neon Postgres + Vercel Blob (private)
packages/shared Luật nghiệp vụ, validation (zod), kiểu dữ liệu dùng chung FE/BE
```

## Chạy giao diện (dữ liệu giả, không cần DB)

```bash
npm install
npm run dev:web        # http://localhost:5173
```

FE hiện chạy bằng `apps/web/src/lib/mock-db.ts`. Mọi trang chỉ gọi `src/lib/api.ts`,
nên khi nối BE chỉ cần viết lại file đó bằng `fetch('/api/...')`, giữ nguyên tên hàm và kiểu trả về.

- Trang ứng viên: `/`, `/jobs/:slug`, `/about`
- Trang HR: `/hr`, `/hr/jobs/new`, `/hr/jobs/:id`, `/hr/applicants`
- Tin mẫu đã hết hạn: `/jobs/nhan-vien-hanh-chinh` · tin sắp hết hạn: `/jobs/chuyen-vien-tuyen-dung`

## Test luật nghiệp vụ

```bash
npm test               # 33 test: hết hạn 23:59 giờ VN, ân hạn 60 phút, gia hạn, số điện thoại…
```

## Backend (đã viết, chưa nối FE)

```bash
cp apps/api/.env.example apps/api/.env   # điền DATABASE_URL, BLOB_READ_WRITE_TOKEN, GOOGLE_CLIENT_ID, HR_EMAILS, SESSION_SECRET
npm run db:push -w @careers/api
npm run db:seed -w @careers/api
npm run dev:api        # http://localhost:8787, Vite proxy /api sang đây
```

### Deploy Vercel

1. Project **careers-api**: Root Directory `apps/api`. Gắn Neon (Marketplace) và Blob store **Private**. Thêm env theo `.env.example`.
2. Project **careers-web**: Root Directory `apps/web`. Trong `apps/web/vercel.json`, thay `REPLACE-WITH-API-DOMAIN` bằng domain của careers-api.
3. FE proxy `/api/*` sang API qua rewrite, nên trình duyệt chỉ thấy một domain: không cần CORS, cookie đăng nhập HR là first-party.
4. Bot (Zalo, Facebook, Google) mở `/jobs/:slug` được chuyển sang trang HTML do API render, để xem trước link và Google Jobs đọc được tin.

Luật nghiệp vụ chi tiết: bảng "BA · Vòng đời tin tuyển dụng" trên canvas mockup.
