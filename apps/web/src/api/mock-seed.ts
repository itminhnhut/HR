import {
  addDays,
  composeWorkingHours,
  DEFAULT_JOB_TEMPLATE,
  standardBenefits,
  todayInVietnam,
  type ApplicationStatus,
  type EmploymentType,
  type JobState,
  type JobTemplate,
} from '@careers/shared';

/** Rows of the in-browser demo database. Shapes mirror what the BE stores. */
export interface MockJob {
  id: string;
  slug: string;
  title: string;
  department: string;
  employmentType: EmploymentType;
  /** null: the company office. */
  address: string | null;
  workingHours: string | null;
  experience: string | null;
  education: string | null;
  /** VND per month. */
  salaryMin: number | null;
  salaryMax: number | null;
  responsibilities: string;
  requirements: string;
  benefits: string[];
  roadmap: string[];
  deadline: string;
  state: JobState;
  publishedOn: string | null;
  closedOn: string | null;
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
  noteUpdatedAt: string | null;
  noteUpdatedBy: string | null;
  interviewAt: string | null;
  consentAt: string;
  policyVersion: string;
  createdAt: string;
}

export interface MockSubscriber {
  id: string;
  phone: string;
  department: string;
  fromJobId: string | null;
  /** Set when an account turned the alert on; public sign-ups have none. */
  candidateEmail?: string | null;
  consentAt: string;
  policyVersion?: string;
  createdAt: string;
}

export interface MockCandidate {
  /** Google email, the account identity. */
  email: string;
  phone: string | null;
  name: string | null;
  cvFileName: string | null;
  alertDepartments: string[];
}

export interface MockHrUser {
  id: string;
  email: string;
  name: string | null;
  password: string;
  lastLoginAt: string | null;
}

export interface MockDb {
  version: number;
  hrUsers: MockHrUser[];
  /** "Mẫu tin" once HR saved one; null = the built-in default. */
  template: JobTemplate | null;
  jobs: MockJob[];
  applications: MockApplication[];
  subscribers: MockSubscriber[];
  candidates: MockCandidate[];
  /** hr: the signed-in HR account id. */
  session: { hr: string | null; candidateEmail: string | null };
}

export const DB_VERSION = 7;

const STANDARD_BENEFITS = standardBenefits(DEFAULT_JOB_TEMPLATE);
const HOURS = composeWorkingHours(
  DEFAULT_JOB_TEMPLATE.workDays,
  DEFAULT_JOB_TEMPLATE.startTime,
  DEFAULT_JOB_TEMPLATE.endTime,
);
const M = 1_000_000;

type JobSeed = Omit<MockJob, 'deadline' | 'publishedOn' | 'closedOn' | 'createdAt'> & {
  /** Days from today. Negative = in the past. */
  deadlineIn: number;
  publishedAgo: number | null;
};

function job(
  seed: Partial<JobSeed> & Pick<JobSeed, 'id' | 'slug' | 'title' | 'department' | 'deadlineIn' | 'state'>,
): JobSeed {
  return {
    employmentType: 'full_time',
    address: null,
    workingHours: HOURS,
    experience: 'Từ 1 năm',
    education: 'Cao đẳng trở lên',
    salaryMin: null,
    salaryMax: null,
    responsibilities: '',
    requirements: '',
    benefits: STANDARD_BENEFITS,
    roadmap: DEFAULT_JOB_TEMPLATE.roadmap,
    publishedAgo: 10,
    ...seed,
  };
}

