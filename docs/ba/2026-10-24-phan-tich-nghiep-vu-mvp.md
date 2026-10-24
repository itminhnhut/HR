# Phân tích nghiệp vụ MVP: trang tuyển dụng www.lee-hr.com

- Ngày: 24/10/2026 · Người viết: BA · Người đọc: chủ sản phẩm (để chốt)
- Nguồn: mockup `apps/web/design-mockup/*.dc.html` (đặc biệt `BusinessRules.dc.html`), `spec.md`,
  `spec-candidate-google.md`, đọc nhanh app ở nhánh `experiment-hono-be`.
- Các con số trong ngoặc vuông `[..]` là đề xuất, chủ sản phẩm chốt lại.
- Tham khảo pháp lý, không thay tư vấn luật. Nên nhờ người có chuyên môn xem lại mục 7 trước khi chạy thật.

---

## 1. Mục tiêu & phạm vi MVP

**Mục tiêu.** Một công ty nhỏ tự đăng tin tuyển dụng trên domain riêng; ứng viên xem việc và nộp hồ sơ trong khoảng
1 phút, không bắt buộc tạo tài khoản; HR (2 người) nhận, xem CV, đổi trạng thái, liên hệ qua điện thoại/Zalo bằng tay;
dữ liệu cá nhân được thu tối thiểu, có bằng chứng đồng ý, và **được xoá đúng hạn** theo Luật BVDLCN 2025 / NĐ 356/2025.
MVP "đủ vận hành thật" nghĩa là: không có bước nào HR phải sửa thẳng trong cơ sở dữ liệu, và công ty chứng minh được
mình xoá dữ liệu đúng hạn khi bị hỏi.

**Trong phạm vi:** trang việc làm + tìm/lọc, trang chi tiết tin (kể cả tin đã đóng), nộp hồ sơ (có/không đăng nhập),
đăng nhập Google cho ứng viên, "Hồ sơ của tôi", tra cứu hồ sơ bằng SĐT, đăng ký nhận báo việc mới, khu HR (tin,
hồ sơ, người chờ tin), chính sách dữ liệu, xoá dữ liệu (tự xoá + xoá theo hạn bằng nút bấm).

