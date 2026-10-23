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

- HR: vào `/hr`, bấm "Đăng nhập bằng Google" là vào tài khoản HR mẫu.
- Ứng viên: `/dang-nhap`, số bất kỳ, mã OTP `123456`. Số `0912 345 128` có sẵn hồ sơ mẫu.
- Thêm `?slow` vào URL để xem skeleton (mạng chậm), `?reset` để xóa dữ liệu demo.

## Nối BE thật

Đặt `VITE_API_URL` (xem `.env.example`). Hợp đồng API nằm ở đầu file `src/api/http.ts`; kiểu dữ liệu dùng chung ở
`packages/shared`. Đăng nhập Google cần thêm `VITE_GOOGLE_CLIENT_ID`.

## Lệnh

| Lệnh                                    | Việc                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| `npm run dev -w @careers/web`           | chạy dev                                                   |
| `npm run build -w @careers/web`         | typecheck + build production vào `dist/`                   |
| `npm run build:preview -w @careers/web` | bản chạy thử mở được từ host tĩnh bất kỳ (route dạng `#/`) |
| `npm test`                              | test logic dùng chung + test API giả                       |

## Deploy Vercel

Project root `./` (gốc repo), preset `Other`. [`vercel.json`](../../vercel.json) ở gốc repo đã khai báo build command (`npm run build`, build `@careers/shared` trước rồi tới web), output `apps/web/dist`, rewrite cho SPA và header bảo mật.

Biến môi trường trên Vercel:

- Có BE: `VITE_API_URL`, `VITE_SITE_URL`, `VITE_GOOGLE_CLIENT_ID`, thông tin công ty (`VITE_COMPANY_NAME`, `VITE_HR_EMAIL`, `VITE_HR_PHONE`, `VITE_HR_ZALO`).
- Chưa có BE, chỉ muốn cho xem thử: `VITE_DEMO=1`. Bản build production **không** tự chạy dữ liệu giả nếu thiếu biến này,
  để tránh hồ sơ ứng viên chỉ nằm trong trình duyệt của họ.

## Cấu trúc

```
src/
  api/        types (interface Api), mock (BE giả), http (BE thật), queries (TanStack Query hooks)
  app/        router (trang HR và tài khoản được lazy-load)
  ui/         nút, ô nhập, dialog, icon, skeleton, trạng thái trống/lỗi
  site/       header, footer, thẻ việc làm, popup nộp đơn, chia sẻ, đăng ký nhận tin
  pages/      trang ứng viên, candidate/ (đăng nhập, hồ sơ của tôi), hr/ (quản trị)
```
