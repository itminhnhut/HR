import { addDays, todayInVietnam, type ApplicationStatus, type EmploymentType, type JobState } from '@careers/shared';

/** Rows of the in-browser demo database. Shapes mirror what the BE stores. */
export interface MockJob {
  id: string;
  slug: string;
  title: string;
  department: string;
  employmentType: EmploymentType;
  remote: boolean;
  city: string;
  address: string | null;
  workingHours: string | null;
  level: string | null;
  experience: string | null;
  education: string | null;
  language: string | null;
  headcount: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryNote: string | null;
  skills: string[];
  summary: string | null;
  teamNote: string | null;
  responsibilities: string;
  requirements: string;
  niceToHave: string;
  benefitIncome: string;
  benefitInsurance: string;
  benefitTimeOff: string;
  benefitGrowth: string;
  benefitEnvironment: string;
  plan30: string | null;
  plan60: string | null;
  plan90: string | null;
  perks: string;
  deadline: string;
  state: JobState;
  publishedOn: string | null;
  createdAt: string;
}

export interface MockApplication {
  id: string;
  jobId: string;
  fullName: string;
  phone: string;
  email: string | null;
  message: string | null;
  cvFileName: string | null;
  cvLink: string | null;
  status: ApplicationStatus;
  note: string | null;
  keepForOtherJobs: boolean;
  consentAt: string;
  policyVersion: string;
  thankedAt: string | null;
  createdAt: string;
}

export interface MockSubscriber {
  id: string;
  phone: string;
  department: string;
  fromJobId: string | null;
  consentAt: string;
  policyVersion?: string;
  createdAt: string;
}

export interface MockCandidate {
  phone: string;
  name: string | null;
  email: string | null;
  cvFileName: string | null;
  keepForOtherJobs: boolean;
  alertDepartments: string[];
}

export interface MockDb {
  version: number;
  jobs: MockJob[];
  applications: MockApplication[];
  subscribers: MockSubscriber[];
  candidates: MockCandidate[];
  saved: string[];
  session: { hr: string | null; candidatePhone: string | null };
}

export const DB_VERSION = 3;

const SHARED_BENEFITS = {
  benefitInsurance:
    'BHXH, BHYT, BHTN đóng trên lương thực nhận\nBảo hiểm sức khỏe [tên gói]\nKhám sức khỏe định kỳ mỗi năm',
  benefitTimeOff: '12 ngày phép năm, tăng theo thâm niên\nNghỉ thứ 7 và chủ nhật\nNghỉ lễ, Tết theo luật',
  benefitEnvironment:
    'Du lịch công ty hằng năm\nTeam building mỗi quý\nCấp laptop và điện thoại công việc\nPhụ cấp đi lại, điện thoại',
};

const OFFICE = '[Số nhà, đường], Quận 3, TP. Hồ Chí Minh';
const HOURS = 'T2 – T6, 8:30 – 17:30, nghỉ T7 và CN';

type JobSeed = Omit<MockJob, 'deadline' | 'publishedOn' | 'createdAt'> & {
  /** Days from today. Negative = in the past. */
  deadlineIn: number;
  publishedAgo: number | null;
};

function job(
  seed: Partial<JobSeed> & Pick<JobSeed, 'id' | 'slug' | 'title' | 'department' | 'deadlineIn' | 'state'>,
): JobSeed {
  return {
    employmentType: 'full_time',
    remote: false,
    city: 'TP. HCM',
    address: OFFICE,
    workingHours: HOURS,
    level: 'Nhân viên',
    experience: 'Từ 1 năm',
    education: 'Cao đẳng trở lên',
    language: 'Không bắt buộc',
    headcount: 1,
    salaryMin: null,
    salaryMax: null,
    salaryNote: null,
    skills: [],
    summary: null,
    teamNote: null,
    responsibilities: '',
    requirements: '',
    niceToHave: '',
    benefitIncome: 'Lương tháng 13, thưởng Tết theo kết quả',
    benefitGrowth: 'Đào tạo nội bộ hằng quý',
    plan30: null,
    plan60: null,
    plan90: null,
    perks: 'Lương tháng 13, BHXH đầy đủ',
    publishedAgo: 10,
    ...SHARED_BENEFITS,
    ...seed,
  };
}