const JOBS: JobSeed[] = [
  job({
    id: 'j1',
    slug: 'nhan-vien-kinh-doanh-b2b',
    title: 'Nhân viên Kinh doanh B2B',
    department: 'Kinh doanh',
    salaryMin: 12 * M,
    salaryMax: 18 * M,
    responsibilities:
      'Tìm và tiếp cận khách hàng doanh nghiệp mới qua điện thoại, email và gặp trực tiếp.\nTư vấn giải pháp, gửi báo giá và theo dõi đến khi ký hợp đồng.\nChăm sóc khách hàng hiện có, mở rộng đơn hàng định kỳ.\nCập nhật thông tin khách hàng trên CRM và báo cáo kết quả mỗi tuần.\nPhối hợp với bộ phận vận hành để giao hàng đúng hẹn.',
    requirements:
      'Tối thiểu 1 năm kinh nghiệm bán hàng.\nGiao tiếp rõ ràng, chủ động, chịu được áp lực doanh số.\nDùng thành thạo Excel hoặc Google Sheets.\nCó phương tiện đi lại.\nĐiểm cộng: đã bán phần mềm hoặc dịch vụ cho doanh nghiệp.',
    benefits: [...STANDARD_BENEFITS, 'Hoa hồng', 'Phụ cấp gửi xe, xăng'],
    deadlineIn: 38,
    publishedAgo: 2,
    state: 'published',
  }),
  job({
    id: 'j2',
    slug: 'lap-trinh-vien-frontend-react',
    title: 'Lập trình viên Frontend (React)',
    department: 'Kỹ thuật',
    experience: 'Từ 2 năm',
    education: 'Không yêu cầu',
    workingHours: composeWorkingHours('Thứ 2 – Thứ 6', '08:30', '17:30'),
    salaryMin: 20 * M,
    salaryMax: 30 * M,
    responsibilities:
      'Xây và bảo trì giao diện bằng React và TypeScript.\nPhối hợp với designer để giao diện đúng thiết kế trên mọi màn hình.\nViết test cho phần mình làm.\nReview code cho đồng đội.',
    requirements:
      'Từ 2 năm làm React.\nNắm vững HTML, CSS, JavaScript.\nĐọc hiểu tài liệu tiếng Anh.\nĐiểm cộng: đã làm với TanStack Query hoặc React Router.',
    benefits: [...STANDARD_BENEFITS, 'Cấp laptop làm việc'],
    deadlineIn: 43,
    publishedAgo: 3,
    state: 'published',
  }),
  job({
    id: 'j3',
    slug: 'chuyen-vien-tuyen-dung',
    title: 'Chuyên viên Tuyển dụng',
    department: 'Nhân sự',
    salaryMin: 12 * M,
    salaryMax: 16 * M,
    responsibilities:
      'Đăng tin và tìm ứng viên trên các kênh.\nSàng lọc hồ sơ, hẹn và phỏng vấn vòng đầu.\nPhối hợp với trưởng bộ phận chốt ứng viên.',
    requirements: 'Từ 1 năm làm tuyển dụng.\nGiao tiếp tốt, chủ động.',
    deadlineIn: 3,
    publishedAgo: 20,
    state: 'published',
  }),
  job({
    id: 'j4',
    slug: 'chuyen-vien-marketing-noi-dung',
    title: 'Chuyên viên Marketing Nội dung',
    department: 'Marketing',
    salaryMin: 13 * M,
    salaryMax: 17 * M,
    responsibilities:
      'Lên kế hoạch nội dung hằng tháng.\nViết bài website, fanpage, email.\nTheo dõi số liệu và đề xuất cải thiện.',
    requirements: 'Từ 1 năm viết nội dung.\nViết tiếng Việt chuẩn, mạch lạc.\nĐiểm cộng: biết SEO cơ bản.',
    deadlineIn: 33,
    publishedAgo: 12,
    state: 'published',
  }),
  job({
    id: 'j5',
    slug: 'nhan-vien-cham-soc-khach-hang',
    title: 'Nhân viên Chăm sóc khách hàng',
    department: 'Vận hành',
    experience: 'Không yêu cầu',
    education: 'THPT',
    workingHours: composeWorkingHours('Làm theo ca', '07:00', '22:00'),
    salaryMin: 9 * M,
    salaryMax: 12_500_000,
    responsibilities:
      'Trả lời câu hỏi của khách qua điện thoại, Zalo, email.\nGhi nhận và chuyển yêu cầu cho bộ phận liên quan.',
    requirements: 'Giọng nói rõ ràng.\nKiên nhẫn, thân thiện.',
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
    experience: 'Không yêu cầu',
    education: 'Sinh viên năm 3, 4',
    salaryMin: 4 * M,
    salaryMax: 4 * M,
    responsibilities: 'Hỗ trợ đội kinh doanh tìm khách hàng.\nCập nhật dữ liệu khách hàng.',
    requirements: 'Sinh viên năm 3 hoặc 4.\nLàm được ít nhất 4 buổi/tuần.',
    benefits: ['Đào tạo, kèm cặp khi mới vào', 'Có cơ hội lên nhân viên chính thức'],
    roadmap: [],
    deadlineIn: 53,
    publishedAgo: 5,
    state: 'published',
  }),
  job({
    id: 'j9',
    slug: 'nhan-vien-thiet-ke-do-hoa',
    title: 'Nhân viên Thiết kế đồ họa',
    department: 'Marketing',
    salaryMin: 12 * M,
    salaryMax: 15 * M,
    responsibilities: 'Thiết kế ấn phẩm cho fanpage, website và sự kiện.',
    requirements: 'Thành thạo Figma hoặc Photoshop.',
    deadlineIn: 28,
    publishedAgo: 15,
    state: 'closed',
  }),
  job({
    id: 'j10',
    slug: 'ke-toan-noi-bo',
    title: 'Kế toán nội bộ',
    department: 'Vận hành',
    salaryMin: 11 * M,
    salaryMax: 14 * M,
    responsibilities: 'Theo dõi thu chi, đối chiếu công nợ.',
    requirements: 'Tốt nghiệp chuyên ngành kế toán.',
    deadlineIn: -8,
    publishedAgo: 40,
    state: 'published',
  }),
  job({
    id: 'j6',
    slug: 'nhan-vien-hanh-chinh',
    title: 'Nhân viên Hành chính',
    department: 'Nhân sự',
    salaryMin: 10 * M,
    salaryMax: 13 * M,
    responsibilities: 'Quản lý văn phòng phẩm, lịch họp, tiếp khách.',
    requirements: 'Cẩn thận, ngăn nắp.',
    deadlineIn: -13,
    publishedAgo: 45,
    state: 'closed',
  }),
  job({
    id: 'j7',
    slug: 'ke-toan-tong-hop',
    title: 'Kế toán tổng hợp',
    department: 'Vận hành',
    responsibilities: 'Lập báo cáo tài chính hằng tháng.',
    requirements: 'Từ 3 năm kế toán tổng hợp.',
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
    // j6 closed long ago, so its applications are due for deletion.
    closedOn: rest.state === 'closed' ? addDays(today, rest.id === 'j6' ? -40 : -2) : null,
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
    noteUpdatedAt: null,
    noteUpdatedBy: null,
    interviewAt: null,
    consentAt: daysAgoIso(today, ago),
    policyVersion: '2026-10',
    createdAt: daysAgoIso(today, ago),
    ...extra,
  });

  const applications: MockApplication[] = [
    app('a1', 'j1', 'Trần Minh Anh', '0912345128', 'interview', 2, {
      email: 'minhanh@email.com',
      message: 'Em có 2 năm bán phần mềm cho doanh nghiệp vừa và nhỏ, có thể bắt đầu từ đầu tháng 12.',
      note: 'Hẹn PV thứ 5, 10h tại văn phòng Gò Vấp',
      noteUpdatedAt: daysAgoIso(today, 1),
      noteUpdatedBy: 'Phòng Nhân sự',
      interviewAt: `${addDays(today, 2)}T03:00:00.000Z`,
    }),
    app('a2', 'j2', 'Lê Hoàng Phúc', '0903455455', 'new', 2, { message: 'Đã làm React 3 năm.' }),
    app('a3', 'j3', 'Phạm Thu Hà', '0938902902', 'new', 3),
    app('a4', 'j1', 'Nguyễn Quốc Bảo', '0977317317', 'interview', 5, {
      message: 'Có xe, sẵn sàng đi gặp khách.',
    }),
    app('a5', 'j4', 'Võ Ngọc Trâm', '0389664664', 'new', 6, { email: 'ngoctram@email.com' }),
    app('a6', 'j2', 'Đặng Gia Huy', '0868210210', 'interview', 9),
    app('a7', 'j5', 'Bùi Thanh Tùng', '0795589589', 'rejected', 11),
    // Minh Anh's other applications, for her account page.
    app('a8', 'j3', 'Trần Minh Anh', '0912345128', 'seen', 8, { email: 'minhanh@email.com' }),
    app('a9', 'j6', 'Trần Minh Anh', '0912345128', 'new', 50, { email: 'minhanh@email.com' }),
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
    hrUsers: [
      { id: 'u1', email: DEMO_HR.email, name: DEMO_HR.name, password: randomDemoPassword(), lastLoginAt: null },
    ],
    template: null,
    jobs,
    applications,
    subscribers: [
      sub('s1', '0912345001', 'Marketing', 'j9', 3),
      sub('s2', '0903222145', 'Marketing', 'j9', 4),
      sub('s3', '0938777210', 'Nhân sự', 'j6', 9),
      sub('s4', '0977090388', 'Vận hành', 'j10', 7),
      sub('s5', '0868451902', 'Vận hành', 'j10', 8),
      { ...sub('s6', '0912345128', 'Kinh doanh', 'j1', 2), candidateEmail: DEMO_CANDIDATE_EMAIL },
    ],
    candidates: [
      {
        phone: '0912345128',
        name: 'Trần Minh Anh',
        email: 'minhanh@email.com',
        cvFileName: 'CV_TranMinhAnh.pdf',
        alertDepartments: ['Kinh doanh'],
      },
    ],
    session: { hr: null, candidateEmail: null },
  };
}

/** HR emails allowed in the demo. The real allowlist lives in the BE. */
export const DEMO_HR = { email: 'hr@congty.vn', name: 'Phòng Nhân sự' };

/**
 * The demo HR password is made per browser when the demo data is created: nothing to guess from the source code.
 * The sign-in page shows it in demo mode only.
 */
function randomDemoPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  const text = Array.from(bytes, (b) => chars[b % chars.length]).join('');
  return `Demo-${text.slice(0, 5)}-${text.slice(5, 10)}-${text.slice(10)}`;
}
/** The demo "Google" account: Trần Minh Anh, who applied with this email. */
export const DEMO_CANDIDATE_EMAIL = 'minhanh@email.com';
