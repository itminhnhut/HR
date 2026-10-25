# Gửi email và tạo lịch phỏng vấn (Google Calendar + Meet) từ HR admin

Ngày: 2026-10-25 · Loại: tech (nghiên cứu, chưa làm) · Trạng thái: chờ chủ sản phẩm trả lời mục 6

## Tóm tắt

- **Email:** dùng **Resend**, gửi từ subdomain `mail.lee-hr.com`, đặt `Reply-To` là hộp thư HR. Gói miễn phí đủ dùng.
- **Lịch + Meet:** bước đầu **chưa gọi API**. Gửi kèm file `.ics` trong email mời và có nút "Thêm vào Google Calendar". Khi HR cần link Meet thì HR tự bấm "Thêm Google Meet". Chỉ làm API (OAuth "Kết nối Google Calendar") khi HR thật sự thấy khâu tay vướng.
- Hiện lời mời đang ghi "tại `SITE.officeAddress`", tức là phỏng vấn trực tiếp. Meet chỉ cần cho buổi online, nên phải hỏi lại xem Meet có thật cần không (câu hỏi 1).

## 1. Gửi email từ Vercel function

|                     | Resend                                                                     | Postmark                      | Amazon SES                                                                    | Brevo                               | Gmail API                                                                  | SMTP hộp thư công ty                                          |
| ------------------- | -------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Miễn phí            | 3.000/tháng, **100/ngày**                                                  | 100/tháng                     | Không có gói email miễn phí cố định. Tài khoản mới có credit (tối đa 200 USD) | 300/ngày, có chèn "Sent with Brevo" | Miễn phí                                                                   | Miễn phí (theo gói mail)                                      |
| Trả phí             | Pro 20 USD/tháng, 50k email                                                | Basic 15 USD/tháng, 10k email | Khoảng 0,10 USD/1.000 email (à la carte)                                      | Chưa kiểm tra                       | —                                                                          | —                                                             |
| 100–500 email/tháng | Miễn phí                                                                   | Phải trả phí                  | Vài cent                                                                      | Miễn phí                            | Miễn phí                                                                   | Miễn phí                                                      |
| DNS phải thêm       | MX + TXT SPF trên `send.<sub>`, TXT DKIM `resend._domainkey`, nên có DMARC | SPF/DKIM tương tự             | SPF/DKIM (Easy DKIM)                                                          | SPF/DKIM                            | Dùng SPF/DKIM sẵn có của Google                                            | Dùng SPF/DKIM của nhà mail                                    |
| Node                | SDK `resend`, gọi HTTP, hợp serverless                                     | SDK `postmark`                | `@aws-sdk/client-sesv2`                                                       | SDK `@getbrevo/brevo`               | `googleapis` + OAuth                                                       | `nodemailer`, mở kết nối TCP mỗi lần chạy, kém hợp serverless |
| Rủi ro              | Ít                                                                         | Ít                            | Phải xin ra khỏi sandbox, khâu IAM rườm rà                                    | Có quảng cáo trong mail             | `gmail.send` là **scope nhạy cảm**, phải OAuth và có thể phải xác minh app | Phải lưu mật khẩu (app password), dễ bị khoá                  |

- **Tỷ lệ vào hộp thư (Gmail và mail Việt Nam):** với lượng email nhỏ, yếu tố quyết định là SPF và DKIM pass, DMARC aligned (`p=none` là đủ), cộng nội dung không giống spam. Gmail chỉ siết thêm (unsubscribe một chạm…) với bên gửi trên 5.000 email/ngày, mình không thuộc diện này. Mình không tìm được số liệu riêng cho mail Việt Nam, nên hãy test thật vài địa chỉ Gmail/Yahoo/Outlook trước khi chạy.
- **Ứng viên trả lời mail:** đặt `From: TOP FLOW Tuyển dụng <tuyendung@mail.lee-hr.com>` và `Reply-To: <hộp thư HR thật>`. Khi ứng viên bấm Trả lời, thư về thẳng hộp HR, nên subdomain gửi không cần hộp nhận.
- **Giới hạn tốc độ:** Resend giới hạn theo team (số cụ thể xem trong dashboard). Mình gửi từng mail một nên không chạm tới.
- **Khuyến nghị: Resend.** Gói miễn phí đủ, setup khoảng 15 phút DNS, SDK gọn, không dính OAuth Google. Postmark là phương án dự phòng nếu cần deliverability tốt hơn nữa (15 USD/tháng).

