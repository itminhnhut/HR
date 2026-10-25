# Spec: Chấm CV theo yêu cầu của tin (miễn phí, không dùng AI trả phí)

Chủ sản phẩm 25/10: mỗi hồ sơ có nút quét CV, so với "Yêu cầu" của tin: hiện yêu cầu thoả, không thoả, tính %;
script phải rất chắc, test kỹ.

## 1. Problem

HR mở từng CV, đọc rồi tự dò từng dòng "Yêu cầu" của tin. Với vài chục hồ sơ một tin thì mất thời gian và dễ sót.

## 2. Requirements

**Must have:**

- Nút **"Chấm CV"** ở chi tiết hồ sơ (và chấm tự động khi mở hồ sơ có file CV, lưu kết quả). Kết quả:
  - **% phù hợp** = số yêu cầu thoả / số yêu cầu chấm được. Hiện cạnh tên ở danh sách hồ sơ để sắp xếp, lọc.
  - **Thoả** (xanh): từng dòng yêu cầu + **trích đoạn CV làm bằng chứng** (vd "3 năm kinh nghiệm bán hàng tại …").
  - **Không thoả** (đỏ): từng dòng + lý do (vd "CV ghi 1 năm, yêu cầu từ 2 năm"; "không thấy Excel trong CV").
  - **Không chấm được từ CV** (xám): yêu cầu kiểu tính cách ("chủ động", "chịu áp lực"), HR tự đánh giá khi phỏng
    vấn. Không tính vào %. Không đoán bừa.
- Loại yêu cầu được hiểu:
  - **Kinh nghiệm theo năm**: "từ 2 năm", "tối thiểu 1 năm", "2+ năm"; đọc trong CV cả dạng khoảng thời gian
    ("03/2021 – nay", "2019 - 2022"), cộng dồn, không đếm trùng đoạn chồng nhau.
  - **Học vấn**: THPT < Trung cấp < Cao đẳng < Đại học < Thạc sĩ; "trở lên"; nhận cả tiếng Anh (Bachelor, College…).
  - **Kỹ năng / công cụ / ngôn ngữ**: Excel, Word, CRM, React, tiếng Anh (TOEIC/IELTS điểm số)… so khớp không dấu,
    không phân biệt hoa thường, có từ đồng nghĩa (vd "MS Excel", "Google Sheets" ~ "bảng tính").
  - **Bằng cấp / chứng chỉ, giấy phép** (bằng lái B2…), **phương tiện / thiết bị** ("có laptop", "có xe máy").
- Chấm cả kinh nghiệm/học vấn chọn ở form tin (ô Kinh nghiệm, Học vấn), không chỉ ô Yêu cầu.
- CV phải là **file PDF có chữ**. CV dạng ảnh scan hoặc link Drive: báo "Không đọc được chữ trong CV (ảnh scan
  hoặc link), HR xem trực tiếp", không ra %.
- Chạy hoàn toàn trên server của mình, **không gửi CV ra ngoài**, không tốn tiền.
- HR thấy rõ đây là **gợi ý tự động**, không phải kết luận; không tự đổi trạng thái hồ sơ.

**Out of scope:** OCR ảnh scan, đọc file Word, dùng AI (Claude/GPT) để hiểu ngữ nghĩa — làm sau nếu chủ sản phẩm
chấp nhận trả phí.

## 3. Approach

- Đọc chữ PDF bằng thư viện miễn phí `unpdf` (pdf.js, chạy được trên Vercel). Chuẩn hoá: bỏ dấu, gộp khoảng trắng,
  sửa ký tự ligature.
- Bộ chấm thuần (`packages/shared/src/cv-match/`), không phụ thuộc DB: `parseRequirement(line)` → loại + tham số;
  `extractFacts(cvText)` → năm kinh nghiệm, học vấn cao nhất, từ khoá; `scoreCv(requirements, facts)` → từng dòng
  thoả / không thoả / không chấm được + bằng chứng.
- Kết quả lưu ở bảng `cv_scores` (application_id, percent, items jsonb, cv_hash, version) — chấm lại khi CV hoặc yêu
  cầu đổi.
- `POST /api/hr/applications/:id/score` chấm; danh sách hồ sơ trả kèm `percent`.

## 4. Test Strategy (độ chính xác là ưu tiên)

- **Bộ CV mẫu tiếng Việt** (≥ 30 CV giả lập đủ kiểu: có dấu/không dấu, song ngữ, nhiều cột, bảng, ngày tháng nhiều
  định dạng, ảnh scan) cùng **đáp án do người chấm** cho từng dòng yêu cầu. Test chạy toàn bộ và đòi:
  - Không có "thoả" sai (precision ≥ 95%) — thà xếp "không chấm được" còn hơn báo thoả bừa.
  - Recall các yêu cầu đo được ≥ 85%.
- Unit test từng bộ phân tích: số năm (khoảng chồng nhau, "nay", tháng/năm), học vấn, kỹ năng, phủ định ("chưa có
  kinh nghiệm"), từ đồng nghĩa.
- Test BE: PDF có chữ, PDF ảnh, link Drive, CV đổi thì chấm lại, quyền HR.

## 5. Implementation Steps

- [x] Step 1: Bộ chấm thuần + bộ CV mẫu có đáp án + test độ chính xác (agent viết bộ dữ liệu, agent khác viết bộ chấm).
- [x] Step 2: Đọc PDF trên server, bảng `cv_scores`, API chấm + % trong danh sách.
- [x] Step 3: Giao diện: nút Chấm CV, 3 nhóm kết quả có bằng chứng, % ở danh sách, sắp xếp theo %.

## 7. Risks

- Không có AI nên chỉ hiểu yêu cầu có thể đo được; yêu cầu viết mơ hồ sẽ vào nhóm "không chấm được". Mẫu tin nên
  viết yêu cầu cụ thể (vd "Thành thạo Excel" thay vì "tin học tốt").
- CV thiết kế nhiều cột có thể bị đọc lẫn thứ tự → test riêng.
