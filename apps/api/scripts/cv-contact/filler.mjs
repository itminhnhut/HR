// Filler content for the synthetic CV corpus: roles, fictional companies, schools, addresses.
// Everything here is invented; companies use made-up names and `.example` / free-mail addresses.

/** Small deterministic PRNG (mulberry32) seeded from a string, so a case renders the same every run. */
export function rng(seedText) {
  let h = 2166136261;
  for (const ch of seedText) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

export function pickN(r, arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

export const ROLES = {
  sales: {
    vi: {
      title: 'Nhân viên kinh doanh',
      positions: [
        'Nhân viên kinh doanh',
        'Tư vấn bán hàng',
        'Trưởng nhóm bán hàng',
        'Chuyên viên phát triển thị trường',
      ],
      bullets: [
        'Tìm kiếm và chăm sóc hơn 120 khách hàng doanh nghiệp khu vực phía Nam',
        'Đạt 115% chỉ tiêu doanh số năm 2023, doanh thu 4,2 tỷ đồng',
        'Quản lý thông tin khách hàng trên HubSpot CRM, báo cáo tuần cho trưởng phòng',
        'Đàm phán hợp đồng, theo dõi công nợ và giao hàng đúng hạn',
        'Tổ chức 6 buổi giới thiệu sản phẩm tại hội chợ thương mại',
        'Đào tạo 4 nhân viên mới về quy trình bán hàng và sản phẩm',
      ],
      skills: ['Đàm phán', 'Chăm sóc khách hàng', 'HubSpot CRM', 'Excel', 'Thuyết trình', 'Lập kế hoạch bán hàng'],
      majors: ['Quản trị kinh doanh', 'Marketing', 'Kinh doanh thương mại'],
    },
    en: {
      title: 'Sales Executive',
      positions: ['Sales Executive', 'Sales Consultant', 'Sales Team Leader', 'Business Development Executive'],
      bullets: [
        'Managed a portfolio of 120+ B2B clients in the southern region',
        'Achieved 115% of the 2023 sales target (VND 4.2 billion revenue)',
        'Kept the pipeline up to date in HubSpot CRM and reported weekly to the sales manager',
        'Negotiated contracts and followed up on receivables and deliveries',
        'Ran 6 product demos at trade fairs',
        'Coached 4 new hires on the sales process and product range',
      ],
      skills: ['Negotiation', 'Customer care', 'HubSpot CRM', 'Excel', 'Presentation', 'Sales planning'],
      majors: ['Business Administration', 'Marketing', 'International Business'],
    },
  },
  accounting: {
    vi: {
      title: 'Kế toán tổng hợp',
      positions: ['Kế toán tổng hợp', 'Kế toán thuế', 'Kế toán công nợ', 'Kế toán viên'],
      bullets: [
        'Lập báo cáo tài chính quý, năm và quyết toán thuế TNDN',
        'Hạch toán chứng từ trên phần mềm MISA, đối chiếu công nợ hàng tháng',
        'Kê khai thuế GTGT, TNCN đúng hạn, không bị phạt trong 3 năm',
        'Theo dõi tài sản cố định, tính khấu hao và phân bổ chi phí',
        'Làm việc với kiểm toán độc lập, giải trình số liệu',
        'Xây dựng mẫu báo cáo quản trị trên Excel cho ban giám đốc',
      ],
      skills: ['MISA', 'Excel nâng cao', 'Luật thuế', 'Báo cáo tài chính', 'Fast Accounting', 'Cẩn thận, trung thực'],
      majors: ['Kế toán', 'Tài chính – Ngân hàng', 'Kiểm toán'],
    },
    en: {
      title: 'General Accountant',
      positions: ['General Accountant', 'Tax Accountant', 'AR/AP Accountant', 'Junior Accountant'],
      bullets: [
        'Prepared quarterly and annual financial statements and CIT finalisation',
        'Booked vouchers in MISA and reconciled receivables every month',
        'Filed VAT and PIT returns on time with no penalties for 3 years',
        'Tracked fixed assets, depreciation and cost allocation',
        'Worked with external auditors and explained figures',
        'Built Excel management reports for the board',
      ],
      skills: ['MISA', 'Advanced Excel', 'Tax law', 'Financial reporting', 'SAP B1', 'Attention to detail'],
      majors: ['Accounting', 'Finance and Banking', 'Auditing'],
    },
  },
  it: {
    vi: {
      title: 'Lập trình viên Backend',
      positions: ['Lập trình viên Backend', 'Kỹ sư phần mềm', 'Lập trình viên Fullstack', 'Thực tập sinh lập trình'],
      bullets: [
        'Phát triển REST API bằng Node.js/TypeScript phục vụ 200.000 người dùng',
        'Thiết kế cơ sở dữ liệu PostgreSQL, tối ưu truy vấn giảm 40% thời gian phản hồi',
        'Viết unit test và integration test, độ phủ 85%',
        'Triển khai CI/CD với GitHub Actions và Docker',
        'Review code và hướng dẫn 2 bạn thực tập',
        'Tích hợp cổng thanh toán và dịch vụ gửi email',
      ],
      skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'Git', 'React'],
      majors: ['Công nghệ thông tin', 'Khoa học máy tính', 'Kỹ thuật phần mềm'],
    },
    en: {
      title: 'Backend Developer',
      positions: ['Backend Developer', 'Software Engineer', 'Fullstack Developer', 'Software Intern'],
      bullets: [
        'Built REST APIs in Node.js/TypeScript serving 200,000 users',
        'Designed PostgreSQL schemas and cut response time by 40%',
        'Wrote unit and integration tests with 85% coverage',
        'Set up CI/CD with GitHub Actions and Docker',
        'Reviewed code and mentored 2 interns',
        'Integrated a payment gateway and transactional email',
      ],
      skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'Git', 'React'],
      majors: ['Information Technology', 'Computer Science', 'Software Engineering'],
    },
  },
  marketing: {
    vi: {
      title: 'Chuyên viên Marketing',
      positions: ['Chuyên viên Marketing', 'Nhân viên Digital Marketing', 'Content Marketing', 'Trưởng nhóm Marketing'],
      bullets: [
        'Lên kế hoạch và chạy quảng cáo Facebook, Google với ngân sách 300 triệu/tháng',
        'Tăng 60% lượt theo dõi fanpage trong 6 tháng',
        'Viết nội dung cho website, email marketing và mạng xã hội',
        'Phối hợp với agency sản xuất video quảng cáo',
        'Đo lường hiệu quả chiến dịch bằng Google Analytics 4',
        'Tổ chức sự kiện ra mắt sản phẩm với 500 khách mời',
      ],
      skills: ['Facebook Ads', 'Google Ads', 'SEO', 'Canva', 'Google Analytics', 'Viết nội dung'],
      majors: ['Marketing', 'Quan hệ công chúng', 'Truyền thông đa phương tiện'],
    },
    en: {
      title: 'Marketing Executive',
      positions: ['Marketing Executive', 'Digital Marketing Specialist', 'Content Marketer', 'Marketing Team Lead'],
      bullets: [
        'Planned and ran Facebook and Google ads with a VND 300M monthly budget',
        'Grew fanpage followers by 60% in 6 months',
        'Wrote copy for the website, newsletters and social media',
        'Worked with agencies on video ads',
        'Measured campaigns with Google Analytics 4',
        'Organised a product launch for 500 guests',
      ],
      skills: ['Facebook Ads', 'Google Ads', 'SEO', 'Canva', 'Google Analytics', 'Copywriting'],
      majors: ['Marketing', 'Public Relations', 'Multimedia Communication'],
    },
  },
  hr: {
    vi: {
      title: 'Chuyên viên Nhân sự',
      positions: [
        'Chuyên viên Tuyển dụng',
        'Nhân viên Hành chính – Nhân sự',
        'Chuyên viên C&B',
        'Trưởng phòng Nhân sự',
      ],
      bullets: [
        'Tuyển dụng 80 nhân sự/năm cho khối kinh doanh và sản xuất',
        'Tính lương, BHXH, thuế TNCN cho 350 nhân viên',
        'Xây dựng quy trình đào tạo hội nhập cho nhân viên mới',
        'Soạn thảo hợp đồng lao động, nội quy công ty',
        'Tổ chức team building và các hoạt động gắn kết',
        'Theo dõi chấm công và báo cáo biến động nhân sự',
      ],
      skills: ['Tuyển dụng', 'Luật lao động', 'Tính lương', 'Excel', 'Giao tiếp', 'Phỏng vấn'],
      majors: ['Quản trị nhân lực', 'Quản trị kinh doanh', 'Luật'],
    },
    en: {
      title: 'HR Executive',
      positions: ['Recruitment Specialist', 'HR & Admin Executive', 'C&B Specialist', 'HR Manager'],
      bullets: [
        'Hired 80 people a year for sales and production',
        'Ran payroll, social insurance and PIT for 350 staff',
        'Built an onboarding programme for new hires',
        'Drafted labour contracts and company policies',
        'Organised team building events',
        'Tracked attendance and reported headcount changes',
      ],
      skills: ['Recruitment', 'Labour law', 'Payroll', 'Excel', 'Communication', 'Interviewing'],
      majors: ['Human Resource Management', 'Business Administration', 'Law'],
    },
  },
  logistics: {
    vi: {
      title: 'Nhân viên Xuất nhập khẩu',
      positions: ['Nhân viên Xuất nhập khẩu', 'Nhân viên Chứng từ', 'Điều phối kho vận', 'Nhân viên Mua hàng'],
      bullets: [
        'Làm thủ tục hải quan cho 40 lô hàng/tháng (FCL, LCL, air)',
        'Lập bộ chứng từ: invoice, packing list, C/O, B/L',
        'Liên hệ hãng tàu, forwarder để đặt chỗ và theo dõi lịch tàu',
        'Quản lý tồn kho trên phần mềm WMS, kiểm kê định kỳ',
        'Đàm phán giá cước giảm 12% chi phí vận chuyển',
        'Xử lý khiếu nại hàng hư hỏng với khách hàng nước ngoài',
      ],
      skills: ['Khai báo hải quan VNACCS', 'Incoterms 2020', 'Tiếng Anh giao tiếp', 'Excel', 'WMS', 'Đàm phán'],
      majors: ['Logistics và Quản lý chuỗi cung ứng', 'Kinh tế đối ngoại', 'Thương mại quốc tế'],
    },
    en: {
      title: 'Import-Export Officer',
      positions: ['Import-Export Officer', 'Documentation Staff', 'Warehouse Coordinator', 'Purchasing Officer'],
      bullets: [
        'Cleared customs for 40 shipments a month (FCL, LCL, air)',
        'Prepared invoices, packing lists, C/O and B/L',
        'Booked space with carriers and forwarders and tracked schedules',
        'Managed stock in a WMS and ran cycle counts',
        'Negotiated freight rates, cutting transport cost by 12%',
        'Handled damage claims with overseas customers',
      ],
      skills: ['VNACCS customs', 'Incoterms 2020', 'English', 'Excel', 'WMS', 'Negotiation'],
      majors: ['Logistics and Supply Chain Management', 'International Economics', 'International Trade'],
    },
  },
  design: {
    vi: {
      title: 'Thiết kế đồ hoạ',
      positions: ['Nhân viên Thiết kế đồ hoạ', 'Thiết kế UI/UX', 'Thiết kế Freelance', 'Họa sĩ minh hoạ'],
      bullets: [
        'Thiết kế bộ nhận diện thương hiệu cho 15 khách hàng',
        'Làm banner, ấn phẩm in ấn và bao bì sản phẩm',
        'Thiết kế giao diện ứng dụng di động trên Figma',
        'Phối hợp với đội marketing làm nội dung mạng xã hội',
        'Chỉnh sửa ảnh sản phẩm cho website thương mại điện tử',
        'Xây dựng thư viện component dùng chung',
      ],
      skills: ['Photoshop', 'Illustrator', 'Figma', 'InDesign', 'After Effects', 'Vẽ tay'],
      majors: ['Thiết kế đồ hoạ', 'Mỹ thuật công nghiệp', 'Thiết kế truyền thông'],
    },
    en: {
      title: 'Graphic Designer',
      positions: ['Graphic Designer', 'UI/UX Designer', 'Freelance Designer', 'Illustrator'],
      bullets: [
        'Designed brand identities for 15 clients',
        'Produced banners, print materials and packaging',
        'Designed mobile app screens in Figma',
        'Worked with marketing on social media content',
        'Retouched product photos for an e-commerce site',
        'Built a shared component library',
      ],
      skills: ['Photoshop', 'Illustrator', 'Figma', 'InDesign', 'After Effects', 'Hand drawing'],
      majors: ['Graphic Design', 'Industrial Fine Arts', 'Communication Design'],
    },
  },
  teacher: {
    vi: {
      title: 'Giáo viên Tiếng Anh',
      positions: ['Giáo viên Tiếng Anh', 'Trợ giảng', 'Giáo viên chủ nhiệm', 'Tổ trưởng chuyên môn'],
      bullets: [
        'Giảng dạy tiếng Anh cho học sinh lớp 6–9, sĩ số 35 em/lớp',
        'Luyện thi IELTS cho 60 học viên, điểm trung bình 6.5',
        'Soạn giáo án điện tử và bài kiểm tra định kỳ',
        'Tổ chức câu lạc bộ tiếng Anh hàng tuần',
        'Trao đổi với phụ huynh về tình hình học tập',
        'Đạt giáo viên dạy giỏi cấp quận năm học 2022–2023',
      ],
      skills: ['IELTS 7.5', 'Soạn giáo án', 'Quản lý lớp học', 'PowerPoint', 'Kiên nhẫn', 'Thuyết trình'],
      majors: ['Sư phạm Tiếng Anh', 'Ngôn ngữ Anh', 'Giáo dục Tiểu học'],
    },
    en: {
      title: 'English Teacher',
      positions: ['English Teacher', 'Teaching Assistant', 'Homeroom Teacher', 'Head of Department'],
      bullets: [
        'Taught English to grades 6–9, 35 students per class',
        'Coached 60 IELTS students to an average band of 6.5',
        'Prepared lesson plans and regular tests',
        'Ran a weekly English club',
        'Kept parents informed about progress',
        'District excellent teacher award 2022–2023',
      ],
      skills: ['IELTS 7.5', 'Lesson planning', 'Classroom management', 'PowerPoint', 'Patience', 'Public speaking'],
      majors: ['English Language Teaching', 'English Language', 'Primary Education'],
    },
  },
  nurse: {
    vi: {
      title: 'Điều dưỡng',
      positions: ['Điều dưỡng viên', 'Điều dưỡng trưởng khoa', 'Kỹ thuật viên xét nghiệm', 'Dược sĩ'],
      bullets: [
        'Chăm sóc bệnh nhân nội trú khoa Nội tổng hợp, 30 giường',
        'Thực hiện y lệnh, tiêm truyền, theo dõi dấu hiệu sinh tồn',
        'Hướng dẫn người bệnh và người nhà về chế độ dinh dưỡng',
        'Quản lý hồ sơ bệnh án điện tử',
        'Tham gia trực đêm và cấp cứu',
        'Hướng dẫn sinh viên thực tập',
      ],
      skills: ['Chăm sóc người bệnh', 'Kiểm soát nhiễm khuẩn', 'Sơ cấp cứu', 'Bệnh án điện tử', 'Tin học văn phòng'],
      majors: ['Điều dưỡng', 'Xét nghiệm y học', 'Dược học'],
    },
    en: {
      title: 'Registered Nurse',
      positions: ['Registered Nurse', 'Head Nurse', 'Lab Technician', 'Pharmacist'],
      bullets: [
        'Cared for in-patients in a 30-bed internal medicine ward',
        'Gave injections and infusions and monitored vital signs',
        'Advised patients and families on diet',
        'Kept electronic medical records',
        'Covered night and emergency shifts',
        'Supervised nursing students',
      ],
      skills: ['Patient care', 'Infection control', 'First aid', 'EMR', 'MS Office'],
      majors: ['Nursing', 'Medical Laboratory Science', 'Pharmacy'],
    },
  },
  cs: {
    vi: {
      title: 'Chăm sóc khách hàng',
      positions: ['Nhân viên Chăm sóc khách hàng', 'Nhân viên Tổng đài', 'Lễ tân', 'Thu ngân'],
      bullets: [
        'Tiếp nhận và xử lý 80 cuộc gọi/ngày qua tổng đài',
        'Giải quyết khiếu nại, tỷ lệ hài lòng 96%',
        'Cập nhật thông tin khách hàng trên hệ thống CRM',
        'Đón tiếp khách, sắp xếp lịch hẹn cho ban giám đốc',
        'Hỗ trợ khách hàng qua chat, email và Zalo OA',
        'Đề xuất kịch bản trả lời giúp giảm 20% thời gian xử lý',
      ],
      skills: ['Giao tiếp', 'Xử lý tình huống', 'CRM', 'Tin học văn phòng', 'Tiếng Anh cơ bản'],
      majors: ['Quản trị khách sạn', 'Quản trị kinh doanh', 'Ngôn ngữ Anh'],
    },
    en: {
      title: 'Customer Service Officer',
      positions: ['Customer Service Officer', 'Call Centre Agent', 'Receptionist', 'Cashier'],
      bullets: [
        'Handled 80 calls a day in the call centre',
        'Resolved complaints with a 96% satisfaction score',
        'Updated customer records in the CRM',
        'Welcomed visitors and managed the directors’ calendar',
        'Supported customers via chat, email and Zalo OA',
        'Wrote response scripts that cut handling time by 20%',
      ],
      skills: ['Communication', 'Problem solving', 'CRM', 'MS Office', 'English'],
      majors: ['Hotel Management', 'Business Administration', 'English Language'],
    },
  },
};

