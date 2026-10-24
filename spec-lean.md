# Spec: Tinh gọn trang tuyển dụng, HR tự làm các việc quản trị

Theo `docs/ba/2026-10-25-tinh-gon.md`. Chủ sản phẩm chọn ngày 2026-10-24: làm hết bảng đề xuất (giữ "Hồ sơ của
tôi" dạng 1 trang); HR tự làm: xoá hồ sơ bằng nút, quản lý tài khoản HR, tự liên hệ báo kết quả cho ứng viên.

## 1. Problem

Công ty có một văn phòng và vài tin mỗi năm, nhưng form đăng tin có hơn 30 ô, có 4 trạng thái tin, 5 trạng thái hồ
sơ, cùng nhiều tính năng ít người dùng (lưu việc, bộ lọc, hộp chia sẻ…). Còn thiếu những việc luật bắt buộc: xoá hồ sơ
đến hạn, xoá từng hồ sơ theo yêu cầu. Tài khoản HR hiện chỉ tạo được bằng lệnh.

## 2. Requirements

**Must have:**

- **Tin tuyển dụng gọn lại.** Form chỉ còn: Tên vị trí, Phòng ban, Hình thức (Toàn thời gian / Bán thời gian / Thực
  tập), Kinh nghiệm, Học vấn, Giờ làm, Lương (Từ–Đến hoặc để trống = Thoả thuận), Hạn nộp, **Mô tả công việc**, **Yêu cầu**,
  **Quyền lợi** (chọn nhiều), **Lộ trình thử việc** (điền sẵn), **Địa chỉ làm việc** (điền sẵn). Bỏ: Thành phố, Làm từ xa, Cấp bậc, Ngoại ngữ, Số lượng, Cộng thêm, Tag kỹ năng, Tóm tắt, Làm việc cùng, Điểm cộng, 5 ô quyền lợi. Cảnh báo câu chữ phân biệt đối xử thay bằng 1 dòng nhắc cố định.
- **Giờ làm chọn sẵn, không phải gõ.** Ngày làm: Thứ 2 – Thứ 6 / **Thứ 2 – Thứ 7** (mặc định) / Thứ 2 – sáng Thứ 7 /
  Làm theo ca / Khác (gõ tay). Giờ: Từ – Đến (ô chọn giờ, mặc định 8:00 – 17:30). Trang tin hiện "Thứ 2 – Thứ 7,
  8:00 – 17:30". Vẫn lưu thành 1 chuỗi như hiện tại, không đổi DB; tin cũ không khớp mẫu thì mở ra ở chế độ "Khác".
- **Kinh nghiệm và Học vấn: chọn sẵn + "Khác" để tự gõ.** Học vấn: Không yêu cầu (mặc định) / THPT / Trung cấp trở
  lên / Cao đẳng trở lên / Đại học trở lên / Khác. Kinh nghiệm: Không yêu cầu / Từ 1 năm / Từ 2 năm / Từ 3 năm / Khác.
  Chọn "Khác" hiện ô gõ (tối đa 60 ký tự). Trang tin chỉ hiện Học vấn khi khác "Không yêu cầu".
- **Lương nhập đúng số tiền, tự chấm phân cách.** Ô "Lương từ" / "Đến" nhập số tiền đầy đủ, gõ tới đâu tự định dạng
  tới đó (`15000000` → `15.000.000`), có chữ "đ/tháng" cố định cuối ô; bàn phím số trên điện thoại. Ngay dưới hiện
  "Ứng viên sẽ thấy: 15 – 20 triệu". Kiểm tra khi rời ô: dưới 1.000.000 đ báo "Có thiếu số 0 không?", trên
  500.000.000 đ báo quá lớn, "Đến" nhỏ hơn "Từ" báo lỗi; làm tròn tới 100.000 đ. Hiển thị cho ứng viên: "15 – 20
  triệu", "7,5 triệu", "Từ 10 triệu", "Thỏa thuận". DB lưu đơn vị đồng (migration nhân 1.000.000 cho tin cũ).
- **Hạn nộp chọn nhanh, không dùng ô ngày của trình duyệt.** Nút chọn nhanh: 7 / 14 / 30 (mặc định) / 60 ngày. Bấm
  "Chọn ngày khác" mở lịch tiếng Việt (tuần bắt đầu Thứ 2, ngày đã qua và quá 60 ngày bị mờ). Dưới ô hiện "Thứ Bảy,
  23/11/2026 · còn 30 ngày". Lịch dùng thư viện `react-day-picker` (nhẹ, có tiếng Việt, truy cập bằng bàn phím được),
  kiểm tra cảnh báo bảo mật trước khi thêm.
- **Quyền lợi: tích chọn nhiều, không phải gõ.** Danh sách sẵn (tin mới tích sẵn những mục chuẩn của công ty, HR
  bỏ tích nếu không áp dụng): Lương tháng 13 · Thưởng theo kết quả công việc · Thưởng lễ, Tết · Đóng BHXH, BHYT, BHTN
  đầy đủ · 12 ngày phép/năm · Khám sức khỏe định kỳ · Du lịch, team building hằng năm · Đào tạo, kèm cặp khi mới vào ·
  Xét tăng lương hằng năm · Phụ cấp ăn trưa · Phụ cấp gửi xe, xăng · Hoa hồng. Nút "+ Thêm quyền lợi khác" để gõ 1 mục
  riêng (tối đa 80 ký tự); mục đã gõ ở tin trước hiện lại làm gợi ý. Trang tin hiện dạng danh sách có dấu ✓.
- **Lộ trình thử việc 2 tháng, có sẵn nội dung mặc định.** 5 mốc cố định: Ngày đầu tiên · Sau 3 ngày · Sau 10 ngày ·
  Sau 1 tháng · Sau 2 tháng (hết thử việc). Tin mới điền sẵn nội dung mẫu chung, HR chỉ sửa mốc nào khác (mỗi mốc tối đa
  200 ký tự), có nút "Dùng lại mẫu chung". Mẫu: (1) nhận máy, tài khoản, gặp quản lý và nhóm; (2) nắm quy trình của
  phòng, làm việc nhỏ cùng người kèm; (3) tự làm việc hằng ngày, người kèm xem lại; (4) làm độc lập phần việc chính,
  thống nhất mục tiêu thử việc với quản lý; (5) đánh giá cùng quản lý, ký hợp đồng chính thức. Trang tin hiện dạng
  dòng thời gian "Lộ trình 2 tháng thử việc".
- **Mặc định là chính, chỉ sửa khi cần.** Giờ làm, Địa chỉ làm việc, Quyền lợi, Lộ trình, Học vấn, Kinh nghiệm: tin mới lấy sẵn theo
  mẫu chung. Trên form, Quyền lợi và Lộ trình hiện **thu gọn** 1 dòng "Theo mẫu chung · 9 quyền lợi" + nút "Sửa cho
  tin này"; chỉ khi bấm mới mở ra. Tin đã sửa khác mẫu thì ghi "Đã sửa riêng · Dùng lại mẫu chung".
- **HR sửa mẫu chung** ở trang `/hr/mau-tin` (1 lần, áp cho các tin tạo sau; tin cũ giữ nguyên): giờ làm mặc định, địa chỉ làm việc mặc định,
  danh sách quyền lợi + mục nào tích sẵn, nội dung 5 mốc lộ trình. Lưu 1 dòng trong bảng `job_template` (jsonb).
- **Địa chỉ làm việc điền sẵn.** Mặc định địa chỉ văn phòng Gò Vấp (theo mẫu chung), hiện 1 dòng + nút "Đổi cho tin
  này" khi vị trí làm ở nơi khác (tối đa 200 ký tự). Trang tin hiện địa chỉ này; bản đồ và nút "Chỉ đường" chỉ hiện khi
  là địa chỉ mặc định (có toạ độ), địa chỉ khác thì nút "Chỉ đường" mở Google Maps tìm theo chữ.
- **Phòng ban do HR tự gõ.** Ô "Phòng ban" là ô nhập chữ (tối đa 60 ký tự) có gợi ý từ các phòng ban đã dùng ở tin
  cũ + 5 phòng ban sẵn có. Gõ tên mới là có phòng ban mới, không cần sửa code. Bỏ danh sách cố định trong code.
- **Trạng thái tin: Nháp / Đang đăng / Đã đóng.** Thao tác: Đăng, Đóng tin, Sửa hạn nộp (tối đa 60 ngày tính từ
  hôm nay, kể cả tin đã hết hạn hoặc đã đóng thì thành mở lại). Bỏ: Gia hạn +14 ngày, Tạm dừng, Đã tuyển đủ, ân hạn
  60 phút. Tin đã đóng/hết hạn hiện 1 câu: "Vị trí này đã ngừng nhận hồ sơ."
- **Hồ sơ ứng viên: Mới / Đã xem / Hẹn phỏng vấn / Chưa phù hợp.** Bỏ trạng thái "Đạt", nút "đã gửi lời cảm ơn",
  nhãn "ứng viên vừa cập nhật", cờ "giữ hồ sơ cho vị trí khác". Ứng viên thấy: Đã gửi / HR đã xem / Mời phỏng vấn /
  Đã đóng. Nộp lại trong 30 ngày vẫn giữ trạng thái HR đã đặt (đã chốt), hồ sơ lên đầu danh sách.
- **HR xoá hồ sơ:**
  - Nút "Xoá hồ sơ" ở chi tiết hồ sơ (bấm 2 lần để xác nhận), xoá cả file CV.
  - Ở danh sách tin, hiện "N hồ sơ đến hạn xoá" (tin đã đóng hoặc hết hạn quá 30 ngày) với nút "Xoá tất cả" (xác
    nhận) — xoá hồ sơ và CV của các tin đó. Không có xoá tự động.
- **Quản lý tài khoản HR** (trang `/hr/tai-khoan`, mọi HR đều làm được vì cùng toàn quyền):
  - Danh sách tài khoản (email, tên, lần đăng nhập gần nhất nếu có).
  - Thêm tài khoản: nhập email + tên → hệ thống tạo mật khẩu tạm, hiện **1 lần** để HR gửi cho người đó.
  - Đặt lại mật khẩu cho người khác: tạo mật khẩu tạm mới, hiện 1 lần; phiên đăng nhập cũ của người đó bị thoát.
  - Tự đổi mật khẩu của mình (nhập mật khẩu cũ + mới, theo chính sách mật khẩu hiện có).
  - Xoá tài khoản: không xoá được chính mình, không xoá được tài khoản cuối cùng.
- **Phía ứng viên gọn lại:**
  - Bỏ "Lưu việc" (nút, danh sách, API, bảng).
  - Bỏ trang `/dang-nhap` và mục "Đăng nhập" trên menu. `/ho-so-cua-toi` khi chưa đăng nhập hiện nút Google ngay tại
    trang; `/dang-nhap` chuyển về đó. Nút Google trong form nộp giữ nguyên. Đã đăng nhập thì menu có "Hồ sơ của tôi".
  - "Hồ sơ của tôi" thành 1 trang: hồ sơ đã nộp → thông tin + CV → xoá dữ liệu.
  - Trang danh sách việc bỏ ô tìm và các bộ lọc.
  - Trang tin: bỏ khối "Nộp đơn trong 1 phút", "Quy trình tuyển dụng", tag kỹ năng; khối "90 ngày đầu" thay bằng "Lộ trình 2 tháng thử việc". **Giữ** "Nơi bạn
    sẽ làm việc" (ảnh + bản đồ, bạn đã yêu cầu).
  - Chia sẻ: 1 nút "Chia sẻ" (dùng chia sẻ của điện thoại, máy không hỗ trợ thì chép link). Bỏ hộp chia sẻ. Trang xem
    trước khi dán link lên Zalo/Facebook vẫn giữ.
  - Form nộp: bỏ khối "Sau khi gửi hồ sơ" và các câu giải thích dưới ô nhập.
- Sửa câu demo "Tải CV khi nối BE" ở trang HR.
- **Dashboard `/hr`** (trang đầu khi vào): **biểu đồ cột số hồ sơ nhận mỗi ngày (30 ngày gần nhất, lọc theo tin, rê/chạm vào cột thấy số)** · hồ sơ mới chưa xem (và số chờ quá 3 ngày) · lịch hẹn phỏng vấn sắp tới ·
  số hồ sơ 7 ngày qua theo tin · tin sắp/đã hết hạn + "Sửa hạn nộp" · số hồ sơ đến hạn xoá.
- **Hồ sơ ứng viên:** ô tìm theo tên/SĐT; mỗi dòng có biểu tượng có/không CV, dòng đầu ghi chú, ngày nộp đủ năm; chi
  tiết hiện "Người này đã nộp N vị trí khác" + link; nút "Đánh dấu chưa xem".
- **Hẹn phỏng vấn:** chọn "Hẹn phỏng vấn" hiện ô ngày giờ (không bắt buộc) + nút "Nhắn Zalo mời phỏng vấn" điền sẵn
  giờ và địa chỉ Gò Vấp. Đổi trạng thái có thông báo kèm "Hoàn tác" 5 giây.
- **Ghi chú:** hiện "Đã lưu lúc HH:mm · <tên HR>", bộ đếm khi gần 2000 ký tự.
- **Form tin:** nút "Xem trước" mở đúng trang ứng viên sẽ thấy (cả điện thoại); kiểm tra từng ô khi rời ô, mọi câu báo
  tiếng Việt và đúng tên ô; bắt buộc "Yêu cầu" khi Đăng; hỏi trước khi rời trang nếu chưa lưu.
- **Đăng nhập HR:** nút hiện mật khẩu; "Quên mật khẩu? Nhờ HR khác đặt lại"; báo "còn N lần thử"; bị khoá thì ghi giờ
  mở lại.
- **CV:** BE từ chối PDF hỏng (kiểm tra cả đuôi `%%EOF`); seed/mock dùng 1 file PDF mẫu thật để "Xem CV" luôn mở được.
- Không gửi email báo hồ sơ mới: số hồ sơ mới hiện trên menu và dashboard.

**Out of scope:** thông tin liên hệ HR và thông tin pháp nhân trên trang Chính sách (chờ bạn gửi); xoá tin mẫu trên
web thật (làm lúc deploy, sau khi hỏi bạn); xoá hẳn API nhận tin việc mới ở BE (giao diện đã bỏ); gửi email.

## 3. Approach

- Migration 0005 (chạy trên Neon lúc deploy):
  - `jobs`: thêm `roadmap jsonb` (bỏ `plan_30/60/90`), `benefits text[]` (tin cũ: mỗi dòng của 5 ô cũ thành 1 quyền lợi), `closed_on`; bỏ các cột không dùng; `paused`/`filled` → `closed`;
    `contract` → `full_time`.
  - `applications`: `passed` → `interview`; thêm `interview_at`, `note_updated_at`, `note_updated_by`; bỏ `thanked_at`, `candidate_updated_at`, `keep_for_other_jobs`.
  - `candidates`: bỏ `keep_for_other_jobs`. Bỏ bảng `saved_jobs`.
- "Đến hạn xoá" = tin `closed` có `closed_on` + 30 ngày ≤ hôm nay, hoặc tin hết hạn có `deadline` + 30 ngày ≤ hôm nay.
  Tính ở BE (`GET /hr/applications/due`, `DELETE /hr/applications/due`).
- `DELETE /hr/applications/:id`. Xoá file trước, xoá dòng sau (như xoá dữ liệu ứng viên).
- Tài khoản HR: `GET/POST /hr/users`, `POST /hr/users/:id/reset-password`, `DELETE /hr/users/:id`,
  `POST /hr/me/password`. Mật khẩu tạm sinh ngẫu nhiên đủ mạnh, hash scrypt như hiện có; dấu vân tay mật khẩu trong
  cookie làm phiên cũ hết hiệu lực.
- Mock FE và dữ liệu mẫu đổi theo BE (DB_VERSION 6).

## 4. Impact Analysis

- Files thay đổi: `packages/shared` (types, validation, job-status, format; bỏ quét câu chữ + tìm kiếm),
  `apps/api` (schema, migration 0005, seed, services/routes hr-jobs, hr-applications, hr-users, candidate, apply,
  share), `apps/web` (HrJobFormPage, HrJobsPage, HrApplicantsPage, HrLayout, trang mới HrAccountsPage, JobPage,
  JobsPage, ApplyDialog, CandidateAccountPage, CandidateLoginPage, SiteHeader, router, mock, mock-seed).
- Public API thay đổi: có (bỏ trường tin, bỏ trạng thái, bỏ API lưu việc và gia hạn; thêm API xoá hồ sơ, tài khoản HR).
- Breaking change: có — migration bỏ cột trên DB thật. Dữ liệu trên web thật hiện chỉ là tin mẫu.

## 5. Test Strategy

- Unit tests: luật hạn nộp mới (≤60 ngày từ hôm nay, mở lại tin đóng), "đến hạn xoá", map trạng thái ứng viên.
- Integration tests (PGlite qua HTTP): xoá 1 hồ sơ xoá cả CV; xoá đến hạn chỉ xoá đúng tin quá 30 ngày; tài khoản HR
  thêm/đặt lại/xoá, không xoá mình, không xoá người cuối, phiên cũ bị thoát sau đặt lại; migration 0005 trên DB cũ cho
  ra đúng schema mới và giữ nội dung quyền lợi; test hợp đồng FE↔BE cho các API mới.
- Manual test steps: đăng tin mới bằng form gọn → xem trang tin; đóng tin rồi sửa hạn nộp để mở lại; nộp hồ sơ → HR
  xoá; tạo tài khoản HR mới → đăng nhập bằng mật khẩu tạm → đổi mật khẩu; điện thoại 375px và desktop.

## 6. Implementation Steps

- [x] Step 1: Tin tuyển dụng gọn (shared + migration phần jobs + BE + form HR + trang tin + mock).
- [x] Step 2: Trạng thái tin Nháp/Đang đăng/Đã đóng + Sửa hạn nộp; bỏ gia hạn, ân hạn; 1 câu cho tin đóng.
- [x] Step 3: Hồ sơ 4 trạng thái; bỏ cảm ơn/nhãn cập nhật/cờ giữ hồ sơ; HR xoá 1 hồ sơ + xoá hồ sơ đến hạn.
- [x] Step 4: Trang quản lý tài khoản HR + trang mẫu tin `/hr/mau-tin`.
- [x] Step 5: Dashboard + hồ sơ ứng viên (tìm, hẹn PV, ghi chú, hoàn tác) + đăng nhập HR + CV hỏng.
- [x] Step 6: Phía ứng viên: bỏ lưu việc, gộp đăng nhập, "Hồ sơ của tôi" 1 trang, bỏ bộ lọc, 1 nút chia sẻ, form
      nộp gọn, bỏ các khối thừa ở trang tin.

## 7. Risks

- Bỏ cột là không quay lại được: migration ghép quyền lợi trước khi bỏ cột; chạy thử trên bản sao DB local trước Neon.
- Bỏ nhãn "vừa cập nhật" mà vẫn giữ trạng thái HR khi nộp lại: HR có thể không để ý hồ sơ đã đổi CV. Hồ sơ lên đầu
  danh sách để bù lại.
- Mật khẩu tạm hiện trên màn hình: chỉ hiện 1 lần, không lưu dạng đọc được.
- Xoá tài khoản HR đang đăng nhập ở máy khác: phiên đó bị thoát ở lần gọi tiếp theo.