## 2. Tạo sự kiện Google Calendar có link Meet từ server

Cách gọi: `events.insert(calendarId='primary', conferenceDataVersion=1, sendUpdates='all')` với body có `conferenceData.createRequest = { requestId: <uuid>, conferenceSolutionKey: { type: 'hangoutsMeet' } }` và `attendees` gồm ứng viên và HR. Meet được tạo bất đồng bộ (`status: pending` rồi chuyển sang `success`), link nằm ở `hangoutLink` hoặc `conferenceData.entryPoints`.

| Cách                                                                      | Tạo được Meet?                                                                 | Sự kiện nằm ở lịch của ai                       | Điều kiện                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) Service account + domain-wide delegation                              | Có, khi **giả danh** một user Workspace                                        | User bị giả danh (ví dụ `tuyendung@lee-hr.com`) | **Bắt buộc có Google Workspace trên lee-hr.com.** Nếu không giả danh ai, service account báo lỗi "Invalid conference type value" và không mời được khách. Công ty chỉ dùng Gmail miễn phí thì **cách này không làm được**. |
| (b) OAuth "Kết nối Google Calendar" (mỗi HR làm 1 lần, lưu refresh token) | Có, kể cả Gmail cá nhân                                                        | Lịch của HR đã kết nối. HR là organizer.        | Scope `calendar.events` là scope **nhạy cảm**. Xem chi tiết bên dưới.                                                                                                                                                      |
| (c) Không dùng API: link "Thêm vào Google Calendar" hoặc file `.ics`      | Link/ics **không tự tạo Meet được**. HR mở link rồi tự bấm "Thêm Google Meet". | Lịch của HR (khi HR lưu)                        | Không cần gì thêm                                                                                                                                                                                                          |

Chi tiết cách (b):

- **Scope:** `openid email` và `https://www.googleapis.com/auth/calendar.events`. Có thể thử `calendar.events.owned` cho hẹp hơn. Mình chưa xác nhận được scope nào trong hai cái này không bị xếp loại nhạy cảm.
- **Xác minh app:** Google không bắt xác minh khi app (1) **Internal**, tức chỉ user trong tổ chức Workspace dùng, hoặc (2) dùng cá nhân/đang thử nghiệm, dưới 100 user. Trường hợp (2) sẽ hiện màn hình "app chưa được xác minh", HR bấm "Tiếp tục" là qua.
- **Bẫy:** app ở trạng thái **Testing** với loại user External thì refresh token **hết hạn sau 7 ngày**, nghĩa là HR phải kết nối lại mỗi tuần. Cách tránh: chuyển sang **In production**. Chưa xác minh thì vẫn hiện cảnh báo, nhưng token không còn hết hạn sau 7 ngày. Nếu có Workspace thì chọn Internal là gọn nhất.
- Token còn bị thu hồi khi không dùng 6 tháng hoặc khi user đổi mật khẩu/thu hồi quyền. Code phải bắt lỗi `invalid_grant` rồi hiện nút "Kết nối lại".
- **Quota:** 600 request/phút/user, 10.000 request/phút/project, miễn phí. Mình dùng vài request mỗi tuần nên không đáng lo. Google còn có giới hạn số lời mời/ngày ("Avoid Calendar use limits"), nhưng ở mức của mình thì không chạm tới.
- **Meet với Gmail miễn phí:** gọi 1-1 thì thoải mái. Họp từ 3 người trở lên bị giới hạn 60 phút. Đây là chính sách Meet chung, cần kiểm tra lại nếu buổi phỏng vấn có 2 HR.

## 3. Dùng email mời của Google Calendar thay cho email của mình?