/** [Vietnamese name, English name, company phone, company email]. All fictional. */
export const COMPANIES = [
  ['Công ty TNHH Thương mại Phú Gia', 'Phu Gia Trading Co., Ltd.', '(028) 3823 4567', 'info@phugia.example'],
  ['Công ty CP Xây dựng Hoà Bình An', 'Hoa Binh An Construction JSC', '024.3773.1234', 'hanhchinh@hoabinhan.example'],
  ['Công ty CP Công nghệ Sao Việt', 'Sao Viet Technology JSC', 'Hotline 1900 6868', 'hr@saoviet-tech.example'],
  ['Công ty TNHH Logistics Bến Nghé', 'Ben Nghe Logistics Co., Ltd.', '0283 822 9911', 'tuyendung.bennghe@gmail.com'],
  ['Công ty CP Dược phẩm An Khang Xanh', 'An Khang Xanh Pharma JSC', '(0236) 3888 123', 'contact@ankhangxanh.example'],
  ['Công ty TNHH Thực phẩm Mekong Fresh', 'Mekong Fresh Foods Co., Ltd.', '0292 3734 567', 'sales@mekongfresh.example'],
  ['Công ty CP Truyền thông Ánh Dương', 'Anh Duong Media JSC', 'Hotline: 0903 111 222', 'anhduong.media@gmail.com'],
  ['Công ty TNHH Nội thất Việt Mộc', 'Viet Moc Furniture Co., Ltd.', '(0274) 3866 222', 'vietmoc.noithat@yahoo.com'],
  ['Công ty CP Địa ốc Lam Sơn Xanh', 'Lam Son Xanh Realty JSC', '028.6260.8899', 'cskh@lamsonxanh.example'],
  ['Công ty TNHH Giáo dục Hạt Mầm', 'Hat Mam Education Co., Ltd.', '0909 456 123', 'hatmam.edu@gmail.com'],
  ['Bệnh viện Đa khoa Tâm An', 'Tam An General Hospital', '(028) 3925 1155', 'phongtccb@tamanhospital.example'],
  ['Công ty TNHH May mặc Thành Lợi', 'Thanh Loi Garment Co., Ltd.', '0251 3836 777', 'nhansu.thanhloi@outlook.com'],
  ['Công ty CP Phần mềm Lạc Hồng Số', 'Lac Hong Digital Software JSC', '024 3200 5566', 'jobs@lachongso.example'],
  ['Siêu thị Điện máy Minh Khoa', 'Minh Khoa Electronics', 'Tổng đài 1800 5858', 'minhkhoa.cskh@gmail.com'],
  ['Công ty TNHH Du lịch Hải Âu Xanh', 'Hai Au Xanh Travel Co., Ltd.', '0258 3521 999', 'booking@haiauxanh.example'],
];

