import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';

const TODAY = '2026-11-03';
const CV = [
  'Nguyễn Văn A',
  'Kinh nghiệm làm việc',
  'Công ty ABC (01/2020 - 12/2024) Chuyên viên tuyển dụng',
  '- Đăng tin và sàng lọc hồ sơ ứng viên',
  '- Lập báo cáo tuyển dụng hàng tháng cho ban giám đốc',
  'Kỹ năng',
  'Excel, Word',
  'Mục tiêu nghề nghiệp',
  'Muốn học thêm về quản lý kho hàng',
].join('\n');

const score = (duties: string[], requirements: string[] = []) =>
  scoreCv({ cvText: CV, requirements, duties, today: TODAY });

describe('job description lines', () => {
  it('should mark a duty met and quote the work line when the history shows similar work', () => {
    const { items } = score(['Lập báo cáo tuyển dụng hàng tháng']);

    expect(items[0]).toMatchObject({ section: 'duties', verdict: 'met', counted: false });
    expect(items[0]?.evidence).toContain('Lập báo cáo tuyển dụng hàng tháng');
  });

  it('should leave a duty open, not unmet, when the CV says nothing about it', () => {
    const { items } = score(['Thương lượng hợp đồng vận chuyển quốc tế']);

    expect(items[0]).toMatchObject({ verdict: 'unknown', evidence: null });
    expect(items[0]?.reason).toContain('HR hỏi thêm');
  });

  it('should leave a duty open when it names a tool the CV is silent about', () => {
    const { items } = score(['Quản lý dữ liệu nhân sự trên SAP']);

    expect(items[0]?.verdict).toBe('unknown');
  });

  it('should mark a duty unmet when the CV says the candidate does not have the tool', () => {
    const cvText = `${CV}\nChưa biết sử dụng SAP`;

    const { items } = scoreCv({ cvText, requirements: [], duties: ['Quản lý dữ liệu nhân sự trên SAP'], today: TODAY });

    expect(items[0]?.verdict).toBe('unmet');
    expect(items[0]?.evidence).toContain('SAP');
  });

  it('should mark a duty met when the CV shows one of the several terms it names', () => {
    const { items } = score(['Dùng Excel và SAP để theo dõi dữ liệu']);

    expect(items[0]?.verdict).toBe('met');
    expect(items[0]?.reason).toContain('Excel');
  });

  it('should not take a wish in the objective as work done', () => {
    const { items } = score(['Quản lý kho hàng và kiểm kê']);

    expect(items[0]?.verdict).toBe('unknown');
  });

  it('should keep the percent on the requirements alone', () => {
    const without = score([], ['Biết Excel', 'Biết Photoshop']);
    const withDuties = score(['Lập báo cáo tuyển dụng hàng tháng', 'Quản lý dữ liệu trên SAP'], ['Biết Excel', 'Biết Photoshop']);

    expect(without.percent).toBe(50);
    expect(withDuties.percent).toBe(50);
  });

  it('should list the requirements first and mark only the duties', () => {
    const { items } = score(['Lập báo cáo tuyển dụng hàng tháng'], ['Biết Excel']);

    expect(items.map((i) => i.section)).toEqual([undefined, 'duties']);
  });

  it('should leave duties open with the reason when the CV has no readable text', () => {
    const { items, percent } = scoreCv({ cvText: '', requirements: [], duties: ['Lập báo cáo'], today: TODAY });

    expect(percent).toBeNull();
    expect(items[0]).toMatchObject({ section: 'duties', verdict: 'unknown' });
    expect(items[0]?.reason).toContain('Không đọc được');
  });
});
