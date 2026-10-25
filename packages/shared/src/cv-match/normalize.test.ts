import { describe, expect, it } from 'vitest';
import { buildCvDoc, cleanLine, fold, foldClean } from './normalize.js';
import { detectHeader } from './sections.js';

describe('fold', () => {
  it.each([
    ['Kinh Nghiệm Làm Việc', 'kinh nghiem lam viec'],
    ['ĐẠI HỌC Đà Nẵng', 'dai hoc da nang'],
    ['Thành thạo   Excel', 'thanh thao excel'],
    ['Tiếng Anh', 'tieng anh'],
  ])('should fold "%s" to "%s"', (input, expected) => {
    expect(fold(input)).toBe(expected);
  });

  it('should fold NFD (decomposed) Vietnamese the same as NFC', () => {
    // Arrange
    const nfd = 'Kế toán'.normalize('NFD');
    // Act / Assert
    expect(fold(nfd)).toBe('ke toan');
  });

  it('should keep folded text the same length as the cleaned original so indexes line up', () => {
    const clean = cleanLine('Nhân viên bán hàng – Công ty Ánh Dương');
    expect(foldClean(clean)).toHaveLength(clean.length);
  });
});

describe('cleanLine', () => {
  it('should replace PDF ligatures with plain letters', () => {
    expect(cleanLine('Certiﬁcate of ﬂuency')).toBe('Certificate of fluency');
  });

  it('should unify en dash, em dash and minus sign to a hyphen', () => {
    expect(cleanLine('2019 – 2020 — 2021 − 2022')).toBe('2019 - 2020 - 2021 - 2022');
  });

  it('should turn bullets into hyphens and collapse whitespace', () => {
    expect(cleanLine('•   Excel \tWord')).toBe('- Excel Word');
  });
});

describe('detectHeader', () => {
  it.each([
    ['KINH NGHIỆM LÀM VIỆC', 'experience'],
    ['WORK EXPERIENCE', 'experience'],
    ['HỌC VẤN:', 'education'],
    ['II. KỸ NĂNG', 'skills'],
    ['Sở thích', 'interests'],
    ['MỤC TIÊU NGHỀ NGHIỆP', 'objective'],
    ['Ngoại ngữ / Languages', 'languages'],
    ['CHỨNG CHỈ', 'certificates'],
  ])('should detect "%s" as a %s header', (line, kind) => {
    expect(detectHeader(fold(line))?.kind).toBe(kind);
  });

  it('should detect an inline header with content after the colon', () => {
    expect(detectHeader(fold('Kỹ năng: Excel, Word, PowerPoint'))).toEqual({ kind: 'skills', inline: true });
  });

  it('should not treat an ordinary sentence as a header', () => {
    expect(detectHeader(fold('Tư vấn bán hàng cho khách tại cửa hàng'))).toBeNull();
  });
});

describe('buildCvDoc', () => {
  it('should assign each line to the section above it', () => {
    // Arrange
    const text = 'Nguyễn Văn A\nKINH NGHIỆM\nCông ty X\nSỞ THÍCH\nĐọc sách, Photoshop';
    // Act
    const doc = buildCvDoc(text);
    // Assert
    expect(doc.lines.map((l) => l.section)).toEqual(['none', 'experience', 'experience', 'interests', 'interests']);
  });

  it('should detect a CV written in English', () => {
    const doc = buildCvDoc(
      'WORK EXPERIENCE\nSales executive at ABC Company, responsible for the key accounts and customers in the north.\nEDUCATION\nBachelor of Business, Foreign Trade University',
    );
    expect(doc.isEnglish).toBe(true);
  });

  it('should not mistake an unaccented Vietnamese CV for English', () => {
    const doc = buildCvDoc(
      'KINH NGHIEM LAM VIEC\nNhan vien ban hang tai cua hang dien thoai, tu van khach hang\nHOC VAN\nDai hoc Kinh te',
    );
    expect(doc.isEnglish).toBe(false);
  });

  it('should count letters so an empty scan can be told apart', () => {
    expect(buildCvDoc('  \n 12/2020 \n').letterCount).toBe(0);
  });
});