const JOBS: JobSeed[] = [
  job({
    id: 'j1',
    slug: 'nhan-vien-kinh-doanh-b2b',
    title: 'Nhân viên Kinh doanh B2B',
    department: 'Kinh doanh',
    headcount: 2,
    salaryMin: 12,
    salaryMax: 18,
    salaryNote: 'hoa hồng',
    skills: ['Bán hàng B2B', 'Tư vấn giải pháp', 'Đàm phán', 'CRM', 'Excel'],
    summary:
      'Bạn phụ trách mảng khách hàng doanh nghiệp vừa và nhỏ tại TP. HCM, từ tìm khách mới đến chăm sóc sau bán. Đây là vị trí phù hợp nếu bạn thích gặp khách trực tiếp và muốn thu nhập tăng theo kết quả.',
    teamNote: 'Đội Kinh doanh 6 người, báo cáo trực tiếp cho Trưởng phòng Kinh doanh.',
    responsibilities:
      'Tìm và tiếp cận khách hàng doanh nghiệp mới qua điện thoại, email và gặp trực tiếp.\nTư vấn giải pháp, gửi báo giá và theo dõi đến khi ký hợp đồng.\nChăm sóc khách hàng hiện có, mở rộng đơn hàng định kỳ.\nCập nhật thông tin khách hàng trên CRM và báo cáo kết quả mỗi tuần.\nPhối hợp với bộ phận vận hành để giao hàng đúng hẹn.',
    requirements:
      'Tối thiểu 1 năm kinh nghiệm bán hàng.\nGiao tiếp rõ ràng, chủ động, chịu được áp lực doanh số.\nDùng thành thạo Excel hoặc Google Sheets.\nCó phương tiện đi lại.',
    niceToHave:
      'Đã bán phần mềm hoặc dịch vụ cho doanh nghiệp.\nĐã dùng CRM (HubSpot, Salesforce, Bitrix…).\nCó sẵn mạng lưới khách hàng doanh nghiệp.',
    benefitIncome:
      'Lương cứng 12 – 18 triệu, xét tăng 2 lần/năm\nHoa hồng theo doanh số, không giới hạn\nLương tháng 13, thưởng Tết theo kết quả',
    benefitGrowth:
      'Đào tạo sản phẩm và kỹ năng bán hàng\nLộ trình lên Trưởng nhóm sau 1–2 năm\nHỗ trợ học phí khóa học liên quan',
    plan30: 'Học sản phẩm, quy trình bán hàng, đi gặp khách cùng trưởng nhóm.',
    plan60: 'Quản lý danh sách khách hàng riêng, tự tư vấn và báo giá.',
    plan90: 'Đạt chỉ tiêu doanh số đầu tiên [chỉ tiêu] và được xét tăng hoa hồng.',
    perks: 'Lương tháng 13, BHXH đầy đủ',
    deadlineIn: 38,
    publishedAgo: 2,
    state: 'published',
  }),
  job({
    id: 'j2',
    slug: 'lap-trinh-vien-frontend-react',
    title: 'Lập trình viên Frontend (React)',
    department: 'Kỹ thuật',
    city: 'Hà Nội',
    remote: true,
    experience: 'Từ 2 năm',
    education: 'Không bắt buộc',
    language: 'Đọc hiểu tiếng Anh',
    salaryMin: 20,
    salaryMax: 30,
    skills: ['React', 'TypeScript', 'CSS', 'REST API'],
    summary: 'Bạn xây giao diện web cho sản phẩm nội bộ và khách hàng, làm cùng designer và backend.',
    teamNote: 'Đội Kỹ thuật 8 người, làm việc theo sprint 2 tuần.',
    responsibilities:
      'Xây và bảo trì giao diện bằng React và TypeScript.\nPhối hợp với designer để giao diện đúng thiết kế trên mọi màn hình.\nViết test cho phần mình làm.\nReview code cho đồng đội.',
    requirements: 'Từ 2 năm làm React.\nNắm vững HTML, CSS, JavaScript.\nĐọc hiểu tài liệu tiếng Anh.',
    niceToHave: 'Đã làm với TanStack Query hoặc React Router.\nCó kinh nghiệm tối ưu hiệu năng web.',
    benefitIncome: 'Lương 20 – 30 triệu, xét tăng mỗi năm\nLương tháng 13',
    benefitGrowth: 'Ngân sách học tập 5 triệu/năm\nTham dự hội thảo kỹ thuật',
    benefitEnvironment: 'Làm hybrid, 2 ngày ở nhà mỗi tuần\nCấp laptop\nTeam building mỗi quý',
    perks: 'Làm hybrid, cấp laptop',
    deadlineIn: 43,
    publishedAgo: 3,
    state: 'published',
  }),
  job({
    id: 'j3',
    slug: 'chuyen-vien-tuyen-dung',
    title: 'Chuyên viên Tuyển dụng',
    department: 'Nhân sự',
    salaryMin: 12,
    salaryMax: 16,
    skills: ['Tuyển dụng', 'Phỏng vấn', 'Employer branding'],
    summary: 'Bạn lo trọn quy trình tuyển dụng cho khối văn phòng, từ đăng tin đến ngày nhân viên mới đi làm.',
    responsibilities:
      'Đăng tin và tìm ứng viên trên các kênh.\nSàng lọc hồ sơ, hẹn và phỏng vấn vòng đầu.\nPhối hợp với trưởng bộ phận chốt ứng viên.',
    requirements: 'Từ 1 năm làm tuyển dụng.\nGiao tiếp tốt, chủ động.',
    niceToHave: 'Đã tuyển khối kinh doanh.',
    perks: 'BHXH đầy đủ, 12 ngày phép',
    deadlineIn: 3,
    publishedAgo: 20,
    state: 'published',
  }),
  job({
    id: 'j4',
    slug: 'chuyen-vien-marketing-noi-dung',
    title: 'Chuyên viên Marketing Nội dung',
    department: 'Marketing',
    salaryMin: 13,
    salaryMax: 17,
    skills: ['Viết nội dung', 'Facebook', 'SEO'],
    summary: 'Bạn viết nội dung cho website, fanpage và email của công ty.',
    responsibilities:
      'Lên kế hoạch nội dung hằng tháng.\nViết bài website, fanpage, email.\nTheo dõi số liệu và đề xuất cải thiện.',
    requirements: 'Từ 1 năm viết nội dung.\nViết tiếng Việt chuẩn, mạch lạc.',
    niceToHave: 'Biết SEO cơ bản.\nBiết thiết kế ảnh đơn giản.',
    perks: 'Lương tháng 13, đào tạo',
    deadlineIn: 33,
    publishedAgo: 12,
    state: 'published',
  }),
  job({
    id: 'j5',
    slug: 'nhan-vien-cham-soc-khach-hang',
    title: 'Nhân viên Chăm sóc khách hàng',
    department: 'Vận hành',
    city: 'Đà Nẵng',
    address: '[Số nhà, đường], Hải Châu, Đà Nẵng',
    experience: 'Không yêu cầu',
    salaryMin: 9,
    salaryMax: 12,
    headcount: 3,
    summary: 'Bạn hỗ trợ khách hàng qua điện thoại, Zalo và email.',
    responsibilities:
      'Trả lời câu hỏi của khách qua điện thoại, Zalo, email.\nGhi nhận và chuyển yêu cầu cho bộ phận liên quan.',
    requirements: 'Giọng nói rõ ràng.\nKiên nhẫn, thân thiện.',
    niceToHave: 'Đã làm chăm sóc khách hàng.',
    perks: 'Ca hành chính, thưởng KPI',
    deadlineIn: 36,
    publishedAgo: 8,
    state: 'published',
  }),
  job({
    id: 'j8',
    slug: 'thuc-tap-sinh-kinh-doanh',
    title: 'Thực tập sinh Kinh doanh',
    department: 'Kinh doanh',
    employmentType: 'internship',
    level: 'Thực tập sinh',
    experience: 'Không yêu cầu',
    education: 'Sinh viên năm 3, 4',
    salaryMin: 4,
    salaryMax: 4,
    salaryNote: null,
    summary: 'Thực tập 3 tháng cùng đội Kinh doanh, có cơ hội lên nhân viên chính thức.',
    responsibilities: 'Hỗ trợ đội kinh doanh tìm khách hàng.\nCập nhật dữ liệu khách hàng.',
    requirements: 'Sinh viên năm 3 hoặc 4.\nLàm được ít nhất 4 buổi/tuần.',
    niceToHave: 'Đã tham gia câu lạc bộ kinh doanh.',
    benefitIncome: 'Hỗ trợ 4 triệu/tháng',
    perks: 'Có cơ hội lên chính thức',
    deadlineIn: 53,
    publishedAgo: 5,
    state: 'published',
  }),
  job({
    id: 'j9',
    slug: 'nhan-vien-thiet-ke-do-hoa',
    title: 'Nhân viên Thiết kế đồ họa',
    department: 'Marketing',
    salaryMin: 12,
    salaryMax: 15,
    responsibilities: 'Thiết kế ấn phẩm cho fanpage, website và sự kiện.',
    requirements: 'Thành thạo Figma hoặc Photoshop.',
    perks: 'Lương tháng 13',
    deadlineIn: 28,
    publishedAgo: 15,
    state: 'paused',
  }),
  job({
    id: 'j10',
    slug: 'ke-toan-noi-bo',
    title: 'Kế toán nội bộ',
    department: 'Vận hành',
    salaryMin: 11,
    salaryMax: 14,
    responsibilities: 'Theo dõi thu chi, đối chiếu công nợ.',
    requirements: 'Tốt nghiệp chuyên ngành kế toán.',
    perks: 'BHXH đầy đủ',
    deadlineIn: -8,
    publishedAgo: 40,
    state: 'published',
  }),
  job({
    id: 'j6',
    slug: 'nhan-vien-hanh-chinh',
    title: 'Nhân viên Hành chính',
    department: 'Nhân sự',
    salaryMin: 10,
    salaryMax: 13,
    responsibilities: 'Quản lý văn phòng phẩm, lịch họp, tiếp khách.',
    requirements: 'Cẩn thận, ngăn nắp.',
    perks: 'BHXH đầy đủ',
    deadlineIn: -13,
    publishedAgo: 45,
    state: 'filled',
  }),
  job({
    id: 'j7',
    slug: 'ke-toan-tong-hop',
    title: 'Kế toán tổng hợp',
    department: 'Vận hành',
    responsibilities: 'Lập báo cáo tài chính hằng tháng.',
    requirements: 'Từ 3 năm kế toán tổng hợp.',
    perks: '',
    deadlineIn: 30,
    publishedAgo: null,
    state: 'draft',
  }),
];