- **Ưu:** bớt một hệ thống. Ứng viên bấm Có/Không ngay trong mail, lịch tự vào Calendar của họ, đổi giờ thì Google tự gửi cập nhật.
- **Nhược:** nội dung mail do Google định dạng (tiêu đề "Lời mời: …"), mình chỉ chỉnh được phần mô tả. Thư gửi từ tài khoản Google của HR. Thư dễ bị coi là spam hoặc bị bỏ qua khi người nhận không quen. Mail từ chối/cảm ơn vẫn phải gửi bằng hệ thống khác. Và chỉ dùng được khi đã làm cách (a) hoặc (b).
- **Kết luận:** khi đã có (b), mail mời phỏng vấn có thể để Google gửi. Nhưng vẫn cần Resend cho mail từ chối/cảm ơn và cho ứng viên phỏng vấn trực tiếp. Vì vậy **Resend làm trước**.

## 4. Dữ liệu và quyền riêng tư

- Email ứng viên hiện không bắt buộc (`applications.email` nullable), và nhiều người chỉ để lại số điện thoại. Ứng viên **không có email thì vẫn chỉ dùng Zalo**. UI phải ẩn hoặc khoá nút "Gửi email" và hiện lý do. Không đổi email thành bắt buộc khi nộp hồ sơ, vì sẽ làm giảm số người nộp.
- Cập nhật `PrivacyPage`: ghi rõ email được dùng để gửi thư mời/kết quả tuyển dụng; dữ liệu đi qua bên xử lý thứ ba (Resend, server tại Mỹ, và Google nếu có tạo lịch); thời gian lưu giữ giống hồ sơ. Theo Nghị định 13/2023 thì phải nêu rõ mục đích và bên nhận dữ liệu. Nội dung cụ thể nên nhờ người nắm pháp lý duyệt.
- Lưu log email đã gửi (ai gửi, lúc nào, mẫu nào, trạng thái), đừng lưu cả nội dung dài. Log phải bị xoá cùng hồ sơ khi đến hạn (đã có `DueForDeletionBanner`).
- **Refresh token (chỉ khi làm (b)):** mã hoá AES-256-GCM trước khi ghi DB, key 32 byte để trong env Vercel (`TOKEN_ENC_KEY`), không bao giờ trả token về frontend, chỉ xin scope tối thiểu. Có nút "Ngắt kết nối" gọi revoke. Đổi key thì HR kết nối lại.

## 5. Kế hoạch theo giai đoạn

**Giai đoạn 1: Gửi email qua Resend (khoảng 1–1,5 ngày)**. Đây là bước nhỏ nhất mà đã có ích.

- Chủ sản phẩm lo: quyền sửa DNS `lee-hr.com`, chọn hộp thư nhận reply, tạo tài khoản Resend.
- DB: bảng `email_log` (id, application_id, kind `'interview_invite' | 'rejection' | 'custom'`, to, subject, sent_by_hr_id, provider_id, status, error, created_at).
- API: `POST /hr/applications/:id/emails` (body: kind, subject, body đã sửa, validate bằng Zod). Gọi Resend, ghi log, có rate limit theo HR. `GET` lịch sử email của hồ sơ.
- Env: `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`.
- UI `ApplicantDetail`: nút "Soạn email" cạnh "Nhắn Zalo", dùng lại mẫu mời/từ chối giống mẫu Zalo, HR sửa được nội dung trước khi gửi, hiện lịch sử đã gửi. Hồ sơ không có email thì nút bị khoá.
- Test: mock Resend (dịch vụ bên ngoài), test service và route.

**Giai đoạn 2: Lịch không qua API (khoảng 0,5 ngày)**

- Mail mời đính kèm `.ics` (thời gian lấy từ `interview_at`, mặc định 60 phút, có địa điểm), cộng link `calendar.google.com/calendar/render?action=TEMPLATE&...` để HR tự lưu vào lịch của mình. Nếu cần Meet thì HR bấm "Thêm Google Meet" rồi dán link vào ô mới `meeting_url` trước khi gửi mail.
- DB: thêm cột `applications.meeting_url` (nullable) và `interview_mode` (`'onsite' | 'online'`).

