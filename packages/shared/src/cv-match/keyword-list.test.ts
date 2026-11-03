import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';
import type { CvMatchResult, MatchItem } from './types.js';

const TODAY = '2026-11-03';

function judge(cvText: string, requirement: string): MatchItem {
  return scoreCv({ cvText, requirements: [requirement], today: TODAY }).items[0];
}

function score(cvText: string, requirements: string[]): CvMatchResult {
  return scoreCv({ cvText, requirements, today: TODAY });
}

/** A CV with a header block and a job that has nothing to do with office or design software. */
function cv(...lines: string[]): string {
  return ['Nguyễn Văn An', 'Email: an.nguyen@example.com - Điện thoại: 0912 345 678', ...lines].join('\n');
}

const SHOP_JOB = [
  'KINH NGHIỆM',
  '03/2023 - nay: Nhân viên bán hàng, Cửa hàng điện máy Thành Đạt',
  'Tư vấn và bán tivi, tủ lạnh',
];
const DUMP = 'Photoshop, Illustrator, InDesign, Figma, SQL, Python, Power BI, MISA, Excel, Word';

describe('keyword list with nothing behind it', () => {
  it('should leave a tool open, not met, when it appears only in a long list and the work is unrelated', () => {
    // Arrange
    const text = cv('Từ khóa: ' + DUMP, ...SHOP_JOB);

    // Act
    const item = judge(text, 'Thành thạo Photoshop');

    // Assert
    expect(item.verdict).toBe('unknown');
    expect(item.reason).toContain('Photoshop');
    expect(item.reason).toContain('danh sách từ khoá');
    expect(item.reason).toContain('HR xem thêm');
    expect(item.evidence).toContain('Photoshop');
  });

  it('should keep such a line counted so that it lowers the percent', () => {
    // Arrange
    const text = cv('Từ khóa: ' + DUMP, ...SHOP_JOB);

    // Act
    const result = score(text, ['Thành thạo Photoshop', 'Có 1 năm kinh nghiệm']);

    // Assert
    expect(result.items[0].counted).toBe(true);
    expect(result.percent).toBe(50);
  });

  it('should find the same list under a skills heading', () => {
    expect(judge(cv('KỸ NĂNG', DUMP, ...SHOP_JOB), 'Biết Python').verdict).toBe('unknown');
  });

  it('should not let a degree written inside the list back the list', () => {
    // Arrange
    const list =
      'Đại học Kế toán, kế toán tổng hợp, kiểm toán, MISA, Excel, kê khai thuế, báo cáo tài chính, tài chính';
    const text = cv('Từ khóa: ' + list, ...SHOP_JOB, 'HỌC VẤN', 'Tốt nghiệp THPT Lê Lợi, 2020');

    // Act
    const item = judge(text, 'Sử dụng phần mềm kế toán MISA');

    // Assert
    expect(item.verdict).toBe('unknown');
  });

  it('should leave a tool open when the requirement is met through a group the list names', () => {
    const list = 'HubSpot, Photoshop, Illustrator, InDesign, Figma, SQL, Python, Power BI, MISA';
    expect(judge(cv('Từ khóa: ' + list, ...SHOP_JOB), 'Biết sử dụng CRM').verdict).toBe('unknown');
  });

  it('should leave "tin học văn phòng" open when Word and Excel are both only in the list', () => {
    expect(judge(cv('Từ khóa: ' + DUMP, ...SHOP_JOB), 'Sử dụng tốt tin học văn phòng').verdict).toBe('unknown');
  });

  it('should leave an either-or requirement open and name the option in the list', () => {
    const item = judge(cv('Từ khóa: ' + DUMP, ...SHOP_JOB), 'Power BI hoặc Tableau');
    expect(item.verdict).toBe('unknown');
    expect(item.reason).toContain('danh sách từ khoá');
  });

  it('should still say not met for what the list does not name', () => {
    const item = judge(cv('Từ khóa: ' + DUMP, ...SHOP_JOB), 'Thành thạo Photoshop, AutoCAD');
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('AutoCAD');
  });

  it('should treat a bonus found only in the list as open and not counted', () => {
    const item = judge(cv('Từ khóa: ' + DUMP, ...SHOP_JOB), 'Ưu tiên biết Figma');
    expect(item.verdict).toBe('unknown');
    expect(item.counted).toBe(false);
  });

  it('should not lift the rest of a list because the job happens to use one item', () => {
    // Arrange
    const job = [
      'KINH NGHIỆM',
      '2024 - nay: Nhân viên nhập liệu, Công ty Bảo hiểm Toàn Cầu',
      'Nhập hồ sơ khách hàng vào Excel',
    ];
    const text = cv('Từ khóa: ' + DUMP, ...job);

    // Act and Assert
    expect(judge(text, 'Biết dùng Excel').verdict).toBe('met');
    expect(judge(text, 'Thành thạo Photoshop').verdict).toBe('unknown');
  });
});