/** [Vietnamese, English]. */
export const SCHOOLS = [
  ['Đại học Kinh tế TP. HCM', 'University of Economics Ho Chi Minh City'],
  ['Đại học Bách khoa Hà Nội', 'Hanoi University of Science and Technology'],
  ['Đại học Ngoại thương', 'Foreign Trade University'],
  ['Đại học Cần Thơ', 'Can Tho University'],
  ['Trường Đại học Kinh tế – Đại học Đà Nẵng', 'University of Economics – The University of Danang'],
  ['Cao đẳng Kinh tế Đối ngoại', 'College of Foreign Economic Relations'],
  ['Đại học Sư phạm Huế', 'Hue University of Education'],
  ['Đại học Y Dược TP. HCM', 'University of Medicine and Pharmacy at HCMC'],
  ['Học viện Công nghệ Bưu chính Viễn thông', 'Posts and Telecommunications Institute of Technology'],
  ['Đại học Nha Trang', 'Nha Trang University'],
  ['Đại học Kinh tế Quốc dân', 'National Economics University'],
];

export const ADDRESSES = {
  vi: [
    '12 Lê Lợi, P. Bến Nghé, Q.1, TP. HCM',
    '45/7 Nguyễn Trãi, P.2, Q.5, TP. HCM',
    'Số 18 ngõ 102 Trường Chinh, Đống Đa, Hà Nội',
    '203 Hùng Vương, Hải Châu, Đà Nẵng',
    '88A Trần Hưng Đạo, Ninh Kiều, Cần Thơ',
    'Tổ 5, KP 3, P. Tân Hiệp, Biên Hoà, Đồng Nai',
    'Căn hộ B2-1507, 99 Nguyễn Hữu Thọ, Q.7, TP. HCM',
    '156/12 Phan Đăng Lưu, P.3, Q. Phú Nhuận, TP. HCM',
    'Thôn Phú Lộc, xã Hoà Phước, Hoà Vang, Đà Nẵng',
    'Số 7, đường 3/2, P. Xuân Khánh, Ninh Kiều, Cần Thơ',
  ],
  en: [
    '12 Le Loi St., District 1, Ho Chi Minh City',
    '45/7 Nguyen Trai St., Ward 2, District 5, HCMC',
    'No. 18, Lane 102 Truong Chinh, Dong Da, Hanoi',
    '203 Hung Vuong, Hai Chau, Da Nang',
    'Apt B2-1507, 99 Nguyen Huu Tho, District 7, HCMC',
  ],
};