const daysAgoIso = (today: string, days: number) => `${addDays(today, -days)}T03:00:00.000Z`;

export function buildSeed(now: Date = new Date()): MockDb {
  const today = todayInVietnam(now);
  const jobs: MockJob[] = JOBS.map(({ deadlineIn, publishedAgo, ...rest }) => ({
    ...rest,
    deadline: addDays(today, deadlineIn),
    publishedOn: publishedAgo == null ? null : addDays(today, -publishedAgo),
    createdAt: daysAgoIso(today, (publishedAgo ?? 1) + 1),
  }));

  const app = (
    id: string,
    jobId: string,
    fullName: string,
    phone: string,
    status: ApplicationStatus,
    ago: number,
    extra: Partial<MockApplication> = {},
  ): MockApplication => ({
    id,
    jobId,
    fullName,
    phone,
    email: null,
    message: null,
    cvFileName: `CV_${fullName.split(' ').pop()}.pdf`,
    cvLink: null,
    status,
    note: null,
    keepForOtherJobs: false,
    consentAt: daysAgoIso(today, ago),
    policyVersion: '2026-10',
    thankedAt: null,
    createdAt: daysAgoIso(today, ago),
    ...extra,
  });

  const applications: MockApplication[] = [
    app('a1', 'j1', 'Trần Minh Anh', '0912345128', 'interview', 2, {
      email: 'minhanh@email.com',
      message: 'Em có 2 năm bán phần mềm cho doanh nghiệp vừa và nhỏ, có thể bắt đầu từ đầu tháng 12.',
      note: 'Hẹn PV thứ 5, 10h tại văn phòng Quận 3',
      keepForOtherJobs: true,
    }),
    app('a2', 'j2', 'Lê Hoàng Phúc', '0903455455', 'new', 2, { message: 'Đã làm React 3 năm.' }),
    app('a3', 'j3', 'Phạm Thu Hà', '0938902902', 'new', 3),
    app('a4', 'j1', 'Nguyễn Quốc Bảo', '0977317317', 'interview', 5, {
      message: 'Có xe, sẵn sàng đi gặp khách.',
      keepForOtherJobs: true,
    }),
    app('a5', 'j4', 'Võ Ngọc Trâm', '0389664664', 'new', 6, { email: 'ngoctram@email.com' }),
    app('a6', 'j2', 'Đặng Gia Huy', '0868210210', 'passed', 9, { keepForOtherJobs: true }),
    app('a7', 'j5', 'Bùi Thanh Tùng', '0795589589', 'rejected', 11),
    // Minh Anh's other applications, for her account page.
    app('a8', 'j3', 'Trần Minh Anh', '0912345128', 'seen', 8),
    app('a9', 'j6', 'Trần Minh Anh', '0912345128', 'new', 21, { keepForOtherJobs: true }),
  ];

  const sub = (id: string, phone: string, department: string, fromJobId: string, ago: number): MockSubscriber => ({
    id,
    phone,
    department,
    fromJobId,
    consentAt: daysAgoIso(today, ago),
    createdAt: daysAgoIso(today, ago),
  });

  return {
    version: DB_VERSION,
    jobs,
    applications,
    subscribers: [
      sub('s1', '0912345001', 'Marketing', 'j9', 3),
      sub('s2', '0903222145', 'Marketing', 'j9', 4),
      sub('s3', '0938777210', 'Nhân sự', 'j6', 9),
      sub('s4', '0977090388', 'Vận hành', 'j10', 7),
      sub('s5', '0868451902', 'Vận hành', 'j10', 8),
      sub('s6', '0912345128', 'Kinh doanh', 'j1', 2),
    ],
    candidates: [
      {
        phone: '0912345128',
        name: 'Trần Minh Anh',
        email: 'minhanh@email.com',
        cvFileName: 'CV_TranMinhAnh.pdf',
        keepForOtherJobs: true,
        alertDepartments: ['Kinh doanh'],
      },
    ],
    saved: ['chuyen-vien-marketing-noi-dung', 'thuc-tap-sinh-kinh-doanh'],
    session: { hr: null, candidatePhone: null },
  };
}

/** HR emails allowed in the demo. The real allowlist lives in the BE. */
export const DEMO_HR = { email: 'hr@congty.vn', name: 'Phòng Nhân sự', password: 'Demo-Lee-HR-2026' };
export const DEMO_OTP = '123456';