describe('honest skills list', () => {
  const ACCOUNTANT_JOB = [
    'KINH NGHIỆM',
    '04/2020 - nay: Kế toán tổng hợp, Công ty Thực phẩm Minh Châu',
    'Lập báo cáo thuế hàng tháng',
  ];

  it('should stay met for a short list under skills, whatever the work says', () => {
    const text = cv('Kỹ năng: Excel, Word, MISA', ...ACCOUNTANT_JOB);
    expect(judge(text, 'Sử dụng phần mềm kế toán MISA').verdict).toBe('met');
    expect(judge(text, 'Thành thạo Excel').verdict).toBe('met');
  });

  it('should stay met for a short list next to an unrelated job', () => {
    expect(judge(cv('Kỹ năng: Excel, Word, MISA', ...SHOP_JOB), 'Thành thạo Excel').verdict).toBe('met');
  });

  it('should stay met for a long list when the work shows several of its items', () => {
    // Arrange
    const list = 'Java, Spring Boot, PostgreSQL, Redis, Docker, Kubernetes, Git, Linux, AWS, Kafka';
    const job = [
      'KINH NGHIỆM',
      '2021 - nay: Lập trình viên, Công ty Phần mềm An Khang',
      'Xây dựng API bằng Java, Spring Boot',
    ];

    // Act
    const item = judge(cv('Kỹ năng: ' + list, ...job), 'Biết Docker');

    // Assert
    expect(item.verdict).toBe('met');
  });

  it('should stay met for a long list when education shows several of its items', () => {
    const list = 'Python, SQL, Photoshop, Illustrator, InDesign, Figma, Excel, Word';
    const school = ['HỌC VẤN', '2019 - 2023: Đại học Bách Khoa, chuyên ngành Khoa học dữ liệu, đồ án Python và SQL'];
    expect(judge(cv('Kỹ năng: ' + list, ...SHOP_JOB, ...school), 'Biết Figma').verdict).toBe('met');
  });

  it('should stay met for a long list naming a trade the candidate works in', () => {
    // Arrange
    const list = 'HVAC, AutoCAD, Revit, Excel, Word, Photoshop, Figma, SQL';
    const job = ['KINH NGHIỆM', '2020 - nay: Kỹ sư cơ điện, Công ty Cơ Điện Tân Hưng', 'Giám sát công trường'];

    // Act
    const item = judge(cv('Kỹ năng: ' + list, ...job), 'Biết AutoCAD');

    // Assert
    expect(item.verdict).toBe('met');
  });

  it('should stay met when the tool is also mentioned outside the list', () => {
    const text = cv('Từ khóa: ' + DUMP, 'Thành thạo Photoshop', ...SHOP_JOB);
    expect(judge(text, 'Thành thạo Photoshop').verdict).toBe('met');
  });

  it('should stay met for a list written inside a job', () => {
    const job = ['KINH NGHIỆM', '2021 - nay: Thiết kế, Công ty Quảng cáo Sao Biển', DUMP];
    expect(judge(cv(...job), 'Thành thạo Photoshop').verdict).toBe('met');
  });

  it('should stay met for a long list under certificates', () => {
    const list = 'MOS Excel, IC3, CCNA, TOEIC 700, PMP, CPA, ACCA, CFA';
    expect(judge(cv('CHỨNG CHỈ', list, ...SHOP_JOB), 'Có chứng chỉ PMP').verdict).toBe('met');
  });

  it('should stay met for a dated job line the work history could not read as a job', () => {
    const line =
      'Trường Tiểu học Lê Quý Đôn, Huế (08/2022 - hiện tại): chủ nhiệm lớp 1, lớp 2, Toán, Tiếng Việt, Excel, Word, PowerPoint';
    expect(judge(cv(line), 'Thành thạo Excel').verdict).toBe('met');
  });

  it('should not question an asset in a list, because work never shows one', () => {
    const list = DUMP + ', xe máy riêng, laptop cá nhân';
    expect(judge(cv('Từ khóa: ' + list, ...SHOP_JOB), 'Có laptop').verdict).toBe('met');
  });

  it('should keep the existing verdict for a trade term with no support', () => {
    const list = 'HVAC, AutoCAD, Revit, Excel, Word, Photoshop, Figma, SQL';
    expect(judge(cv('Từ khóa: ' + list, ...SHOP_JOB), 'Có kiến thức HVAC').verdict).toBe('unmet');
  });

  it('should keep a level the list states as basic', () => {
    const list = 'Excel cơ bản, Photoshop, Illustrator, InDesign, Figma, SQL, Python, Power BI';
    expect(judge(cv('Từ khóa: ' + list, ...SHOP_JOB), 'Thành thạo Excel').verdict).toBe('unmet');
  });
});
