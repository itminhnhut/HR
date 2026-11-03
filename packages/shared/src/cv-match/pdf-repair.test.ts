import { describe, expect, it } from 'vitest';
import { buildCvDoc, cleanLine, fold } from './normalize.js';
import { repairLayout } from './pdf-repair.js';
import { scoreCv } from './score.js';
import type { MatchVerdict } from './types.js';

function verdict(cvText: string, requirement: string): MatchVerdict | undefined {
  return scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0]?.verdict;
}

describe('characters PDF fonts leave behind', () => {
  it('should remove a soft hyphen and zero-width characters inside a word', () => {
    // Act
    const clean = cleanLine('Pho­to​shop');

    // Assert
    expect(clean).toBe('Photoshop');
  });

  it('should read Ð as Đ', () => {
    // Act
    const folded = fold('Ðại học Ðà Lạt');

    // Assert
    expect(folded).toBe('dai hoc da lat');
  });

  it('should turn private-use bullets into list items', () => {
    // Act
    const lines = repairLayout(' Excel\n Word');

    // Assert
    expect(lines.map(cleanLine)).toEqual(['- Excel', '- Word']);
  });
});

describe('letter spacing', () => {
  it('should close up a letter-spaced heading and keep its word gaps', () => {
    // Act
    const doc = buildCvDoc('K Ỹ   N Ă N G\nExcel');

    // Assert
    expect(doc.lines[0]?.text).toBe('KỸ NĂNG');
    expect(doc.lines[0]?.section).toBe('skills');
  });

  it('should close up letter-spaced skills', () => {
    // Arrange
    const cv = `Hồ Tâm Anh, nhân viên văn phòng\nK Ỹ   N Ă N G\nW o r d ,  C a n v a\nKINH NGHIỆM\n2022 - nay Nhân viên, Công ty Việt`;

    // Act
    const got = verdict(cv, 'Biết Canva');

    // Assert
    expect(got).toBe('met');
  });

  it('should leave an ordinary line of short words alone', () => {
    // Act
    const lines = repairLayout('Bằng A B C hạng xe tải nặng');

    // Assert
    expect(lines).toEqual(['Bằng A B C hạng xe tải nặng']);
  });

  it('should close up spaced digits of a year', () => {
    // Act
    const lines = repairLayout('2 0 1 8 - 2 0 2 2: Kế toán');

    // Assert
    expect(lines).toEqual(['2018 - 2022: Kế toán']);
  });
});

describe('words broken across lines', () => {
  it('should rejoin a word hyphenated over a line break', () => {
    // Act
    const lines = repairLayout('Thành thạo Power-\nPoint, Photo-\nshop');

    // Assert
    expect(lines).toEqual(['Thành thạo PowerPoint, Photoshop']);
  });

  it('should keep a date range together', () => {
    // Act
    const lines = repairLayout('Kế toán\n05/2020 –\nnay\n2015 -\n2019');

    // Assert
    expect(lines).toEqual(['Kế toán', '05/2020 – nay', '2015 - 2019']);
  });

  it('should carry on a line wrapped by the PDF', () => {
    // Act
    const lines = repairLayout('Chuyên ngành: Quản trị\nkinh doanh\nKinh nghiệm');

    // Assert
    expect(lines).toEqual(['Chuyên ngành: Quản trị kinh doanh', 'Kinh nghiệm']);
  });

  it('should not merge lines of a CV typed in lower case', () => {
    // Act
    const lines = repairLayout('ho tam\nke toan\nexcel\nword');

    // Assert
    expect(lines).toHaveLength(4);
  });
});

