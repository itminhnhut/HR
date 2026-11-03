import { describe, expect, it } from 'vitest';
import { parseRequirement } from './requirement.js';
import { scoreCv } from './score.js';
import type { MatchItem } from './types.js';

function judge(cvText: string, requirement: string): MatchItem {
  const item = scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0];
  if (!item) throw new Error('no item');
  return item;
}

const job = '\nKINH NGHIỆM\n2022 - nay Nhân viên hành chính, Công ty Thái Sơn';

describe('words that fold into a product name', () => {
  it.each(['Sắp đặt kho hàng theo sơ đồ', 'Sap xep ho so theo thang', 'SẮP XẾP KỆ HÀNG'])(
    'should not read "%s" as SAP',
    (line) => {
      // Arrange
      const cv = `Hồ Tâm\nKỸ NĂNG\n${line}${job}`;

      // Act
      const got = judge(cv, 'Biết sử dụng SAP');

      // Assert
      expect(got.verdict).toBe('unmet');
    },
  );

  it('should read SAP itself', () => {
    // Arrange
    const cv = `Hồ Tâm\nKỸ NĂNG\nSAP B1, Excel${job}`;

    // Act
    const got = judge(cv, 'Biết sử dụng SAP');

    // Assert
    expect(got.verdict).toBe('met');
  });
});

describe('names', () => {
  it.each([
    '2021 - nay Pha chế, Python Coffee',
    '2021 - nay Phục vụ, Nhà hàng Python',
    '2021 - nay Giao hàng cho khách hàng Honda, Python Group',
  ])('should not read a name as the tool: %s', (line) => {
    // Arrange
    const cv = `Hồ Tâm\nKINH NGHIỆM\n${line}`;

    // Act
    const got = judge(cv, 'Biết Python');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should read a tool named after the word "Công ty" when the words between are duties', () => {
    // Arrange
    const cv = `Hồ Tâm\nKINH NGHIỆM\n2021 - nay Kế toán, công ty dùng Excel và MISA hằng ngày`;

    // Act
    const got = judge(cv, 'Biết Excel');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should keep a certificate followed by a country', () => {
    // Arrange
    const cv = `Hồ Tâm\nCHỨNG CHỈ\nCFA Việt Nam${job}`;

    // Act
    const got = judge(cv, 'Có chứng chỉ CFA');

    // Assert
    expect(got.verdict).toBe('met');
  });
});

describe('negation', () => {
  it('should stop at "nhưng" and "but"', () => {
    // Arrange
    const vi = `Hồ Tâm\nKỸ NĂNG\nChưa dùng Tableau nhưng thành thạo Power BI${job}`;
    const en = `Sam Ho\nSKILLS\nNo experience with Vue but strong in React${job}`;

    // Act
    const shown = judge(vi, 'Biết Power BI');
    const negated = judge(vi, 'Biết Tableau');
    const shownEn = judge(en, 'Experience with React');
    const negatedEn = judge(en, 'Experience with Vue');

    // Assert
    expect([shown.verdict, negated.verdict]).toEqual(['met', 'unmet']);
    expect([shownEn.verdict, negatedEn.verdict]).toEqual(['met', 'unmet']);
  });

  it('should reach every item of a negated list', () => {
    // Arrange
    const cv = `Hồ Tâm\nKỸ NĂNG\nChưa có kinh nghiệm dùng Tekla, SolidWorks và Etabs${job}`;

    // Act
    const tekla = judge(cv, 'Biết Tekla');
    const etabs = judge(cv, 'Biết Etabs');

    // Assert
    expect(tekla.verdict).toBe('unmet');
    expect(etabs.verdict).toBe('unmet');
  });

  it('should stop at a comma when the next item has its own verb', () => {
    // Arrange
    const cv = `Hồ Tâm\nKỸ NĂNG\nChưa biết Figma, dùng tốt Canva${job}`;

    // Act
    const got = judge(cv, 'Biết Canva');

    // Assert
    expect(got.verdict).toBe('met');
  });
});

describe('wishes', () => {
  it.each([
    'Muốn học Docker trong năm tới',
    'Willing to learn Docker',
    'Looking to learn Docker',
    'Đang tìm hiểu Docker',
  ])('should not count "%s"', (line) => {
    // Arrange
    const cv = `Hồ Tâm\nKỸ NĂNG\n${line}${job}`;

    // Act
    const got = judge(cv, 'Biết Docker');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should count a real skill written before a wish on the same line', () => {
    // Arrange
    const cv = `Hồ Tâm\nKỸ NĂNG\nThành thạo Word, đang học thêm Docker${job}`;

    // Act
    const word = judge(cv, 'Biết Word');
    const docker = judge(cv, 'Biết Docker');

    // Assert
    expect(word.verdict).toBe('met');
    expect(docker.verdict).toBe('unmet');
  });
});

