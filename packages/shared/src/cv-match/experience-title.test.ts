import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';
import type { MatchItem } from './types.js';

function judge(cvText: string, requirement: string): MatchItem {
  const item = scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0];
  if (!item) throw new Error('no item');
  return item;
}

describe('the role line above a job that names only its company', () => {
  it('should prove the field for that job', () => {
    // Arrange
    const cv = 'Mai Lan\nThủ kho\nCông ty Hoa Sen, từ 2020 đến nay. Kiểm đếm, nhập xuất hàng.';

    // Act
    const got = judge(cv, 'Từ 2 năm kinh nghiệm thủ kho');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should not prove the field for a job that states another title', () => {
    // Arrange
    const cv = 'Mai Lan\nThủ kho\n2020 - nay: Nhân viên bán hàng, Công ty Hoa Sen. Tư vấn sản phẩm.';

    // Act
    const got = judge(cv, 'Từ 2 năm kinh nghiệm thủ kho');

    // Assert
    expect(got.verdict).toBe('unknown');
  });

  it('should not take the town of the employer for a title', () => {
    // Arrange
    const cv = 'Kinh nghiệm\n06/2020 - nay Khách sạn Đông Á, Huế\nĐiều vận viên. Sắp lịch xe.';

    // Act
    const got = judge(cv, 'Từ 1 năm ở vị trí điều vận viên');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should read a role written on the line under a job naming only its company', () => {
    // Arrange
    const cv = 'Kinh nghiệm\n06/2020 - nay Công ty Hoa Sen\nĐiều vận viên. Sắp lịch xe.';

    // Act
    const got = judge(cv, 'Từ 1 năm ở vị trí điều vận viên');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should read an assistant title as the role when the line asks for the assistant', () => {
    // Arrange
    const cv = '2020 - nay: Trợ lý Giám đốc, Công ty Hoa Sen.';

    // Act
    const asked = judge(cv, 'Từ 2 năm ở vị trí trợ lý giám đốc');
    const notAsked = judge(cv, 'Từ 2 năm ở vị trí giám đốc');

    // Assert
    expect(asked.verdict).toBe('met');
    expect(notAsked.verdict).not.toBe('met');
  });

  it('should leave a position open when the CV calls itself that role but the job title differs', () => {
    // Arrange
    const cv = 'Mai Lan\nĐiều vận viên\n2020 - nay: Phụ trách lịch xe, Công ty Hoa Sen.';

    // Act
    const got = judge(cv, 'Từ 1 năm ở vị trí điều vận viên');

    // Assert
    expect(got.verdict).toBe('unknown');
  });
});

describe('a specific field and a job showing only part of it', () => {
  it('should stay open when duties show the specific part without the role word', () => {
    // Arrange
    const cv = 'Trường Tiểu học Hoa Mai (2020 - nay): chủ nhiệm lớp 3, soạn giáo án.';

    // Act
    const got = judge(cv, 'Đã từng làm giáo viên chủ nhiệm lớp');

    // Assert
    expect(got.verdict).toBe('unknown');
  });

  it('should not leave a line open on one common word of its specific part', () => {
    // Arrange
    const cv = '2020 - nay: Giáo viên, Trường THCS Hoa Mai. Dạy Toán lớp 7.';

    // Act
    const got = judge(cv, 'Có kinh nghiệm dạy ở nước ngoài');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should not count another kind of driving for truck driving', () => {
    // Arrange
    const cv = '2018 - nay: Tài xế xe khách, Công ty Phương Trang.';

    // Act
    const got = judge(cv, 'Có ít nhất 3 năm kinh nghiệm lái xe tải');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should not count a general title in the same trade for the specific part', () => {
    // Arrange
    const cv = '2020 - nay: Giáo viên bộ môn Toán, Trường THCS Hoa Mai. Soạn giáo án.';

    // Act
    const got = judge(cv, 'Đã từng làm giáo viên chủ nhiệm lớp');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should count truck driving for a line asking only for a driver', () => {
    // Arrange
    const cv = '2018 - nay: Lái xe tải, Công ty Phương Trang.';

    // Act
    const got = judge(cv, 'Có ít nhất 3 năm kinh nghiệm lái xe');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should judge an experience line about driving on the job, not on a licence', () => {
    // Arrange: nothing in the CV mentions a licence; the line does not ask for one.
    const cv = '2018 - nay: Lái xe tải, Công ty Phương Trang.';

    // Act
    const got = judge(cv, 'Có ít nhất 3 năm kinh nghiệm lái xe tải');

    // Assert
    expect(got.verdict).toBe('met');
    expect(got.reason).not.toContain('bằng lái');
  });
});