**Giai đoạn 3 (chỉ khi cần): Tự động tạo Meet (khoảng 2–3 ngày, cộng thời gian setup Google Cloud)**

- Có Workspace: chọn (b) với app Internal, hoặc (a) với service account giả danh `tuyendung@`. Không có Workspace: chọn (b) ở trạng thái In production, chưa xác minh, HR chấp nhận màn hình cảnh báo.
- DB: bảng `hr_google_connections` (hr_user_id, google_email, refresh_token_enc, scope, connected_at). Thêm cột `applications.calendar_event_id`.
- API: `GET /hr/google/connect` và callback OAuth (có `state` chống CSRF). `POST /hr/applications/:id/interview-event` để tạo hoặc cập nhật (patch khi đổi giờ). Khi huỷ hoặc từ chối thì xoá sự kiện với `sendUpdates=all`.
- UI: trang cài đặt HR có "Kết nối Google Calendar". Trong hồ sơ có nút "Tạo lịch + Meet", hiện link Meet.

## 6. Câu hỏi chủ sản phẩm cần trả lời trước khi làm

1. **Phỏng vấn có hình thức online (Meet) không, hay chủ yếu trực tiếp tại văn phòng?** Mặc định: chủ yếu trực tiếp. Meet tự động để giai đoạn 3, có thể không bao giờ làm.
2. **TOP FLOW có Google Workspace trên `lee-hr.com` không, hay HR dùng Gmail cá nhân?** Mặc định: giả định là không, nên không chọn service account.
3. **Ai quản lý DNS của `lee-hr.com` (nhà cung cấp nào) và có cho thêm bản ghi không?** Mặc định: thêm 3–4 bản ghi cho subdomain `mail.lee-hr.com`, không đụng mail gốc.
4. **Ứng viên trả lời thì về hộp thư nào, và tên người gửi hiển thị là gì?** Mặc định: `From: TOP FLOW Tuyển dụng <tuyendung@mail.lee-hr.com>`, `Reply-To` là email của HR đang gửi.
5. **Có chấp nhận dữ liệu ứng viên đi qua Resend (server tại Mỹ) và sửa chính sách quyền riêng tư không?** Mặc định: có, sửa `PrivacyPage` trước khi bật tính năng.

## Nguồn

- Resend pricing: https://resend.com/pricing · Domain/subdomain: https://resend.com/docs/dashboard/domains/introduction · DNS mẫu: https://resend.com/docs/guides/dns/cloudflare.md
- Postmark pricing: https://postmarkapp.com/pricing · SES pricing: https://aws.amazon.com/ses/pricing/ · Brevo free plan: https://help.brevo.com/hc/en-us/articles/208580669
- Gmail sender guidelines (tổng hợp): https://www.mailreach.co/blog/gmail-sender-guidelines · Giới hạn gửi Workspace: https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace
- Gmail scopes (gmail.send là sensitive): https://developers.google.com/workspace/gmail/api/auth/scopes
- Calendar create events + conferenceData: https://developers.google.com/workspace/calendar/api/guides/create-events · Scopes: https://developers.google.com/workspace/calendar/api/auth · Quota: https://developers.google.com/workspace/calendar/api/guides/quota
- Service account không giả danh thì lỗi Meet: https://github.com/golang/oauth2/issues/624 · https://discuss.google.dev/t/create-google-meet-link-using-service-account-in-asp-net-backend/136173
- OAuth refresh token (Testing 7 ngày, 6 tháng không dùng, tối đa 100 token): https://developers.google.com/identity/protocols/oauth2
- Khi nào không cần xác minh app: https://support.google.com/cloud/answer/13464323 · Scope nhạy cảm: https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification

Chưa kiểm chứng: giá trả phí của Brevo, rate limit cụ thể của Resend, `calendar.events.owned` có thuộc loại nhạy cảm không, giới hạn 60 phút của Meet bản miễn phí (theo chính sách chung, chưa đối chiếu tài liệu 2026).