**KHÔNG làm trong MVP (Won't):**

| Không làm | Lý do / thay thế |
|---|---|
| Đăng nhập ứng viên bằng SĐT/OTP/SMS/Zalo | Đã chốt chỉ Google. Không có OA/brandname, tốn phí theo tin |
| Gửi Zalo/SMS tự động (cảm ơn, báo việc mới) | HR sao chép mẫu tin và gửi tay; app chỉ đánh dấu "đã gửi" |
| Email nhắc HR tin sắp hết hạn | Thay bằng banner trong trang HR (đã có) |
| Phân quyền HR, nhật ký thao tác chi tiết theo người | 2 tài khoản toàn quyền là đủ ở quy mô hiện tại |
| Ứng viên lưu nhiều CV, trình tạo CV, bài test, lịch phỏng vấn | Ngoài nhu cầu MVP |
| Đa ngôn ngữ, ứng dụng di động, tích hợp job board | Ngoài phạm vi |

---

## 2. Tác nhân

| Tác nhân | Mô tả | Định danh |
|---|---|---|
| Ứng viên chưa đăng nhập (khách) | Xem việc, nộp hồ sơ, tra cứu bằng SĐT, đăng ký nhận báo | Không có; hồ sơ gắn theo SĐT (+ email nếu có) |
| Ứng viên đã đăng nhập | Như khách + điền sẵn form, dùng CV đã lưu, lưu việc, theo dõi, sửa/xoá dữ liệu | Email Google đã xác minh |
| HR | Đăng/sửa/đóng tin, xử lý hồ sơ, quản lý người chờ tin, xử lý yêu cầu dữ liệu | Email + mật khẩu riêng (2 tài khoản, toàn quyền) |
| Hệ thống | Tính trạng thái tin theo ngày (giờ VN), chặn nộp khi tin đóng, gộp hồ sơ trùng, ghi bằng chứng đồng ý, sitemap/SEO | — |

---

## 3. Chức năng theo tác nhân

Ưu tiên MoSCoW: **M**ust / **S**hould / **C**ould / **W**on't. Hiện trạng dựa trên đọc nhanh code, không phải kiểm thử.

### 3.1 Ứng viên (khách)

| # | Chức năng | Ưu tiên | Hiện trạng |
|---|---|---|---|
| C1 | Danh sách việc đang tuyển, tìm theo từ khoá, lọc phòng ban | M | Đã có |
| C2 | Trang "Hiện chưa có vị trí đang mở" + ô nhận báo khi không còn tin | M | Đã có (cần kiểm tra lại) |
| C3 | Chi tiết tin; tin đã đóng vẫn mở được, hiện lý do + ≤3 việc tương tự (BR-05) | M | Đã có |
| C4 | Chia sẻ tin (link, ảnh xem trước Zalo/Facebook) | S | Đã có |
| C5 | Bấm Ứng tuyển → chọn "Đăng nhập Google" hoặc "Nộp không cần đăng nhập" | M | **Chưa có** (form mở thẳng; chỉ có nút "Theo dõi hồ sơ" sau khi nộp) |
| C6 | Form nộp: họ tên, SĐT, CV (PDF ≤4 MB hoặc link), lời nhắn, email (tuỳ chọn), 2 ô đồng ý | M | Đã có |
| C7 | Nộp lại cùng tin trong 30 ngày → cập nhật hồ sơ cũ (BR-07) | M | Đã có |
| C8 | Ân hạn 60 phút khi tin hết hạn lúc đang điền form | S | Đã có |
| C9 | Tra cứu hồ sơ bằng SĐT (không đăng nhập) | M (đã chốt) | **Chưa có** |
| C10 | Đăng ký nhận báo việc mới (SĐT Zalo + phòng ban + ô đồng ý riêng) | S | Đã có |
| C11 | Trang Chính sách dữ liệu, Giới thiệu | M | Đã có, **nội dung cần sửa** (còn câu "đăng nhập bằng số điện thoại", còn chỗ `[Tên công ty]`/`[số]` trong mockup) |
| C12 | Gửi yêu cầu xem/sửa/xoá dữ liệu khi không có tài khoản Google | M | Một phần (chỉ có thông tin liên hệ HR, chưa có quy trình phía HR — xem H12) |

### 3.2 Ứng viên đã đăng nhập (Google)

| # | Chức năng | Ưu tiên | Hiện trạng |
|---|---|---|---|
| A1 | Đăng nhập/đăng xuất bằng Google; lần đầu tự tạo tài khoản | M | Một phần (spec Google đang làm, Step 1–4 chưa tick) |
| A2 | "Hồ sơ của tôi": danh sách hồ sơ nộp bằng email Google + trạng thái phía ứng viên | M | Một phần (theo spec Google) |
| A3 | Thông tin để nộp nhanh: họ tên, SĐT; 1 CV (PDF ≤4 MB), tải mới thay cũ | M | Đã có ở tài khoản (BE thay file cũ khi tải mới) |
| A4 | Khi ứng tuyển: điền sẵn, email khoá theo Google, **dùng CV đã lưu** | M | Một phần (email khoá đã có; **dùng lại CV đã lưu chưa có** ở BE/FE nộp hồ sơ) |
| A5 | Rút lại "Giữ hồ sơ 12 tháng", bật/tắt nhận báo theo phòng ban | M | Đã có |
| A6 | Xoá toàn bộ dữ liệu của tôi (xoá ngay) | M | Đã có |
| A7 | Lưu việc / bỏ lưu | C | Đã có |

### 3.3 HR

| # | Chức năng | Ưu tiên | Hiện trạng |
|---|---|---|---|
| H1 | Đăng nhập email + mật khẩu, khoá 15 phút sau 5 lần sai, đăng xuất | M | Đã có |
| H2 | Tạo tin nháp, sửa, đăng (hạn nộp bắt buộc ≤60 ngày) | M | Đã có |
| H3 | Cảnh báo chữ phân biệt đối xử (BR-15), cảnh báo thiếu lương (BR-08) | S | Đã có (cần xác nhận khớp mockup) |
| H4 | Gia hạn +14 ngày (≤60 ngày từ ngày đăng), Tạm dừng / Mở lại, Tuyển đủ, Đăng lại (tạo tin mới), Xoá tin nháp | M | Đã có |
| H5 | Banner "tin sắp hết hạn" trong trang HR | M | Đã có |
| H6 | Danh sách hồ sơ, đếm theo trạng thái, lọc theo tin, số "chưa xem" trên menu | M | Đã có |
| H7 | Mở hồ sơ (tự chuyển Mới → Đã xem), xem CV, đổi trạng thái, ghi chú nội bộ | M | Đã có |
| H8 | Gửi lời cảm ơn: mẫu tin có sẵn, HR gửi Zalo tay, bấm "Đánh dấu đã gửi" | S | Đã có |
| H9 | Nhắc gửi cảm ơn cho hồ sơ chưa xử lý khi tin đóng (BR-06, BR-21) | S | Chưa rõ / cần kiểm tra |
| H10 | Người chờ tin: xem theo phòng ban, sao chép số, xoá từng người | S | Đã có |
| H11 | **Xoá dữ liệu đến hạn** (hồ sơ quá 30 ngày sau khi tin đóng, quá 12 tháng nếu "giữ hồ sơ", người chờ tin quá 6 tháng) bằng nút bấm có danh sách xem trước | **M** | **Chưa có** |
| H12 | **Xoá 1 hồ sơ theo yêu cầu ứng viên** (yêu cầu qua Zalo/email, BR-14) | **M** | **Chưa có** (HR chỉ xoá được người chờ tin) |
| H13 | Đổi mật khẩu HR, tạo/khoá tài khoản HR | S | Một phần (tạo bằng lệnh `npm run hr:user`, chưa có màn hình) |
| H14 | Xuất danh sách hồ sơ ra file | W | Không làm (BR-23: không xuất file) |

### 3.4 Hệ thống

| # | Chức năng | Ưu tiên | Hiện trạng |
|---|---|---|---|
| S1 | Tính trạng thái tin theo ngày giờ VN (Sắp hết hạn trước 3 ngày, Hết hạn 23:59) | M | Đã có (tính khi đọc, không cần cron) |
| S2 | Lưu bằng chứng đồng ý: thời điểm, ô nào, phiên bản chính sách | M | Đã có (`consentAt`, `policyVersion`) |
| S3 | CV lưu riêng tư, chỉ HR mở qua phiên đăng nhập | M | Đã có (Vercel Blob private) |
| S4 | Chống spam form (honeypot), chống CSRF | M | Đã có |
| S5 | Giới hạn số lần nộp / tra cứu theo IP | M | **Chưa có** (cần cho C9) |
| S6 | SEO: JobPosting cho tin mở, gỡ khi đóng, sitemap (BR-16) | S | Đã có |
| S7 | Nhắc việc định kỳ / tự xoá bằng cron | C | Chưa có (MVP thay bằng nút H11) |

---

## 4. Luồng chính

### 4.1 Xem & tìm việc
1. Khách mở trang chủ → thấy danh sách tin Đang tuyển + Sắp hết hạn (sắp hết hạn có dòng "Còn N ngày").
2. Gõ từ khoá / chọn phòng ban → danh sách lọc ngay. Trên điện thoại hiện số tin giới hạn + "Xem thêm".
3. Bấm tin → trang chi tiết (lương, địa điểm, mô tả, hạn nộp, nút Ứng tuyển, Chia sẻ, Lưu).
- Nhánh: không có tin nào → "Hiện chưa có vị trí đang mở" + ô nhận báo (C2).
- Nhánh: lọc không ra kết quả → "Không có việc phù hợp" + nút xoá bộ lọc.
- Nhánh: mở link tin đã đóng → trang lý do (Tạm ngừng / Đã ngừng / Đã tuyển đủ), ẩn Ứng tuyển, ≤3 việc tương tự, ô
  nhận báo. Link tin nháp hoặc sai → "Không tìm thấy".

### 4.2 Ứng tuyển không đăng nhập
1. Bấm Ứng tuyển → hộp chọn: **[Đăng nhập Google]** (điền sẵn, dùng CV đã lưu, theo dõi hồ sơ) hoặc **[Nộp không cần
   đăng nhập]**. Chọn nộp không đăng nhập.
2. Điền họ tên, SĐT (bắt buộc), CV file PDF ≤4 MB hoặc link (bắt buộc 1 trong 2), email và lời nhắn (tuỳ chọn).
3. Tick ô đồng ý "xét vị trí này" (bắt buộc, không tick sẵn); ô "Giữ hồ sơ 12 tháng" tuỳ chọn.
4. Gửi → màn hình "Đã gửi hồ sơ": HR sẽ liên hệ qua số …; gợi ý "Tra cứu hồ sơ bằng SĐT" và "Đăng nhập Google để theo dõi".
- Lỗi nhập: báo dưới từng ô, không mất dữ liệu đã nhập.
- CV sai định dạng / >4 MB: báo "Chỉ nhận PDF tối đa 4 MB" ngay khi chọn file.
- Tin vừa đóng: nếu form mở trước giờ đóng → còn 60 phút ân hạn; quá ân hạn → báo lý do, giữ dữ liệu, gợi ý việc tương tự.
- Cùng SĐT đã nộp tin này trong 30 ngày → thay hồ sơ cũ, báo "Bạn đã nộp vị trí này ngày …".
- Mất mạng / lỗi máy chủ → báo "Chưa gửi được, thử lại", giữ dữ liệu.

### 4.3 Ứng tuyển có đăng nhập
1. Bấm Ứng tuyển → chọn Đăng nhập Google → cửa sổ Google → quay lại đúng tin, form mở sẵn.
2. Form điền sẵn họ tên, SĐT (nếu tài khoản có), email = email Google (khoá), CV = CV đã lưu (có nút "Dùng file khác").
3. Tick đồng ý → Gửi → "Đã gửi" + nút "Xem trong Hồ sơ của tôi".
4. Nếu ứng viên tải CV khác lúc nộp: hỏi "Lưu CV này thay CV cũ trong tài khoản?" [mặc định: Có] (vì 1 tài khoản = 1 CV).
- Huỷ/đóng cửa sổ Google hoặc trình duyệt chặn popup → quay lại hộp chọn, gợi ý "Nộp không cần đăng nhập".
- CV đã lưu bị xoá/hỏng trong kho → báo "Không mở được CV đã lưu, vui lòng tải lại".
- Đã đăng nhập sẵn → bỏ qua hộp chọn, mở form điền sẵn luôn.

### 4.4 Tra cứu hồ sơ bằng SĐT (không đăng nhập)
1. Khách vào "Tra cứu hồ sơ" (menu + màn hình "Đã gửi") → nhập SĐT → (nếu bị nghi ngờ) làm captcha → Tra cứu.
2. Hệ thống trả danh sách **tối thiểu**: tên vị trí, ngày nộp, trạng thái phía ứng viên (Đã gửi / HR đã xem /
   Mời phỏng vấn / Đạt, HR sẽ liên hệ / Đã đóng). Không hiện tên đầy đủ, email, CV, lời nhắn, ghi chú.
3. Kèm dòng: "Muốn sửa hoặc xoá hồ sơ? Đăng nhập Google bằng email đã nộp, hoặc nhắn HR qua Zalo …".
- Không có hồ sơ → "Không tìm thấy hồ sơ nào với số này trong [90] ngày qua" (cùng một kiểu câu, không gợi ý thêm).
- SĐT sai định dạng → báo lỗi định dạng (dùng chung luật chuẩn hoá SĐT đã có).
- Vượt giới hạn tra cứu → "Bạn tra cứu quá nhiều lần, thử lại sau [15] phút".
- Chi tiết giới hạn: xem 7.3.

### 4.5 Hồ sơ của tôi (đã đăng nhập)
1. Tab "Hồ sơ đã nộp": mọi hồ sơ có email = email Google, kèm trạng thái phía ứng viên, nút xem lại tin.
2. Tab "Việc đã lưu": tin đã lưu; tin đã đóng hiện nhãn đã đóng.
3. Tab "Thông tin & CV": sửa họ tên, SĐT; xem/đổi CV (PDF ≤4 MB, thay cũ); các ô đồng ý (giữ hồ sơ 12 tháng, nhận báo
   theo phòng ban) — bỏ tick có hiệu lực ngay.
4. "Xoá dữ liệu của tôi" → xác nhận 2 bước → xoá tài khoản, CV đã lưu, mọi hồ sơ cùng email (kèm file), việc đã lưu,
   đăng ký nhận báo của SĐT trong tài khoản → đăng xuất, báo "Đã xoá".
- Hồ sơ nộp bằng email khác / không ghi email: không hiện. Hiện dòng giải thích + cách nhờ HR.
- Bật nhận báo khi chưa có SĐT → nhắc nhập SĐT trước.
- Xoá file CV trong kho lỗi → không xoá gì, báo thử lại (đã có trong spec).

### 4.6 HR quản lý tin
1. **Đăng tin:** Tạo mới → nhập tiêu đề, phòng ban, địa điểm, lương (hoặc bỏ trống có cảnh báo), mô tả, hạn nộp
   (không quá khứ, ≤60 ngày) → Lưu nháp hoặc Đăng. Slug cố định sau khi đăng.
2. **Sửa:** sửa nội dung bất kỳ lúc nào; hạn nộp không được lùi về quá khứ, không vượt 60 ngày từ ngày đăng.
3. **Gia hạn** (từ Sắp hết hạn/Hết hạn): +14 ngày, không vượt mốc 60 ngày; nếu đã chạm mốc → nút ẩn, gợi ý Đăng lại.
4. **Tạm dừng / Mở lại:** tạm dừng ẩn khỏi danh sách và chặn nộp; mở lại chỉ khi hạn còn ở tương lai.
5. **Tuyển đủ:** đóng ngay, link vẫn mở; hiện nhắc "Còn N hồ sơ chưa xử lý — gửi lời cảm ơn".
6. **Đăng lại:** tạo tin nháp mới chép nội dung tin cũ, link mới; hồ sơ cũ ở lại tin cũ.
7. **Xoá:** chỉ tin nháp.
- Cảnh báo chữ nhạy cảm (giới tính, tuổi, ngoại hình, hôn nhân): hiện cảnh báo, HR vẫn được đăng.

### 4.7 HR xử lý hồ sơ
1. Mở "Hồ sơ ứng viên" → lọc theo tin/trạng thái; mục "Mới" đếm trên menu.
2. Mở 1 hồ sơ → tự chuyển Mới → Đã xem; xem CV (mở trong trang), SĐT, email, lời nhắn, ô "giữ hồ sơ".
3. Đổi trạng thái: Hẹn phỏng vấn / Đạt / Chưa phù hợp; ghi chú nội bộ (không bao giờ hiện cho ứng viên).
4. Chưa phù hợp hoặc tin đóng → sao chép mẫu lời cảm ơn, gửi Zalo tay → "Đánh dấu đã gửi".
5. (Mới, Must) Xoá hồ sơ theo yêu cầu: nút "Xoá hồ sơ này" có xác nhận, xoá kèm file CV; ghi lại ngày xoá + lý do
   ngắn ("ứng viên yêu cầu") vào nhật ký xoá (không lưu dữ liệu cá nhân trong nhật ký).
6. (Mới, Must) "Dữ liệu đến hạn xoá": danh sách xem trước → "Xoá tất cả" (xem 7.2).

### 4.8 HR người chờ tin
1. Mở "Người chờ tin" → nhóm theo phòng ban, có ngày đăng ký và tin xuất phát.
2. Khi có tin mới cùng phòng ban → "Sao chép tất cả số" → nhắn Zalo tay (chỉ dùng nội bộ, BR-23).
3. Xoá từng người (khi họ báo huỷ). Người đăng ký quá 6 tháng không có tin mới → nằm trong danh sách "đến hạn xoá".

---

## 5. Vòng đời & trạng thái

### 5.1 Tin tuyển dụng

| Từ \ Hành động | Ai | Sang | Điều kiện |
|---|---|---|---|
| (mới) → Lưu nháp | HR | Bản nháp | — |
| Bản nháp → Đăng | HR | Đang tuyển | Có hạn nộp, ≤60 ngày, không quá khứ |
| Bản nháp → Xoá | HR | (xoá) | Chỉ nháp |
| Đang tuyển → (tự động) | Hệ thống | Sắp hết hạn | Còn ≤[3] ngày |
| Đang tuyển / Sắp hết hạn → (tự động) | Hệ thống | Hết hạn | 23:59 ngày hạn nộp giờ VN |
| Đang tuyển / Sắp hết hạn → Tạm dừng | HR | Tạm dừng | — |
| Tạm dừng → Mở lại | HR | Đang tuyển / Sắp hết hạn | Hạn nộp còn ở tương lai |
| Tạm dừng → (tự động) | Hệ thống | Hết hạn | Qua hạn nộp (BR-19) |
| Đang tuyển / Sắp hết hạn / Tạm dừng → Tuyển đủ | HR | Đã tuyển đủ | — |
| Sắp hết hạn / Hết hạn → Gia hạn | HR | Đang tuyển | +14 ngày, tổng ≤60 ngày từ ngày đăng |
| Hết hạn / Đã tuyển đủ → Đăng lại | HR | (tin mới) Bản nháp | Link mới, hồ sơ cũ ở tin cũ |

| Trạng thái | Ứng viên mở link | Nhận hồ sơ | Trong danh sách | Google |
|---|---|---|---|---|
| Bản nháp | "Không tìm thấy" | Không | Không | Không index |
| Đang tuyển | Chi tiết đầy đủ | Có | Có | JobPosting |
| Sắp hết hạn | Như trên + "Còn N ngày" | Có | Có | JobPosting |
| Tạm dừng | "Tạm ngừng nhận hồ sơ" + ô nhận báo | Không | Không | Bỏ JobPosting |
| Hết hạn | "Đã ngừng nhận hồ sơ" + việc tương tự + nhận báo | Không (trừ ân hạn 60') | Không | Gỡ khỏi sitemap |
| Đã tuyển đủ | "Đã tuyển đủ người" + việc tương tự | Không | Không | Bỏ JobPosting |

**Mốc "tin đóng"** dùng cho hạn xoá dữ liệu (BR-09) = ngày tin chuyển Hết hạn hoặc Đã tuyển đủ. Tạm dừng **không** tính
là đóng (vì có thể mở lại); nếu tạm dừng rồi quá hạn → mốc đóng = ngày hạn nộp.

### 5.2 Hồ sơ ứng viên

| HR thấy | Ứng viên thấy (Hồ sơ của tôi / Tra cứu SĐT) | Ai đổi |
|---|---|---|
| Mới | Đã gửi | Hệ thống khi nộp |
| Đã xem | HR đã xem | Hệ thống khi HR mở hồ sơ |
| Hẹn phỏng vấn | Mời phỏng vấn | HR |
| Đạt | Đạt, HR sẽ liên hệ | HR |
| Chưa phù hợp | Đã đóng + lời cảm ơn (không ghi "trượt") | HR |
| (tin đóng, hồ sơ chưa xử lý) | Đã đóng | Hệ thống (tính khi hiển thị) |
| (đã xoá) | Không còn hiện | HR / ứng viên / xoá theo hạn |

- HR được đổi qua lại giữa các trạng thái (sửa nhầm); không quay về "Mới".
- Ghi chú nội bộ và cờ "đã gửi cảm ơn" không bao giờ hiện cho ứng viên.
- Đề xuất: khi HR chọn "Đạt", hiện nhắc "Sau khi nhận việc, chuyển hồ sơ sang hồ sơ nhân sự nội bộ; bản trên trang sẽ
  vào danh sách xoá sau [30] ngày" (BR-20).

---

## 6. Luật nghiệp vụ

Ký hiệu: **Giữ** = giữ nguyên · **Chỉnh** = sửa theo quyết định đã chốt · **Sau** = để sau MVP.

| Mã | Nội dung ngắn | Quyết định | Ghi chú |
|---|---|---|---|
| BR-01 | Hạn nộp bắt buộc, ≤[60] ngày từ ngày đăng | Giữ | Đã có |
| BR-02 | Hết hạn 23:59 ngày hạn nộp, giờ VN | Giữ | Đã có |
| BR-03 | Trước [3] ngày → Sắp hết hạn; nhắc HR qua email/Zalo + banner | Chỉnh | Chỉ banner trong trang HR; email/Zalo → Sau |
| BR-04 | Gia hạn giữ link/hồ sơ; tuyển đợt mới thì Đăng lại | Giữ | Đã có |
| BR-05 | Link tin đóng không lỗi; lý do + ≤3 việc tương tự | Giữ | Đã có |
| BR-06 | Tuyển đủ đóng ngay; nhắc gửi cảm ơn hồ sơ chưa xử lý | Giữ | Nhắc = thông báo trong trang |
| BR-07 | Cùng SĐT nộp lại cùng tin trong [30] ngày → cập nhật hồ sơ cũ | Giữ | Đã có |
| BR-08 | Không ghi lương vẫn đăng, có cảnh báo, không gửi lương lên Google | Giữ | |
| BR-09 | Không được tuyển: xoá sau [30] ngày kể từ tin đóng; [12] tháng nếu tick "Giữ hồ sơ" | Chỉnh | Bắt buộc ở MVP, thực hiện bằng **nút xoá đến hạn** (H11) thay cho cron |
| BR-10 | Nhận báo: SĐT Zalo + phòng ban, ô đồng ý riêng; xoá sau [6] tháng không có tin mới | Chỉnh | Xoá 6 tháng gộp vào nút H11 |
| BR-11 | Ô đồng ý không tick sẵn; mỗi mục đích một ô | Giữ | Đã có. Thêm vào chữ ô đồng ý: hồ sơ tra cứu được bằng SĐT (xem BR-27) |
| BR-12 | Lưu bằng chứng đồng ý (thời điểm, ô, phiên bản chính sách) | Giữ | Đã có. Cần tăng `policyVersion` khi sửa chính sách |
| BR-13 | Chỉ hỏi thông tin cần thiết; không CCCD, ảnh, ngày sinh… | Giữ | |
| BR-14 | Tự xoá trong "Hồ sơ của tôi" → xoá ngay; qua HR: phản hồi [2] ngày làm việc, xoá ≤[20] ngày, sửa/xem ≤[10] ngày | Chỉnh | Người không có Google đi đường HR → cần nút xoá hồ sơ cho HR (H12) |
| BR-15 | Không ghi yêu cầu giới tính/tuổi/ngoại hình/hôn nhân; form cảnh báo | Giữ | |
| BR-16 | Tin đóng gỡ JobPosting, báo Google qua sitemap | Giữ | Indexing API → Sau |
| BR-17 | Đăng nhập ứng viên giai đoạn 2, OTP Zalo/SMS | **Chỉnh** | Thay bằng: đăng nhập tuỳ chọn, **chỉ Google**; không OTP/SMS/Zalo |
| BR-18 | Gia hạn +[14] ngày, tổng ≤60 ngày | Giữ | |
| BR-19 | Tạm dừng qua hạn → Hết hạn; mở lại chỉ khi còn hạn | Giữ | |
| BR-20 | Được tuyển: chuyển sang hồ sơ nhân sự, bản trên trang xoá sau [30] ngày | Chỉnh | Chuyển sang HSNS làm tay; xoá gộp vào nút H11 (30 ngày sau tin đóng) |
| BR-21 | Đóng tin → nhắc cảm ơn; mẫu Zalo, HR bấm gửi từng người | Chỉnh | Gửi tay + "Đánh dấu đã gửi"; gửi tự động → Sau |
| BR-22 | Đăng nhập Google lần đầu phải xác minh SĐT | **Chỉnh** | Bỏ. Tài khoản = email Google; hồ sơ nối theo email |
| BR-23 | "Sao chép tất cả số" chỉ dùng nội bộ, không xuất file | Giữ | |

**Luật mới cần thêm:**

| Mã | Luật |
|---|---|
| BR-24 | Bấm Ứng tuyển khi chưa đăng nhập → luôn có 2 lựa chọn ngang nhau: "Đăng nhập Google" và "Nộp không cần đăng nhập". Không ép đăng nhập. Đã đăng nhập → vào form luôn. |
| BR-25 | Tài khoản ứng viên = email Google đã xác minh (chữ thường). "Hồ sơ của tôi" chỉ hiện hồ sơ có email trùng. Khi đã đăng nhập, email trong form khoá theo Google. |
| BR-26 | Mỗi tài khoản lưu đúng 1 CV (PDF ≤4 MB). Tải CV mới (ở tài khoản hoặc lúc nộp, nếu đồng ý lưu) → xoá file cũ. Mỗi hồ sơ đã nộp giữ **bản sao riêng** của CV tại thời điểm nộp, đổi CV tài khoản không làm đổi hồ sơ đã gửi. |
| BR-27 | Tra cứu bằng SĐT: chỉ trả tên vị trí, ngày nộp, trạng thái phía ứng viên; không trả tên đầy đủ, email, CV, lời nhắn, ghi chú; không sửa/xoá được qua tra cứu. Giới hạn tần suất theo 7.3. |
| BR-28 | Tra cứu chỉ hiện hồ sơ nộp trong [90] ngày gần nhất và chưa bị xoá. |
| BR-29 | Mọi thao tác xoá (ứng viên tự xoá, HR xoá theo yêu cầu, xoá đến hạn) ghi nhật ký: thời điểm, loại, số lượng, người bấm — **không** ghi tên/SĐT. Giữ nhật ký [24] tháng làm bằng chứng tuân thủ. |
| BR-30 | HR phải bấm "Xoá dữ liệu đến hạn" ít nhất **mỗi tuần**; trang HR hiện banner khi có dữ liệu quá hạn > [7] ngày. |
| BR-31 | Nộp hồ sơ giới hạn [5] lần / 10 phút / IP (chống spam, chống lấp hồ sơ người khác qua BR-07). |

---

## 7. Dữ liệu cá nhân & tuân thủ

### 7.1 Bản đồ dữ liệu

| Dữ liệu | Nguồn | Mục đích | Thời gian lưu | Ai xem | Cách xoá |
|---|---|---|---|---|---|
| Họ tên, SĐT, email (tuỳ chọn), lời nhắn | Form nộp | Xét tuyển vị trí đã nộp, liên hệ | 30 ngày sau tin đóng; 12 tháng nếu tick "Giữ hồ sơ" | 2 HR | Ứng viên tự xoá (Google) · HR xoá theo yêu cầu · nút xoá đến hạn |
| CV (file PDF / link) | Form nộp | Như trên | Như trên | 2 HR (file riêng tư) | Xoá cùng hồ sơ, kèm file trong kho |
| Bằng chứng đồng ý (thời điểm, ô, phiên bản) | Hệ thống | Chứng minh đồng ý | Cùng vòng đời hồ sơ; nhật ký xoá giữ riêng không có dữ liệu cá nhân | HR | Xoá cùng hồ sơ |
| Trạng thái, ghi chú HR, cờ cảm ơn | HR | Quản lý tuyển dụng | Cùng hồ sơ | 2 HR (ghi chú không bao giờ lộ ra ngoài) | Xoá cùng hồ sơ |
| Tài khoản: email Google, tên, SĐT, 1 CV, lựa chọn đồng ý | Ứng viên | Nộp nhanh, theo dõi | Đến khi ứng viên xoá; đề xuất xoá nếu [24] tháng không đăng nhập (Could) | Ứng viên; HR không có màn hình xem tài khoản | Ứng viên tự xoá |
| Việc đã lưu | Ứng viên | Tiện ích | Cùng tài khoản | Ứng viên | Cùng tài khoản |
| Người chờ tin: SĐT Zalo, phòng ban, tin xuất phát | Ô nhận báo | Báo việc mới | 6 tháng không có tin mới cùng phòng ban | 2 HR | HR xoá từng người · nút xoá đến hạn · ứng viên tắt trong tài khoản |
| Log kỹ thuật (IP, thời điểm tra cứu/nộp) | Hệ thống | Chống lạm dụng | [30] ngày | Kỹ thuật | Tự hết hạn ở nhà cung cấp / bộ đếm |

### 7.2 Cái nào trong danh sách "chưa làm" thực ra là BẮT BUỘC

| Hạng mục | Bắt buộc cho MVP? | Lý do | Cách tối thiểu đề xuất |
|---|---|---|---|
| Xoá dữ liệu theo hạn (BR-09, BR-10, BR-20) | **Có** | Công ty đã cam kết thời hạn lưu trong chính sách; luật yêu cầu xoá khi hết mục đích/thời hạn và chứng minh được. Không xoá = vi phạm chính cam kết của mình | Trang HR "Dữ liệu đến hạn xoá": liệt kê số hồ sơ / người chờ tin quá hạn (không cần hiện chi tiết), nút "Xoá tất cả" + xác nhận, ghi nhật ký (BR-29). Banner nhắc khi quá hạn > 7 ngày (BR-30). Cron tự động có thể thêm sau, rất rẻ (Vercel Cron 1 lần/ngày gọi cùng hàm). |
| HR xoá 1 hồ sơ theo yêu cầu | **Có** | Người không có Gmail chỉ yêu cầu được qua HR (BR-14), phải xử lý trong 20 ngày | Nút "Xoá hồ sơ này" trong chi tiết hồ sơ |
| Gửi Zalo/SMS tự động | Không | Liên hệ tay vẫn đáp ứng nghiệp vụ | Mẫu tin + nút sao chép + mở `zalo.me/<số>` |
| Email nhắc HR | Không | Banner trong trang HR đủ với 2 người dùng hằng ngày | Banner (đã có) |
| Cập nhật trang Chính sách dữ liệu | **Có** | Đang mô tả sai cách đăng nhập (SĐT) và thiếu việc tra cứu bằng SĐT; còn chỗ trống tên công ty/liên hệ | Sửa nội dung, tăng `policyVersion` |

### 7.3 Rủi ro tra cứu hồ sơ bằng SĐT và biện pháp

**Rủi ro.** SĐT không phải bí mật: đồng nghiệp, sếp hiện tại, người thân, hay bất kỳ ai có danh bạ đều biết. Việc
"người này đang tìm việc ở công ty X, vị trí Y, đã được mời phỏng vấn" là thông tin nhạy cảm về đời sống nghề nghiệp
(có thể làm họ bị sếp hiện tại gây khó). Thêm nữa, SĐT VN có cấu trúc đoán được nên kẻ xấu có thể dò hàng loạt số để
lấy danh sách người đã nộp. Đây là rủi ro lộ dữ liệu có thật, nhưng chấp nhận được **nếu** chỉ trả rất ít thông tin.

**Biện pháp (vẫn giữ "chỉ cần số điện thoại"):**

| # | Biện pháp | Mức |
|---|---|---|
| 1 | Chỉ trả: tên vị trí, ngày nộp, trạng thái phía ứng viên. Không trả họ tên (hoặc chỉ tên gọi cuối, vd "…Anh"), email, CV, lời nhắn, ghi chú, lý do | Must |
| 2 | Không có thao tác sửa/xoá/tải CV từ trang tra cứu | Must |
| 3 | Chỉ hồ sơ trong [90] ngày, chưa bị xoá (BR-28) | Must |
| 4 | Giới hạn: [5] lần tra / 15 phút / IP; [10] lần / ngày / mỗi SĐT (bất kể IP); vượt → chặn [15] phút | Must |
| 5 | Captcha vô hình (vd Cloudflare Turnstile, miễn phí) từ lần tra thứ [3] trong phiên, hoặc luôn bật | Should |
| 6 | Câu trả lời "không tìm thấy" giống hệt nhau; thời gian phản hồi như nhau | Should |
| 7 | Ghi rõ ở ô đồng ý khi nộp: "Trạng thái hồ sơ có thể được tra cứu bằng số điện thoại này" + trong chính sách | Must |
| 8 | Nếu ứng viên yêu cầu (qua HR hoặc trong tài khoản), tắt tra cứu cho SĐT đó | Could |
| 9 | Theo dõi: banner cho HR nếu một ngày có > [50] lượt tra cứu (dấu hiệu dò số) | Could |
| 10 | Trang tra cứu không cho Google index (`noindex`) | Must |

**Rủi ro còn lại BA cần chủ sản phẩm chấp nhận:** người biết SĐT vẫn biết được "người này đã nộp vị trí Y ngày Z và
trạng thái". Phương án mạnh hơn (gửi mã qua SMS/Zalo) đã bị loại vì chi phí; phương án trung gian không tốn tiền là
**yêu cầu nhập thêm 3 ký tự cuối email hoặc mã tra cứu hiện ở màn hình "Đã gửi"** — xem câu hỏi mở Q1.

### 7.4 Rủi ro dữ liệu khác

| Rủi ro | Biện pháp |
|---|---|
| Ai đó nộp hộ bằng SĐT người khác và đè hồ sơ thật của họ (BR-07) | Giới hạn nộp BR-31; BR-07 chỉ đè khi cùng tin; HR thấy dấu "đã cập nhật lần 2" (Should) |
| Ai đó nộp bằng Gmail của người khác → hồ sơ hiện ở tài khoản người kia | Đã chấp nhận trong spec Google: người nộp chỉ lộ dữ liệu của chính mình |
| 2 HR dùng chung tài khoản / lộ mật khẩu | Mỗi người 1 tài khoản, mật khẩu ≥[12] ký tự, khoá sau 5 lần sai (đã có); Should: màn hình đổi mật khẩu |
| CV bị lộ link | Kho riêng tư, chỉ mở qua phiên HR (đã có) |
| Vercel gói Hobby không cho dùng thương mại | Chuyển gói Pro trước khi chạy thật (ngoài phạm vi BA, ghi nhận rủi ro) |
| Dữ liệu lưu ở máy chủ ngoài VN (Neon/Vercel Singapore) | Luật mới có quy định chuyển dữ liệu ra nước ngoài; cần pháp chế xác nhận có phải lập hồ sơ đánh giá tác động hay không (Q8) |

---

## 8. Tình huống biên

| # | Tình huống | Cách xử lý mong muốn |
|---|---|---|
| 1 | Đang điền form thì tin hết hạn | Form mở trước giờ đóng: nhận trong 60 phút ân hạn. Quá ân hạn: giữ dữ liệu, báo lý do, gợi ý việc tương tự |
| 2 | HR tạm dừng / tuyển đủ khi ứng viên đang điền | Không có ân hạn; báo "Vị trí vừa ngừng nhận hồ sơ", giữ dữ liệu đã nhập |
| 3 | Link tin hết hạn chia sẻ qua Zalo | Mở trang "Đã ngừng nhận hồ sơ", không lỗi; ảnh xem trước có thể là ảnh cũ |
| 4 | HR chọn hạn nộp trong quá khứ | Không cho chọn; muốn đóng sớm → Tạm dừng hoặc Tuyển đủ |
| 5 | Gia hạn khi đã chạm mốc 60 ngày | Ẩn nút Gia hạn, gợi ý Đăng lại |
| 6 | Mở lại tin tạm dừng đã quá hạn | Không cho; tin đã ở Hết hạn → Gia hạn (nếu còn quỹ 60 ngày) hoặc Đăng lại |
| 7 | Không còn tin đang tuyển | "Hiện chưa có vị trí đang mở" + ô nhận báo |
| 8 | Cùng SĐT nộp cùng tin lần 2 trong 30 ngày | Thay hồ sơ cũ, giữ trạng thái/ghi chú HR cũ? → đề xuất: **đưa về "Mới"**, giữ ghi chú, báo ứng viên ngày nộp trước |
| 9 | Cùng SĐT nộp lại sau 31 ngày | Tạo hồ sơ mới |
| 10 | Ứng viên đăng nhập Google nhưng trước đó nộp không ghi email / email khác | Hồ sơ cũ không hiện trong tài khoản; vẫn tra cứu được bằng SĐT; muốn xoá → nhờ HR |
| 11 | Ứng viên đổi CV trong tài khoản sau khi đã nộp | Hồ sơ đã nộp giữ CV cũ (bản sao lúc nộp, BR-26) |
| 12 | Ứng viên tự xoá dữ liệu khi HR đang mở hồ sơ | HR thao tác tiếp nhận "Hồ sơ không còn tồn tại", danh sách tự làm mới |
| 13 | Ứng viên xoá dữ liệu nhưng còn hồ sơ nộp bằng SĐT không có email | Chỉ xoá theo email (đã chốt); màn hình xác nhận ghi rõ "Hồ sơ nộp không kèm email này cần nhờ HR xoá" |
| 14 | Tra cứu SĐT thấy hồ sơ đã bị xoá theo hạn | Không hiện (đã xoá thật) |
| 15 | Tra cứu bằng SĐT có nhiều cách viết (+84, 84, 0, có dấu cách) | Chuẩn hoá trước khi so (dùng luật SĐT chung đã có) |
| 16 | Một máy tra cứu hàng loạt số khác nhau | Chặn theo IP sau [5] lần / 15 phút; banner cho HR nếu bất thường |
| 17 | File CV đuôi .pdf nhưng không phải PDF / có mật khẩu / 0 byte | Từ chối "File không phải PDF hợp lệ" (BE kiểm tra nội dung, đã có) |
| 18 | CV gần 4 MB bị chặn bởi giới hạn 4,5 MB của máy chủ | FE chặn từ 4 MB và báo rõ; nếu vẫn lỗi 413 → báo "File quá lớn" chứ không báo lỗi chung |
| 19 | Popup Google bị chặn / người dùng huỷ | Quay lại hộp chọn, gợi ý nộp không đăng nhập |
| 20 | Ứng viên đã đăng nhập bằng Gmail A nhưng muốn nộp bằng email B | Không cho trong phiên đăng nhập; muốn dùng email B thì đăng xuất và nộp không đăng nhập |
| 21 | 2 HR cùng sửa 1 hồ sơ | Ai lưu sau thắng; ghi chú nên là ô nối thêm (Could) |
| 22 | HR chuyển "Đạt" rồi ứng viên từ chối offer | HR đổi sang "Chưa phù hợp" hoặc giữ "Đạt"; xoá theo hạn như thường |
| 23 | Tin bị Đăng lại: người chờ tin có nhận báo? | HR thấy người chờ tin của phòng ban đó để nhắn tay; tin mới không tự gửi gì |
| 24 | Nút "Xoá dữ liệu đến hạn" bị bấm 2 lần / lỗi giữa chừng | Xoá từng hồ sơ kèm file; lỗi file → bỏ qua hồ sơ đó và báo "còn N hồ sơ chưa xoá được"; bấm lại an toàn |
| 25 | Hồ sơ tick "Giữ hồ sơ 12 tháng" sau đó ứng viên bỏ tick | Áp dụng ngay: hồ sơ quay về hạn 30 ngày sau tin đóng (có thể đến hạn xoá ngay) |

---

## 9. Câu hỏi mở cho chủ sản phẩm

| # | Câu hỏi | Đề xuất mặc định của BA |
|---|---|---|
| Q1 | Tra cứu chỉ bằng SĐT có chấp nhận rủi ro "người biết số biết người đó đang nộp đơn" không? Có muốn thêm **mã tra cứu** 6 ký tự hiện ở màn hình "Đã gửi" (không tốn tiền) không? | Giữ chỉ SĐT như đã chốt, áp dụng đủ biện pháp Must ở 7.3; cân nhắc lại sau 1 tháng chạy |
| Q2 | Tra cứu có hiện tên (che bớt) để ứng viên chắc là hồ sơ của mình không? | Không hiện tên; chỉ vị trí + ngày + trạng thái |
| Q3 | Hồ sơ nộp lại trong 30 ngày (BR-07): đưa trạng thái về "Mới" hay giữ trạng thái HR đã đặt? | Đưa về "Mới", giữ ghi chú HR |
| Q4 | Khi ứng viên đã đăng nhập tải CV khác lúc nộp, có tự thay CV trong tài khoản không? | Hỏi ứng viên, mặc định "Có" |
| Q5 | Ai trong 2 HR chịu trách nhiệm bấm "Xoá dữ liệu đến hạn" hằng tuần? Có muốn bật luôn cron tự động (gần như không tốn chi phí)? | Làm nút bấm trước; bật cron ngay ở đợt 4 nếu HR đồng ý |
| Q6 | Tài khoản ứng viên không đăng nhập lâu có tự xoá không? | Có, sau [24] tháng không đăng nhập (Could, làm sau) |
| Q7 | Thông tin liên hệ chính thức cho yêu cầu dữ liệu (email, Zalo, tên pháp nhân, địa chỉ) để điền vào chính sách? | Cần chủ sản phẩm cung cấp — đang chặn việc chạy thật |
| Q8 | Đã có pháp chế/luật sư xem chính sách và việc lưu dữ liệu ở Singapore chưa? | Nhờ xem trước khi mở công khai; không chặn việc làm code |
| Q9 | Ngưỡng giới hạn tra cứu ([5]/15 phút/IP, [10]/ngày/SĐT) và cửa sổ [90] ngày có ổn không? | Dùng các số này |
| Q10 | Có cần màn hình đổi mật khẩu / thêm HR trong app, hay tiếp tục tạo bằng lệnh kỹ thuật? | Should: thêm "Đổi mật khẩu"; thêm HR vẫn bằng lệnh |

---

## 10. Đề xuất thứ tự làm phần còn thiếu

| Đợt | Nội dung | Lý do thứ tự |
|---|---|---|
| **1. Hoàn tất đăng nhập Google** | Làm xong spec `spec-candidate-google.md` (Step 1–4): tài khoản theo email, "Hồ sơ của tôi" theo email, bỏ OTP | Đang dở, là nền cho đợt 2 |
| **2. Ứng tuyển 2 lựa chọn + 1 CV** | Hộp chọn khi bấm Ứng tuyển (BR-24); nộp bằng CV đã lưu, hỏi thay CV (BR-26) | Hoàn thiện trải nghiệm đã chốt |
| **3. Tuân thủ tối thiểu (Must, chặn chạy thật)** | HR xoá 1 hồ sơ (H12); trang "Dữ liệu đến hạn xoá" + nhật ký xoá (H11, BR-29, BR-30); sửa trang Chính sách + chữ ô đồng ý, tăng `policyVersion`; giới hạn nộp theo IP (BR-31) | Không có đợt này thì không nên mở cho ứng viên thật |
| **4. Tra cứu bằng SĐT** | Trang tra cứu (BR-27, BR-28), giới hạn tần suất, captcha, `noindex`, liên kết từ menu và màn hình "Đã gửi" | Phụ thuộc chữ đồng ý mới ở đợt 3 (phải báo trước cho ứng viên) |
| **5. Tiện ích HR (Should)** | Nhắc cảm ơn khi đóng tin (BR-06/21), đổi mật khẩu HR, cron tự xoá gọi lại hàm của đợt 3, cảnh báo lượt tra cứu bất thường | Giảm việc tay sau khi đã chạy ổn |

Ngoài code, trước khi mở công khai: điền thông tin pháp nhân/liên hệ (Q7), chuyển Vercel gói Pro, cấu hình Google
OAuth cho domain thật, nhờ pháp chế xem mục 7.
