/** Sample jobs that mirror the mockup. Run: npm run db:seed -w @careers/api */
import { addDays, todayInVietnam } from '@careers/shared';
import { getDb } from '../src/db/index.js';
import { jobs, type NewJob } from '../src/db/schema.js';
import { slugify } from '../src/lib/slug.js';

const today = todayInVietnam();
const now = new Date();

const samples: Omit<NewJob, 'slug'>[] = [
  {
    title: 'Nhân viên Kinh doanh B2B',
    department: 'Kinh doanh',
    city: 'TP. HCM',
    address: '[Địa chỉ], Quận 3, TP. HCM',
    workingHours: 'T2 – T6, 8:30 – 17:30',
    experience: 'Từ 1 năm',
    headcount: 2,
    salaryMin: 12,
    salaryMax: 18,
    salaryNote: 'hoa hồng',
    responsibilities:
      'Tìm và tiếp cận khách hàng doanh nghiệp mới qua điện thoại, email và gặp trực tiếp\nTư vấn giải pháp, gửi báo giá và theo dõi đến khi ký hợp đồng\nChăm sóc khách hàng hiện có, mở rộng đơn hàng định kỳ',
    requirements:
      'Tối thiểu 1 năm kinh nghiệm bán hàng, ưu tiên B2B\nGiao tiếp rõ ràng, chủ động\nCó phương tiện đi lại',
    benefits: 'Lương tháng 13\nBHXH, BHYT đầy đủ\nĐào tạo sản phẩm và kỹ năng bán hàng',
    plan30: 'Học sản phẩm, quy trình bán hàng, đi gặp khách cùng trưởng nhóm',
    plan60: 'Quản lý danh sách khách hàng riêng, tự tư vấn và báo giá',
    plan90: 'Đạt chỉ tiêu doanh số đầu tiên',
    deadline: addDays(today, 30),
    state: 'published',
    publishedAt: now,
  },
  {
    title: 'Lập trình viên Frontend (React)',
    department: 'Kỹ thuật',
    city: 'Hà Nội',
    remote: true,
    experience: 'Từ 2 năm',
    salaryMin: 20,
    salaryMax: 30,
    responsibilities: 'Xây dựng giao diện web bằng React và TypeScript\nPhối hợp với thiết kế và backend',
    requirements: 'Từ 2 năm làm React\nQuen TypeScript',
    benefits: 'Làm hybrid\nCấp laptop',
    deadline: addDays(today, 40),
    state: 'published',
    publishedAt: now,
  },
  {
    title: 'Chuyên viên Tuyển dụng',
    department: 'Nhân sự',
    city: 'TP. HCM',
    salaryMin: 12,
    salaryMax: 16,
    responsibilities: 'Đăng tin, sàng lọc hồ sơ, hẹn phỏng vấn',
    benefits: 'BHXH đầy đủ\n12 ngày phép',
    deadline: addDays(today, 2),
    state: 'published',
    publishedAt: now,
  },
  {
    title: 'Nhân viên Chăm sóc khách hàng',
    department: 'Vận hành',
    city: 'Đà Nẵng',
    salaryMin: 9,
    salaryMax: 12,
    responsibilities: 'Trả lời khách hàng qua điện thoại và chat',
    benefits: 'Ca hành chính\nThưởng KPI',
    deadline: addDays(today, 20),
    state: 'published',
    publishedAt: now,
  },
  {
    title: 'Thực tập sinh Kinh doanh',
    department: 'Kinh doanh',
    employmentType: 'internship',
    city: 'TP. HCM',
    salaryMin: 4,
    salaryMax: 4,
    responsibilities: 'Hỗ trợ đội kinh doanh tìm khách hàng',
    benefits: 'Có cơ hội lên chính thức',
    deadline: addDays(today, 45),
    state: 'published',
    publishedAt: now,
  },
  {
    title: 'Kế toán tổng hợp',
    department: 'Vận hành',
    city: 'TP. HCM',
    responsibilities: 'Hạch toán, lập báo cáo thuế',
    deadline: addDays(today, 30),
    state: 'draft',
  },
];

await getDb()
  .insert(jobs)
  .values(samples.map((job) => ({ ...job, slug: slugify(job.title) })));
console.log(`Seeded ${samples.length} jobs.`);