describe('skill level', () => {
  const basic = `Hồ Tâm\nKỸ NĂNG\nExcel cơ bản${job}`;
  const plain = `Hồ Tâm\nKỸ NĂNG\nExcel, Word${job}`;
  const advanced = `Hồ Tâm\nKỸ NĂNG\nExcel nâng cao, Word${job}`;

  it('should fail an advanced requirement for a stated basic level', () => {
    // Act
    const got = judge(basic, 'Excel nâng cao');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should accept a basic level for a plain requirement', () => {
    // Act
    const got = judge(basic, 'Biết Excel');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should leave an advanced requirement open when no level is stated', () => {
    // Act
    const got = judge(plain, 'Excel nâng cao');

    // Assert
    expect(got.verdict).toBe('unknown');
  });

  it('should accept a stated advanced level', () => {
    // Act
    const got = judge(advanced, 'Excel nâng cao');

    // Assert
    expect(got.verdict).toBe('met');
  });
});

describe('MS Office and abbreviations', () => {
  it.each(['Biết Word', 'Thành thạo Excel', 'Biết PowerPoint'])('should accept MS Office for "%s"', (requirement) => {
    // Arrange
    const cv = `Hồ Tâm\nKỸ NĂNG\nMicrosoft Office${job}`;

    // Act
    const got = judge(cv, requirement);

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should not read Word and Excel as PowerPoint', () => {
    // Arrange
    const cv = `Hồ Tâm\nKỸ NĂNG\nWord, Excel${job}`;

    // Act
    const got = judge(cv, 'Biết PowerPoint');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should read Word and Excel as enough for "MS Office"', () => {
    // Arrange
    const cv = `Hồ Tâm\nKỸ NĂNG\nWord, Excel${job}`;

    // Act
    const got = judge(cv, 'Sử dụng tốt MS Office');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should read short forms in a skills list', () => {
    // Arrange
    const cv = `Hồ Tâm\nKỸ NĂNG\nJS, TS, Adobe PS, AI${job}`;

    // Act
    const verdicts = ['Biết JavaScript', 'Biết TypeScript', 'Biết Photoshop', 'Biết Illustrator'].map(
      (r) => judge(cv, r).verdict,
    );

    // Assert
    expect(verdicts).toEqual(['met', 'met', 'met', 'met']);
  });

  it('should not read those short forms outside a skills list or as artificial intelligence', () => {
    // Arrange
    const duties = `Hồ Tâm\nKINH NGHIỆM\n2022 - nay Nhân viên PS, phòng AI, Công ty Thái Sơn`;
    const ai = `Hồ Tâm\nKỸ NĂNG\nAI, Machine Learning${job}`;

    // Act
    const inDuties = judge(duties, 'Biết Photoshop');
    const asAi = judge(ai, 'Biết Illustrator');

    // Assert
    expect(inDuties.verdict).toBe('unmet');
    expect(asAi.verdict).toBe('unmet');
  });
});

describe('assets', () => {
  it('should not read goods the candidate sells as goods the candidate owns', () => {
    // Arrange
    const cv = `Hồ Tâm\nKINH NGHIỆM\n2022 - nay Bán xe máy, laptop tại cửa hàng Minh Phát`;

    // Act
    const laptop = judge(cv, 'Có laptop riêng');
    const bike = judge(cv, 'Có xe máy');

    // Assert
    expect(laptop.verdict).toBe('unknown');
    expect(bike.verdict).toBe('unknown');
  });
});

describe('bonus wording', () => {
  it.each([
    'Có kinh nghiệm ngành thép là ưu tiên',
    'Biết tiếng Hàn sẽ được ưu tiên',
    'Biết Figma là một lợi thế',
    'Ưu tiên ứng viên biết Figma',
    'Figma is a plus',
  ])('should read "%s" as a bonus', (line) => {
    // Act
    const parsed = parseRequirement(line);

    // Assert
    expect(parsed.preference).toBe(true);
  });

  it('should keep the mandatory clause of a mixed line deciding the verdict', () => {
    // Arrange
    const withBonus = `Hồ Tâm\nKỸ NĂNG\nFigma${job}`;
    const withMandatory = `Hồ Tâm\nKỸ NĂNG\nCanva${job}`;
    const line = 'Thành thạo Canva; biết Figma là lợi thế';

    // Act
    const missing = judge(withBonus, line);
    const shown = judge(withMandatory, line);

    // Assert
    expect(parseRequirement(line).preference).toBe(false);
    expect(missing.verdict).toBe('unmet');
    expect(shown.verdict).toBe('met');
  });

  it('should mention a shown bonus without letting it decide', () => {
    // Arrange
    const cv = `Hồ Tâm\nKỸ NĂNG\nCanva, Figma${job}`;

    // Act
    const got = judge(cv, 'Thành thạo Canva; biết Figma là lợi thế');

    // Assert
    expect(got.verdict).toBe('met');
    expect(got.reason).toContain('Điểm cộng');
  });
});

describe('text copied from the ad', () => {
  it('should not read an ad pasted into the CV as a claim', () => {
    // Arrange
    const cv = `Hồ Tâm\nỨng tuyển: Kế toán. Tin tuyển dụng yêu cầu: Thành thạo Excel, 3 năm kinh nghiệm, Đại học.${job}`;

    // Act
    const excel = judge(cv, 'Thành thạo Excel');
    const years = judge(cv, 'Từ 5 năm kinh nghiệm');

    // Assert
    expect(excel.verdict).toBe('unmet');
    expect(years.verdict).toBe('unmet');
  });
});
