# Rà quy trình tuyển dụng sau tính năng Mẫu thư + lịch (25/10/2026)

Đánh giá theo code nhánh `feat/email-templates` và `spec-email.md`, chưa bấm thử app. Không nhắc lại các mục đã có
trong `docs/ba/` (báo hồ sơ mới, dashboard, CV mẫu hỏng…).

## 1. Quy trình hiện tại

| Bước             | Hệ thống hỗ trợ?                                                  | Vấn đề                                                                                                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đăng tin         | Có                                                                | Ổn.                                                                                                                                                                                                                                                                              |
| Nhận hồ sơ       | Có                                                                | Ổn.                                                                                                                                                                                                                                                                              |
| Sàng lọc         | Có (Mới/Đã xem, tìm, ghi chú)                                     | HR chỉ cần mở hồ sơ là ứng viên tra cứu thấy ngay "HR đã xem", kể cả khi mở nhầm.                                                                                                                                                                                                |
| Mời PV trực tiếp | Có (giờ, mẫu thư, Gmail/Zalo, lịch Google)                        | Ứng viên chỉ có Zalo: không có lời mời lịch, không ai nhắc. Nút vẫn ghi "Tạo lịch Google (mời ứng viên)" dù không mời được ai. "Nhắn Zalo" ở đầu hồ sơ còn "Sao chép" nằm trong hộp Soạn thư, phải qua lại 2 chỗ.                                                                |
| Mời PV online    | Một phần                                                          | HR qua Google để thêm Meet rồi dán link về (4 bước). Chấp nhận được vì yêu cầu miễn phí.                                                                                                                                                                                         |
| Nhắc lịch        | Không                                                             | Chỉ Google nhắc, và chỉ khi ứng viên dùng Google Calendar.                                                                                                                                                                                                                       |
| Đổi giờ / huỷ    | Không                                                             | Đổi giờ trên web thì sự kiện Google vẫn giữ giờ cũ. Bấm "Tạo lịch" lần nữa thì ứng viên nhận thêm lời mời thứ 2, lời mời cũ không bị huỷ. Chưa có mẫu thư đổi giờ/huỷ. Chuyển sang "Chưa phù hợp" thì web xoá luôn giờ hẹn và link Meet mà không báo gì, sự kiện Google vẫn còn. |
| Nhiều người PV   | Không                                                             | HR tự thêm khách trong Google. Mô tả sự kiện có SĐT và email ứng viên, mọi khách mời đều thấy. Meet miễn phí họp từ 3 người trở lên bị giới hạn 60 phút (chưa kiểm chứng).                                                                                                       |
| Kết quả          | Một nửa                                                           | Web chỉ có "Chưa phù hợp". "Đạt" xử lý ngoài web, nên người đậu nằm mãi ở "Hẹn PV". Mục "Đang hẹn phỏng vấn" ở dashboard lẫn cả người đã phỏng vấn xong và người đã nhận việc.                                                                                                   |
| Báo ứng viên     | Một phần                                                          | Có mẫu từ chối, nhưng phải gửi từng người (20–50 người mỗi tin) và không biết ai chưa được báo. Tra cứu SĐT: từ chối hiện "Đã đóng"; người đậu thấy "Mời phỏng vấn" cho tới khi hồ sơ bị xoá. Lúc "Mời phỏng vấn" cũng không thấy giờ hẹn.                                       |
| Xoá dữ liệu      | Có trên web (xoá đến hạn, xoá lẻ, lịch sử liên hệ xoá theo hồ sơ) | Bản sao trong Gmail đã gửi, Google Calendar và Zalo của HR thì không bị xoá. Người được tuyển cũng bị xoá cùng đợt, trái với câu "Không được tuyển: xóa sau 30 ngày" trong chính sách.                                                                                           |

## 2. Thiếu – phải có

1. **Đổi giờ / huỷ lịch.** Thêm 2 mẫu "Đổi lịch phỏng vấn" và "Huỷ lịch phỏng vấn". Ghi lại lần bấm "Tạo lịch Google"
   vào lịch sử liên hệ. Sau đó nếu HR đổi giờ hoặc chuyển hồ sơ khỏi "Hẹn PV" thì hiện nhắc: _"Mở sự kiện cũ trong Google
   Calendar để sửa hoặc xoá, Google sẽ báo ứng viên. Đừng tạo sự kiện mới."_
2. **Lỗi Hoàn tác:** chuyển "Hẹn PV" → "Chưa phù hợp" rồi bấm Hoàn tác thì mất hình thức Online và link Meet.
   `ApplicantDetail.tsx:138` chỉ lưu lại `status` và `interviewAt`, còn BE thì xoá `interviewMode` và `meetingUrl`
   (`hr-applications.ts:146`).
3. **Sau buổi phỏng vấn (không cần thêm trạng thái).** Khi giờ hẹn đã qua: dashboard tách thành "Sắp phỏng vấn" và
   "Đã phỏng vấn, chờ kết quả: N"; trang tra cứu hiện "Đã phỏng vấn, chờ kết quả" thay cho "Mời phỏng vấn".
