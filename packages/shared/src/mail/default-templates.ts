import type { MessageTemplate, TemplateKey } from '../message-templates.js';

/** Who to ask: the contact line of HR's mail designs. */
const CONTACT = 'Ms. {Tên HR} – {SĐT HR} (Zalo)';

const INTERVIEW_THANKS = 'Cảm ơn bạn đã quan tâm và gửi hồ sơ ứng tuyển vị trí {Vị trí} tại Top Flow.';
const INTERVIEW_NOTE =
  'Buổi phỏng vấn là cơ hội để hai bên trao đổi sâu hơn về công việc, môi trường làm việc cũng như định hướng phát triển tại Top Flow.';
const INTERVIEW_CLOSING =
  'Chân thành cảm ơn bạn đã quan tâm đến vị trí công việc. Hẹn gặp lại bạn trong buổi phỏng vấn cùng Top Flow!';
const KEEP_CV = 'Nếu bạn muốn công ty giữ hồ sơ cho các vị trí sau, hãy phản hồi thư này.';

/** Wording based on HR's three designs. The layout around these texts is fixed, see render-html.ts. */
export const DEFAULT_MESSAGE_TEMPLATES: Record<TemplateKey, MessageTemplate> = {
  interview_onsite: {
    key: 'interview_onsite',
    subject: '[Top Flow] Thư mời phỏng vấn vị trí {Vị trí}',
    body: `Thân gửi bạn {Tên ứng viên},

${INTERVIEW_THANKS}

Sau khi xem xét hồ sơ, chúng tôi đánh giá cao sự phù hợp của bạn và trân trọng mời bạn tham gia buổi trao đổi trực tiếp tại văn phòng công ty.`,
    note: `${INTERVIEW_NOTE} Khi đến nơi, bạn gọi Ms. {Tên HR} – {SĐT HR} để được hướng dẫn nhé.`,
    calloutTitle: 'XÁC NHẬN THAM DỰ',
    callout: `Bạn vui lòng phản hồi email này trong vòng 24 giờ để xác nhận thời gian và địa điểm phỏng vấn, hoặc báo sớm nếu cần đổi giờ. Nếu cần hỗ trợ thêm thông tin, bạn liên hệ ${CONTACT} nhé.`,
    closing: INTERVIEW_CLOSING,
  },
  interview_online: {
    key: 'interview_online',
    subject: '[Top Flow] Thư mời phỏng vấn online vị trí {Vị trí}',
    body: `Thân gửi bạn {Tên ứng viên},

${INTERVIEW_THANKS}

Sau khi xem xét hồ sơ, chúng tôi đánh giá cao sự phù hợp của bạn và trân trọng mời bạn tham gia buổi trao đổi online qua Google Meet.`,
    note: `${INTERVIEW_NOTE} Bạn vui lòng vào trước vài phút để kiểm tra micro và camera.`,
    calloutTitle: 'XÁC NHẬN THAM DỰ',
    callout: `Bạn vui lòng phản hồi email này trong vòng 24 giờ để xác nhận thời gian phỏng vấn, hoặc báo sớm nếu cần đổi giờ. Nếu cần hỗ trợ thêm thông tin, bạn liên hệ ${CONTACT} nhé.`,
    closing: INTERVIEW_CLOSING,
  },
  rejection: {
    key: 'rejection',
    subject: '[Top Flow] Phản hồi hồ sơ ứng tuyển vị trí {Vị trí}',
    body: `Thân gửi bạn {Tên ứng viên},

Cảm ơn bạn đã dành thời gian quan tâm và gửi hồ sơ ứng tuyển vị trí {Vị trí} tại Top Flow. Chúng tôi trân trọng sự quan tâm của bạn dành cho công ty.

Sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng hồ sơ của bạn chưa thật sự phù hợp với yêu cầu của vị trí ở thời điểm hiện tại. Quyết định này dựa trên nhu cầu cụ thể của vị trí lần này và không phản ánh toàn bộ năng lực cũng như giá trị của bạn.`,
    note: '',
    calloutTitle: 'GIỮ KẾT NỐI CÙNG TOP FLOW',
    callout: KEEP_CV,
    closing: `Bạn có thể theo dõi các cơ hội nghề nghiệp mới tại topflow.vn hoặc www.lee-hr.com. Nếu có bất kỳ thắc mắc nào, bạn vui lòng liên hệ ${CONTACT} nhé.

Một lần nữa, cảm ơn bạn đã quan tâm đến Top Flow. Chúc bạn sớm tìm được công việc phù hợp và thành công trên con đường sự nghiệp!`,
  },
  rejection_interview: {
    key: 'rejection_interview',
    subject: '[Top Flow] Cảm ơn bạn đã tham gia phỏng vấn vị trí {Vị trí}',
    body: `Thân gửi bạn {Tên ứng viên},

Cảm ơn bạn đã tham gia buổi phỏng vấn vị trí {Vị trí} vào ngày {Ngày phỏng vấn}. Chúng tôi trân trọng thời gian và những chia sẻ của bạn trong buổi trao đổi.

Sau khi cân nhắc kỹ lưỡng, chúng tôi nhận thấy định hướng và kinh nghiệm của bạn chưa thật sự phù hợp với nhu cầu của vị trí ở giai đoạn hiện tại. Vì vậy, Top Flow rất tiếc chưa thể đồng hành cùng bạn lần này.`,
    note: '',
    calloutTitle: 'CƠ HỘI TRONG TƯƠNG LAI',
    callout: `${KEEP_CV} Khi có vị trí phù hợp, chúng tôi rất mong được tiếp tục kết nối và trao đổi cùng bạn.`,
    closing: `Nếu bạn muốn nhận thêm góp ý về buổi phỏng vấn hoặc có bất kỳ thắc mắc nào, đừng ngần ngại liên hệ ${CONTACT} nhé.

Chúc bạn nhiều sức khỏe, sớm tìm được cơ hội phù hợp và gặt hái nhiều thành công trên con đường sự nghiệp!`,
  },
  call: {
    key: 'call',
    subject: '[Top Flow] Thư hẹn trao đổi qua điện thoại vị trí {Vị trí}',
    body: `Thân gửi bạn {Tên ứng viên},

Cảm ơn bạn đã quan tâm và gửi hồ sơ ứng tuyển vị trí {Vị trí} tại Top Flow.

Chúng tôi vui mừng thông báo hồ sơ của bạn đã vượt qua vòng sàng lọc. Để hiểu thêm về bạn trước khi sắp xếp buổi phỏng vấn, bộ phận Nhân sự mong được trao đổi ngắn với bạn qua điện thoại.`,
    note: '',
    calloutTitle: 'PHẢN HỒI THỜI GIAN THUẬN TIỆN',
    callout: `Bạn vui lòng phản hồi email này trong vòng 24 giờ với các khung giờ bạn có thể nghe máy, HR sẽ chủ động liên hệ theo thời gian bạn chọn.

Bạn cũng có thể nhắn Zalo cho Ms. {Tên HR} – {SĐT HR} nếu thuận tiện hơn.`,
    closing: 'Đây là buổi trao đổi thân thiện, bạn không cần chuẩn bị gì nhiều. Rất mong được trò chuyện cùng bạn!',
  },
  // To an employee, from Lương › Phiếu lương. No amount in the text: the numbers are in the payslip itself.
  payslip: {
    key: 'payslip',
    subject: '[Top Flow] Phiếu lương tháng {Tháng} - {Họ tên}',
    body: `Thân gửi anh/chị {Họ tên},

Phòng Nhân sự gửi anh/chị phiếu lương tháng {Tháng} (file đính kèm). Ngày chi trả: {Ngày trả}.`,
    note: '',
    calloutTitle: 'LƯU Ý',
    callout:
      'Phiếu lương là thông tin riêng của anh/chị, vui lòng không chuyển tiếp cho người khác. Nếu có thắc mắc, anh/chị phản hồi thư này trong vòng 3 ngày làm việc kể từ ngày nhận để phòng Nhân sự kiểm tra.',
    closing: 'Cảm ơn anh/chị đã đồng hành cùng Top Flow.',
  },
};