export const INTERESTS = {
  vi: ['Đọc sách', 'Chạy bộ', 'Du lịch', 'Bóng đá', 'Nấu ăn', 'Chụp ảnh', 'Cầu lông', 'Tình nguyện'],
  en: ['Reading', 'Running', 'Travelling', 'Football', 'Cooking', 'Photography', 'Badminton', 'Volunteering'],
};

export const CERTS = {
  vi: [
    'TOEIC 750 (2023)',
    'Chứng chỉ Tin học ứng dụng cơ bản',
    'IELTS 6.5',
    'Chứng chỉ Kế toán trưởng',
    'Google Ads Search',
  ],
  en: ['TOEIC 750 (2023)', 'IC3 Digital Literacy', 'IELTS 6.5', 'Chief Accountant Certificate', 'Google Ads Search'],
};

export const PROJECT_TEXT = {
  vi: 'Dự án kéo dài 9 tháng với đội 12 người. Tôi phụ trách khảo sát yêu cầu, lập kế hoạch triển khai, phối hợp các phòng ban, theo dõi tiến độ hằng tuần và báo cáo cho ban giám đốc. Kết quả: hoàn thành đúng hạn, tiết kiệm 8% ngân sách, quy trình mới được áp dụng cho toàn bộ 5 chi nhánh. Bài học rút ra là cần thống nhất đầu mối liên lạc và có tiêu chí nghiệm thu rõ ràng ngay từ đầu.',
  en: 'A nine-month project with a team of 12. I gathered requirements, planned the rollout, coordinated departments, tracked progress weekly and reported to the board. Outcome: delivered on time, 8% under budget, and the new process was adopted by all 5 branches. Lesson learned: agree on one point of contact and clear acceptance criteria from day one.',
};

/** "Nguyễn Đức" → "Nguyen Duc" (what a CV typed without Vietnamese accents shows). */
export const stripDiacritics = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

/** 0xxxxxxxxx from any display format used in the cases, or null when it is not a Vietnamese mobile. */
export function toMobile(display) {
  let digits = display.replace(/\D/g, '');
  if (digits.startsWith('840')) digits = digits.slice(2);
  else if (digits.startsWith('84')) digits = `0${digits.slice(2)}`;
  return /^0[35789]\d{8}$/.test(digits) ? digits : null;
}

/** Like toMobile, but a case whose phone is not a mobile is a typo in the case data. */
export function normalizePhone(display) {
  const mobile = toMobile(display);
  if (!mobile) throw new Error(`Bad phone in case data: ${display}`);
  return mobile;
}