describe('a job at a school the candidate works for', () => {
  it('should count a primary school as an employer without a heading', () => {
    // Arrange
    const cv = 'Mai Lan\nGiáo viên\n2018 - nay: Trường Tiểu học xã Yên Mỹ. Chủ nhiệm lớp 2, lớp 5.';

    // Act
    const got = judge(cv, 'Kinh nghiệm: Từ 3 năm');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should still read a university as study without a heading', () => {
    // Arrange
    const cv = 'Mai Lan\nSinh viên\n2018 - 2022: Trường Đại học Vinh, ngành Toán.';

    // Act
    const got = judge(cv, 'Kinh nghiệm: Từ 3 năm');

    // Assert
    expect(got.verdict).not.toBe('met');
  });
});

describe('words in the top lines that only look like contact details', () => {
  it('should read "qua điện thoại" as part of the role', () => {
    // Arrange
    const cv = 'Mai Lan\nChăm sóc khách hàng qua điện thoại\nCông ty Hoa Sen, từ 2023 đến nay. Trả lời khiếu nại.';

    // Act
    const got = judge(cv, 'Có kinh nghiệm chăm sóc khách hàng');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should not read a contact line as a role', () => {
    // Arrange
    const cv = 'Mai Lan\nĐiện thoại: chăm sóc khách hàng 0912\nCông ty Hoa Sen, từ 2023 đến nay. Trả lời khiếu nại.';

    // Act
    const got = judge(cv, 'Có kinh nghiệm chăm sóc khách hàng');

    // Assert
    expect(got.verdict).toBe('unmet');
  });
});

describe('a job in another language and a field with a specific part', () => {
  it('should stay open when the title shows the general word', () => {
    // Arrange
    const cv = 'Sao Khue School, Sep 2021 - Present: Class teacher of Grade 4. Lesson planning.';

    // Act
    const got = judge(cv, 'Đã từng làm giáo viên chủ nhiệm lớp');

    // Assert
    expect(got.verdict).toBe('unknown');
  });
});

describe('a claim written into a list of keywords', () => {
  it.each([
    ['Từ khóa: kho, nhập xuất tồn, kiểm kê, FIFO, Excel, 6 năm kinh nghiệm, trung cấp'],
    ['Thủ kho, nhập xuất tồn, kiểm kê, FIFO, Excel, 6 năm kinh nghiệm, trung cấp, trung thực'],
    ['Tags: kho nhập xuất tồn kiểm kê FIFO Excel 6 năm kinh nghiệm trung cấp'],
  ])('should not count the years in "%s"', (dump) => {
    // Arrange
    const cv = `Mai Lan\n${dump}\nCông việc: 2026 - nay, phụ bán hàng.\nHọc vấn: THPT`;

    // Act
    const got = judge(cv, 'Kinh nghiệm: Từ 3 năm');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should leave the line open and counted when only the list states the years', () => {
    // Arrange
    const dump = 'Từ khóa: kho, nhập xuất tồn, kiểm kê, FIFO, Excel, 6 năm kinh nghiệm, trung cấp, 5S';
    const cv = `Mai Lan\n${dump}\nHọc vấn: THPT`;

    // Act
    const got = judge(cv, 'Kinh nghiệm: Từ 3 năm');

    // Assert
    expect(got.verdict).toBe('unknown');
    expect(got.counted).toBe(true);
  });

  it('should keep the years of a long list the work history stands behind', () => {
    // Arrange
    const list = 'Kỹ năng: nhập xuất tồn, kiểm kê, FIFO, Excel, 5S, xe nâng, 6 năm kinh nghiệm, trung thực';
    const cv = `Mai Lan\n${list}\nKinh nghiệm\n2024 - nay: Thủ kho, Công ty A. Nhập xuất tồn, kiểm kê định kỳ.`;

    // Act
    const got = judge(cv, 'Kinh nghiệm: Từ 3 năm');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should still count years stated in a short summary', () => {
    // Arrange
    const cv = 'Mai Lan\nThủ kho, 6 năm kinh nghiệm, trung thực\nKỹ năng: Excel, FIFO';

    // Act
    const got = judge(cv, 'Kinh nghiệm: Từ 3 năm');

    // Assert
    expect(got.verdict).toBe('met');
  });
});