4. **Ứng viên chỉ có Zalo.** Trong hộp Soạn thư, khi không có email thì nút chính là "Sao chép và mở Zalo". Nút lịch
   đổi chữ thành "Lưu vào lịch của tôi (ứng viên không có email)".
5. **Dữ liệu cá nhân.** Chính sách cần ghi thêm: HR liên hệ qua Gmail, Google Calendar/Meet và Zalo, dữ liệu có thể
   lưu trên máy chủ ở nước ngoài, và người được tuyển thì lưu bao lâu. Bỏ SĐT và email khỏi mô tả sự kiện (ứng viên đã là
   khách mời). Nút "Xoá hồ sơ" nhắc HR xoá cả sự kiện lịch và đoạn chat của người đó. Lưu ý: từ 01/01/2026 Luật Bảo
   vệ dữ liệu cá nhân 2025 đã thay Nghị định 13/2023, cần người nắm pháp lý duyệt câu chữ theo đúng văn bản đang áp dụng.

## 3. Nên có

1. **Báo kết quả không sót người:** lọc "Chưa phù hợp, chưa soạn thư" dựa vào lịch sử liên hệ. Không cần gửi hàng loạt.
2. **Nhắc lịch:** dashboard tô đậm những buổi phỏng vấn ngày mai, kèm nút "Soạn nhắc lịch" (dùng lại mẫu mời). Quan
   trọng nhất với người chỉ có Zalo.
3. **Tên gọi dễ hiểu:** "Mẫu tin" và "Mẫu thư" nằm sát nhau trên menu, dễ nhầm. Đổi thành "Nội dung chung của tin" và
   "Mẫu thư gửi ứng viên". Câu "Đã soạn thư" thêm chú thích: _web không biết thư đã thực sự được gửi hay chưa_.
4. **Mẫu mời trực tiếp mặc định** thêm: mang theo gì, gặp ai ở lễ tân, link Google Maps của văn phòng Gò Vấp.
5. **Nhiều người phỏng vấn:** 1 dòng hướng dẫn cạnh nút lịch: "Muốn mời thêm người phỏng vấn thì thêm khách trong
   Google trước khi Lưu". Không làm ô nhập người phỏng vấn.
6. **Ghi lại ứng viên báo không đến hoặc xin đổi giờ:** chỉ cần mẫu ghi chú sẵn ("Ứng viên xin đổi sang…"). Không thêm
   trạng thái mới.

## 4. Thừa / nên bỏ

1. Nút "Mở ứng dụng mail" trên máy tính: HR dùng Gmail, có 3 nút thì dễ phân vân. Chỉ hiện nút này trên điện thoại.
2. Ghi kênh gửi trong lịch sử ("(mở gmail)", "(sao chép)"): chỉ cần "Đã soạn thư X · giờ · người soạn".
3. Hai mẫu mời phỏng vấn (trực tiếp và online) tách riêng: gộp thành 1 mẫu, ô _Địa điểm_ tự điền địa chỉ hoặc link
   Meet theo hình thức đã chọn. HR chỉ phải sửa 1 mẫu.
4. Dòng "Thêm vào lịch của bạn: <link>" trong spec (code chưa làm): không cần làm, lời mời của Google đã lo việc này.
   ADR `2026-10-25-tech-email-va-lich-phong-van.md` vẫn khuyến nghị Resend và `.ics`: ghi rõ ADR này đã được thay
   bằng `spec-email.md`, tránh người sau đọc nhầm.

## 5. Câu hỏi cho chủ sản phẩm

1. **Có cần trạng thái "Đã tuyển" không?** Mặc định: không. Dùng "Đã phỏng vấn, chờ kết quả" (tự suy ra từ giờ hẹn,
   mục 2.3) cộng với ghi chú. Người được tuyển bị xoá cùng đợt 30 ngày, vì hồ sơ nhân sự đã lưu ở nơi khác. Sửa câu chính
   sách thành "Xoá 30 ngày sau khi vị trí đóng".
2. **Trang tra cứu SĐT có hiện giờ và hình thức phỏng vấn không?** Mặc định: có hiện ngày giờ và chữ "Trực tiếp tại
   văn phòng" hoặc "Online, link đã gửi qua email/Zalo". Không hiện link Meet. Rủi ro chấp nhận được vì đã giới hạn số
   lần tra cứu.
3. **HR gửi thư bằng Gmail cá nhân hay một Gmail chung của bộ phận tuyển dụng?** Mặc định: một Gmail chung cho mọi HR.
   Thư trả lời và lịch hẹn nằm cùng một chỗ, HR nghỉ việc cũng không mất lịch sử. Xoá dữ liệu cũng chỉ phải làm ở một nơi.
4. **Ai duyệt câu chữ chính sách theo Luật Bảo vệ dữ liệu cá nhân 2025?** Mặc định: mình soạn bản nháp theo mục 2.5,
   chủ sản phẩm đọc và chốt, chưa thuê luật sư. Phải xong trước khi bật Mẫu thư trên web thật.