describe('words split by a stray space', () => {
  it.each([
    ['Thành th ạo', 'Thành thạo'],
    ['H ọc vấn', 'Học vấn'],
    ['phần m ềm', 'phần mềm'],
    ['Kinh nghi ệm', 'Kinh nghiệm'],
    ['Ngo ại ngữ', 'Ngoại ngữ'],
    ['Kế to án viên', 'Kế toán viên'],
    ['biết Ex cel', 'biết Excel'],
    ['TOE IC 700', 'TOEIC 700'],
  ])('should rejoin "%s"', (raw, want) => {
    // Act
    const lines = repairLayout(raw);

    // Assert
    expect(lines).toEqual([want]);
  });

  it('should leave an abbreviation before a name alone', () => {
    // Act
    const lines = repairLayout('TP Ánh Dương, TS Ánh');

    // Assert
    expect(lines).toEqual(['TP Ánh Dương, TS Ánh']);
  });
});

describe('two columns read side by side', () => {
  const cv = `LÊ MINH                KINH NGHIỆM LÀM VIỆC
HỌC VẤN                 03/2020 - nay
2012 - 2016             Công ty TNHH Dệt Hòa Thọ
Đại học Đà Nẵng         Nhân viên kế toán
KỸ NĂNG                 Lập sổ sách
Không có laptop         Sử dụng tốt Excel`;

  it('should not take school years in the left column for work', () => {
    // Act
    const got = verdict(cv, 'Từ 8 năm kinh nghiệm');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should not let a negation in one column reach the other', () => {
    // Act
    const got = verdict(cv, 'Biết Excel');

    // Assert
    expect(got).toBe('met');
  });

  it('should keep a date set to the right on the line of its job', () => {
    // Arrange
    const single = `Phan Hà
KINH NGHIỆM LÀM VIỆC
Công ty Sao Mai – Nhân viên kho      03/2020 – nay
Kiểm kê hàng hóa
HỌC VẤN
Cao đẳng Công Thương – Kế toán      2015 – 2018`;

    // Act
    const years = verdict(single, 'Từ 5 năm kinh nghiệm kho');
    const degree = verdict(single, 'Cao đẳng trở lên');

    // Assert
    expect(years).toBe('met');
    expect(degree).toBe('met');
  });

  it('should not split a line with one wide gap in an otherwise ordinary CV', () => {
    // Act
    const lines = repairLayout('Nguyễn An   0912000111\nKinh nghiệm\nKế toán');

    // Assert
    expect(lines).toEqual(['Nguyễn An   0912000111', 'Kinh nghiệm', 'Kế toán']);
  });
});

describe('a whole CV on one line', () => {
  const cv =
    'ĐỖ HÀ MY Kế toán viên KINH NGHIỆM LÀM VIỆC 2019 - nay: Kế toán, Công ty Hòa Bình HỌC VẤN Cao đẳng Kinh tế Đối ngoại KỸ NĂNG Word, Excel. Mong muốn học thêm SAP.';

  it('should restore the sections from the capital headings', () => {
    // Act
    const doc = buildCvDoc(cv);

    // Assert
    expect(doc.lines.map((l) => l.section)).toContain('education');
    expect(doc.lines.map((l) => l.section)).toContain('experience');
  });

  it('should read the work, the study and the skills', () => {
    // Act
    const verdicts = ['Từ 5 năm kinh nghiệm', 'Cao đẳng trở lên', 'Biết Excel', 'Biết SAP'].map((r) => verdict(cv, r));

    // Assert
    expect(verdicts).toEqual(['met', 'met', 'met', 'unmet']);
  });
});

