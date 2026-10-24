# Trang tuyển dụng – Frontend

React 19.3 · React Router 8 · TanStack Query 5 · Tailwind CSS 4 · Vite 8 · TypeScript 7.

Giao diện dựng theo mockup trong `design-mockup/` (bản sao canvas thiết kế). Màu, chữ, hiệu ứng lấy từ board
"Hệ thống giao diện" (`design-mockup/StyleGuide.dc.html`), luật nghiệp vụ BR-01 … BR-23 ở `BusinessRules.dc.html`.

## Chạy thử

```bash
npm install          # ở thư mục gốc monorepo
npm run dev          # build @careers/shared rồi mở http://localhost:5173
```

Không đặt `VITE_API_URL` thì app dùng **dữ liệu giả trong trình duyệt** (`src/api/mock.ts`, lưu ở localStorage):

- HR: vào `/hr`, đăng nhập `hr@congty.vn`; mật khẩu demo được tạo riêng cho từng trình duyệt và hiện ngay trên trang đăng nhập HR (chỉ bản dữ liệu giả).
- Ứng viên: `/dang-nhap`, bấm "Tiếp tục với Google" là vào tài khoản mẫu `minhanh@email.com` (có sẵn 3 hồ sơ).
- Thêm `?slow` vào URL để xem skeleton (mạng chậm), `?reset` để xóa dữ liệu demo.

## Nối BE thật

Đặt `VITE_API_URL=/api` (xem `.env.example`). BE ở `apps/api`, chạy cùng domain; cách chạy ở README gốc. Hợp đồng
API nằm ở đầu file `src/api/http.ts`; kiểu dữ liệu dùng chung ở `packages/shared`. Đăng nhập Google của ứng viên cần thêm
`VITE_GOOGLE_CLIENT_ID`; HR dùng tài khoản riêng.

## Lệnh

| Lệnh                                    | Việc                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| `npm run dev -w @careers/web`           | chạy dev                                                   |
| `npm run build -w @careers/web`         | typecheck + build production vào `dist/`                   |
| `npm run build:preview -w @careers/web` | bản chạy thử mở được từ host tĩnh bất kỳ (route dạng `#/`) |
| `npm test`                              | test logic dùng chung + test API giả                       |

## Deploy Vercel

Project root `./` (gốc repo), preset `Other`. [`vercel.json`](../../vercel.json) ở gốc repo đã khai báo build command (`npm run build`, build `@careers/shared` trước rồi tới web), output `apps/web/dist`, rewrite cho SPA và BE (`/api`), header bảo mật. Chi tiết ở README gốc.

Biến môi trường trên Vercel:

- Có BE: `VITE_API_URL=/api`, `VITE_SITE_URL`, `VITE_GOOGLE_CLIENT_ID`, thông tin công ty (`VITE_COMPANY_NAME`, `VITE_HR_EMAIL`, `VITE_HR_PHONE`, `VITE_HR_ZALO`). Env của BE xem `apps/api/.env.example`.
- Chưa có BE: không cần biến nào, thiếu `VITE_API_URL` thì tự dùng dữ liệu giả trong trình duyệt.
  **Lên thật phải đặt `VITE_API_URL`**, nếu không hồ sơ ứng viên chỉ nằm trong trình duyệt của họ, HR không nhận được.

## Cấu trúc

```
src/
  api/        types (interface Api), mock (BE giả), http (BE thật), queries (TanStack Query hooks)
  app/        router (trang HR và tài khoản được lazy-load)
  ui/         nút, ô nhập, dialog, icon, skeleton, trạng thái trống/lỗi
  site/       header, footer, thẻ việc làm, popup nộp đơn, chia sẻ, đăng ký nhận tin
  pages/      trang ứng viên, candidate/ (đăng nhập, hồ sơ của tôi), hr/ (quản trị)
```
