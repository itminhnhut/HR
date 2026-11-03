// Filler for the cv-bot contact set. Deliberately NOT the tuning corpus' filler (scripts/cv-contact/filler.mjs):
// new companies, schools and section wording, so nothing here was seen while the parser was tuned.
// Every company, school and person is invented.

export function rng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
}

export const pick = (r, list) => list[Math.floor(r() * list.length)];

export function shuffled(r, list) {
  return list
    .map((v) => [r(), v])
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);
}

export const stripDiacritics = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

const COMPANIES = {
  vi: [
    'Công ty TNHH Bao Bì Sông Lam',
    'Công ty CP Thực Phẩm Đồng Xanh',
    'Công ty TNHH Giải Pháp Phần Mềm Mây Trắng',
    'Công ty CP Vận Tải Biển Hải Âu',
    'Tập đoàn Nội Thất Gỗ Việt Mộc',
    'Công ty TNHH Dược Phẩm Thiên Thảo',
    'Công ty CP Địa Ốc Phú Khang',
    'Công ty TNHH Thời Trang Lụa Hà',
  ],
  en: [
    'Song Lam Packaging Co., Ltd',
    'Green Field Foods JSC',
    'White Cloud Software Co., Ltd',
    'Seagull Shipping JSC',
    'Vietmoc Furniture Group',
    'Thien Thao Pharma Co., Ltd',
    'Phu Khang Realty JSC',
    'Lua Ha Fashion Co., Ltd',
  ],
};

const BULLETS = {
  vi: [
    'Lập kế hoạch công việc hàng tuần và báo cáo tiến độ cho trưởng bộ phận',
    'Phối hợp với các phòng ban để xử lý hồ sơ đúng hạn',
    'Theo dõi số liệu, tổng hợp báo cáo tháng và đề xuất cải tiến quy trình',
    'Chăm sóc khách hàng cũ, tăng tỷ lệ gia hạn hợp đồng thêm 12%',
    'Hướng dẫn hai nhân viên mới làm quen công việc',
    'Kiểm soát chứng từ, đối chiếu công nợ với nhà cung cấp',
  ],
  en: [
    'Planned weekly work and reported progress to the team lead',
    'Worked with other departments to close files on time',
    'Tracked figures, prepared monthly reports and proposed process changes',
    'Looked after existing clients, raising renewals by 12%',
    'Mentored two new colleagues during onboarding',
    'Checked vouchers and reconciled supplier balances',
  ],
};

const POSITIONS = {
  vi: ['Chuyên viên', 'Nhân viên', 'Trưởng nhóm', 'Trợ lý'],
  en: ['Specialist', 'Officer', 'Team Lead', 'Assistant'],
};

const SCHOOLS = {
  vi: [
    'Đại học Hoa Phượng',
    'Cao đẳng Kinh tế Bình Minh',
    'Đại học Công nghệ Sao Khuê',
    'Học viện Tài chính Ánh Dương',
  ],
  en: [
    'Hoa Phuong University',
    'Binh Minh College of Economics',
    'Sao Khue University of Technology',
    'Anh Duong Academy of Finance',
  ],
};

const MAJORS = {
  vi: ['Quản trị kinh doanh', 'Kế toán', 'Công nghệ thông tin', 'Ngôn ngữ Anh', 'Logistics'],
  en: ['Business Administration', 'Accounting', 'Information Technology', 'English Language', 'Logistics'],
};

const SKILLS = {
  vi: [
    'Tin học văn phòng',
    'Giao tiếp',
    'Làm việc nhóm',
    'Tiếng Anh TOEIC 650',
    'Quản lý thời gian',
    'Phân tích số liệu',
  ],
  en: ['MS Office', 'Communication', 'Teamwork', 'TOEIC 650', 'Time management', 'Data analysis'],
};

const SUMMARY = {
  vi: 'Có kinh nghiệm thực tế, chủ động trong công việc và mong muốn gắn bó lâu dài với doanh nghiệp.',
  en: 'Hands-on experience, self-driven at work and looking for a long-term role.',
};

export const HEADS = {
  vi: {
    summary: ['GIỚI THIỆU BẢN THÂN', 'Tóm tắt', 'ĐỊNH HƯỚNG'],
    exp: ['QUÁ TRÌNH CÔNG TÁC', 'Kinh nghiệm', 'KINH NGHIỆM CHUYÊN MÔN'],
    edu: ['TRÌNH ĐỘ HỌC VẤN', 'Học vấn', 'ĐÀO TẠO'],
    skills: ['KỸ NĂNG NỔI BẬT', 'Kỹ năng', 'NĂNG LỰC'],
    contact: ['THÔNG TIN LIÊN LẠC', 'Liên hệ', 'LIÊN HỆ VỚI TÔI'],
    refs: ['NGƯỜI XÁC NHẬN', 'Người tham khảo', 'THAM CHIẾU'],
    personal: ['THÔNG TIN THÊM', 'Thông tin cá nhân', 'VỀ TÔI'],
  },
  en: {
    summary: ['PROFILE', 'Summary', 'ABOUT ME'],
    exp: ['EMPLOYMENT HISTORY', 'Experience', 'CAREER HISTORY'],
    edu: ['ACADEMIC BACKGROUND', 'Education', 'QUALIFICATIONS'],
    skills: ['CORE SKILLS', 'Skills', 'STRENGTHS'],
    contact: ['GET IN TOUCH', 'Contact', 'CONTACT DETAILS'],
    refs: ['REFEREES', 'References', 'REFERENCE CONTACTS'],
    personal: ['PERSONAL INFORMATION', 'Personal', 'MORE ABOUT ME'],
  },
};

/** Text pieces for one case; `seed` keeps a case stable between runs. */
export function fillerFor(seed, lang, pages = 1) {
  const r = rng(seed);
  const l = lang === 'en' ? 'en' : 'vi';
  const jobCount = pages > 1 ? 6 * pages : 2;
  const jobs = Array.from({ length: jobCount }, (_, i) => {
    const end = 2025 - i;
    const m1 = String(1 + Math.floor(r() * 12)).padStart(2, '0');
    const m2 = String(1 + Math.floor(r() * 12)).padStart(2, '0');
    return {
      head: `${pick(r, POSITIONS[l])} – ${pick(r, COMPANIES[l])}`,
      period: `${m1}/${end - 1} – ${m2}/${end}`,
      bullets: [pick(r, BULLETS[l]), pick(r, BULLETS[l])],
    };
  });
  const headOf = (key) => pick(r, HEADS[l][key]);
  return {
    jobs,
    summary: SUMMARY[l],
    school: pick(r, SCHOOLS[l]),
    major: pick(r, MAJORS[l]),
    years: `${2012 + Math.floor(r() * 6)} – ${2018 + Math.floor(r() * 5)}`,
    skills: [pick(r, SKILLS[l]), pick(r, SKILLS[l]), pick(r, SKILLS[l])],
    heads: {
      summary: headOf('summary'),
      exp: headOf('exp'),
      edu: headOf('edu'),
      skills: headOf('skills'),
      contact: headOf('contact'),
      refs: headOf('refs'),
      personal: headOf('personal'),
    },
    r,
  };
}