describe('two columns the first pass missed', () => {
  it('should keep letter-spaced headings of two columns apart', () => {
    // Act
    const lines = repairLayout(
      'K I N H  N G H I Ệ M    H Ọ C  V Ấ N\n01/2023 - nay           Đại học Xây dựng\nCông ty Hoa Sen         Hà Nội, 2022',
      (cell) => /^(?:KINH NGHIỆM|HỌC VẤN)$/.test(cell),
    );

    // Assert
    expect(lines).toEqual([
      'KINH NGHIỆM',
      '01/2023 - nay',
      'Công ty Hoa Sen',
      'HỌC VẤN',
      'Đại học Xây dựng',
      'Hà Nội, 2022',
    ]);
  });

  it('should keep the words of one letter-spaced title together', () => {
    // Act
    const lines = repairLayout('D Ư Ợ C  S Ĩ   Đ Ạ I  H Ọ C\nMai Lan');

    // Assert
    expect(lines).toEqual(['DƯỢC SĨ ĐẠI HỌC', 'Mai Lan']);
  });

  it('should collapse a letter-spaced heading standing in one cell', () => {
    // Arrange
    const text = [
      'K I N H  N G H I Ệ M    H Ọ C  V Ấ N',
      'Công ty Hoa Sen         Đại học Xây dựng',
      'Tư vấn khách           C H Ứ N G  C H Ỉ',
      'hàng mỗi ngày          Chứng chỉ nghề hàn',
    ].join('\n');

    // Act
    const doc = buildCvDoc(text);

    // Assert
    expect(doc.lines.find((l) => l.folded === 'chung chi')?.section).toBe('certificates');
  });

  it('should split columns without a heading when several rows read on in the right column', () => {
    // Arrange
    const text = [
      'Mai Lan               Từ 2015 đến nay: lái xe tải thùng 15',
      'Bằng lái:             tấn, Công ty Vận tải Thành Công, Hà Nội',
      'Hạng C                đi Lạng Sơn, Quảng Ninh, Cao Bằng, Hà',
      'Hạn: 2028             Giang. Chạy đêm, đi nhiều ngày.',
    ].join('\n');

    // Act
    const lines = repairLayout(text);

    // Assert
    expect(lines.slice(0, 4)).toEqual(['Mai Lan', 'Bằng lái:', 'Hạng C', 'Hạn: 2028']);
    expect(lines[4]).toContain('Từ 2015 đến nay: lái xe tải thùng 15 tấn, Công ty');
  });

  it('should score a CV in two columns without a heading', () => {
    // Arrange
    const cv = [
      'Mai Lan               Từ 2015 đến nay: lái xe tải thùng 15',
      'Bằng lái:             tấn, Công ty Vận tải Thành Công, Hà Nội',
      'Hạng C                đi Lạng Sơn, Quảng Ninh, Cao Bằng, Hà',
      'Hạn: 2028             Giang. Chạy đêm, đi nhiều ngày.',
    ].join('\n');

    // Act
    const experience = verdict(cv, 'Có ít nhất 3 năm kinh nghiệm lái xe tải');
    const licence = verdict(cv, 'Có bằng lái xe hạng C trở lên');

    // Assert
    expect(experience).toBe('met');
    expect(licence).toBe('met');
  });

  it('should not split a date set to the right of each job', () => {
    // Arrange
    const text = [
      'Kế toán - Công ty Hoa Sen      03/2021 - nay',
      'Kế toán viên - Công ty Thái    01/2019 - 02/2021',
      'Thu ngân - Siêu thị Co.op      01/2017 - 12/2018',
    ].join('\n');

    // Act
    const lines = repairLayout(text);

    // Assert
    expect(lines).toHaveLength(3);
  });

  it('should join a word hyphenated in the left column', () => {
    // Arrange
    const text = 'KINH NGHIỆM      HỌC VẤN\nNhà thuốc Pha-   Đại học Dược\nna, dược sĩ.     2022';

    // Act
    const lines = repairLayout(text, (cell) => /^(?:KINH NGHIỆM|HỌC VẤN)$/.test(cell));

    // Assert
    expect(lines).toContain('Nhà thuốc Phana, dược sĩ.');
  });
});

describe('text a broken font left as codes', () => {
  it('should read "(cid:NN)" sequences as no text at all', () => {
    // Arrange
    const raw =
      '(cid:36)(cid:72)(cid:79)(cid:80)(cid:3)(cid:42)(cid:76)(cid:105)(cid:82)(cid:3)(cid:89)\n(cid:21)(cid:19)(cid:20)';

    // Act
    const doc = buildCvDoc(raw);

    // Assert
    expect(doc.letterCount).toBe(0);
  });
});
