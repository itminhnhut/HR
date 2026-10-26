/**
 * Company defaults every new job starts from. HR only changes what differs for one job.
 * Stored per job once saved, so changing the defaults later never rewrites old jobs.
 */

/** The office where most jobs are. A job with no address of its own works here. */
export const OFFICE = {
  district: 'Gò Vấp',
  city: 'TP. Hồ Chí Minh',
  /** Short label for job cards. */
  label: 'Gò Vấp, TP. HCM',
} as const;

export const DEPARTMENT_SUGGESTIONS = ['Kinh doanh', 'Kỹ thuật', 'Marketing', 'Vận hành', 'Nhân sự'];

export const NO_REQUIREMENT = 'Không yêu cầu';
export const EXPERIENCE_OPTIONS = [NO_REQUIREMENT, 'Từ 1 năm', 'Từ 2 năm', 'Từ 3 năm'];
export const EDUCATION_OPTIONS = [NO_REQUIREMENT, 'THPT', 'Trung cấp trở lên', 'Cao đẳng trở lên', 'Đại học trở lên'];

export const WORK_DAYS = ['Thứ 2 – Thứ 6', 'Thứ 2 – Thứ 7', 'Thứ 2 – sáng Thứ 7', 'Làm theo ca'];

export const ROADMAP_MILESTONES = ['Ngày đầu tiên', 'Sau 3 ngày', 'Sau 10 ngày', 'Sau 1 tháng', 'Sau 2 tháng'] as const;
export const ROADMAP_ITEM_MAX = 200;
export const BENEFIT_MAX = 80;
export const MAX_BENEFITS = 20;

export interface BenefitOption {
  label: string;
  /** Ticked on a new job. */
  standard: boolean;
}

export interface JobTemplate {
  workDays: string;
  /** HH:mm */
  startTime: string;
  endTime: string;
  benefits: BenefitOption[];
  /** One text per ROADMAP_MILESTONES entry. */
  roadmap: string[];
  /** Choices in the job form; HR adds more there ("+ Thêm mới") or in "Mẫu tin". */
  departments: string[];
  experiences: string[];
  educations: string[];
  /** Common requirement lines HR ticks into "Yêu cầu" (one line each). */
  requirementOptions: string[];
  /** Common nice-to-have lines HR ticks into "Ưu tiên (không bắt buộc)". */
  preferredOptions: string[];
}

export const DEFAULT_JOB_TEMPLATE: JobTemplate = {
  workDays: 'Thứ 2 – Thứ 7',
  startTime: '08:00',
  endTime: '17:30',
  benefits: [
    { label: 'Lương tháng 13', standard: true },
    { label: 'Thưởng theo kết quả công việc', standard: true },
    { label: 'Thưởng lễ, Tết', standard: true },
    { label: 'Đóng BHXH, BHYT, BHTN đầy đủ', standard: true },
    { label: '12 ngày phép/năm', standard: true },
    { label: 'Khám sức khỏe định kỳ', standard: true },
    { label: 'Du lịch, team building hằng năm', standard: true },
    { label: 'Đào tạo, kèm cặp khi mới vào', standard: true },
    { label: 'Xét tăng lương hằng năm', standard: true },
    { label: 'Phụ cấp ăn trưa', standard: false },
    { label: 'Phụ cấp gửi xe, xăng', standard: false },
    { label: 'Hoa hồng', standard: false },
  ],
  roadmap: [
    'Nhận máy, tài khoản; gặp quản lý và cả nhóm.',
    'Nắm quy trình làm việc của phòng, làm việc nhỏ cùng người kèm.',
    'Tự làm công việc hằng ngày, người kèm xem lại.',
    'Làm độc lập phần việc chính, thống nhất mục tiêu thử việc với quản lý.',
    'Đánh giá cùng quản lý và ký hợp đồng chính thức.',
  ],
  departments: DEPARTMENT_SUGGESTIONS,
  experiences: EXPERIENCE_OPTIONS,
  educations: EDUCATION_OPTIONS,
  requirementOptions: [
    'Giao tiếp rõ ràng, chủ động',
    'Thành thạo tin học văn phòng (Word, Excel)',
    'Cẩn thận, trung thực, có trách nhiệm',
    'Làm việc nhóm tốt',
    'Chịu được áp lực công việc',
    'Có laptop cá nhân',
    'Có phương tiện đi lại',
    'Đọc hiểu tiếng Anh cơ bản',
    'Có thể đi làm ngay',
  ],
  preferredOptions: [
    'Có kinh nghiệm trong ngành',
    'Đã dùng CRM hoặc phần mềm quản lý khách hàng',
    'Tiếng Anh giao tiếp',
    'Có sẵn mạng lưới khách hàng',
  ],
};

export const CHOICE_MAX = 60;
export const CHOICES_MAX = 30;

export const standardBenefits = (template: JobTemplate): string[] =>
  template.benefits.filter((b) => b.standard).map((b) => b.label);

/** "08:00" -> "8:00" */
const shortTime = (time: string) => time.replace(/^0(\d)/, '$1');

/** "Thứ 2 – Thứ 7, 8:00 – 17:30" */
export function composeWorkingHours(days: string, start: string, end: string): string {
  return `${days}, ${shortTime(start)} – ${shortTime(end)}`;
}

export interface WorkingHoursParts {
  days: string;
  start: string;
  end: string;
}

/** Reads back a value made by composeWorkingHours; null for anything typed by hand. */
export function parseWorkingHours(text: string): WorkingHoursParts | null {
  const match = /^(.+), (\d{1,2}):(\d{2}) – (\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match || !WORK_DAYS.includes(match[1])) return null;
  const pad = (h: string, m: string) => `${h.padStart(2, '0')}:${m}`;
  return { days: match[1], start: pad(match[2], match[3]), end: pad(match[4], match[5]) };
}
