import { describe, expect, it } from 'vitest';
import { parseCvContact } from './index.js';

function nameOf(text: string): string | null {
  return parseCvContact(text).fullName;
}

describe('parseCvContact – candidate labels', () => {
  it.each([
    ['"Ứng viên:"', 'Ứng viên:   KHỔNG VĂN LỢI', 'Khổng Văn Lợi'],
    ['"Ứng viên :" with extra spaces', 'Ứng viên  :  Lạc Thị Hồng', 'Lạc Thị Hồng'],
    ['"Tên ứng viên:"', 'Tên ứng viên: Quách Gia Huy', 'Quách Gia Huy'],
    ['"Candidate:"', 'Candidate: Tran Bao Ngoc', 'Tran Bao Ngoc'],
    ['"Applicant name:"', 'Applicant name: Le Duc Thinh', 'Le Duc Thinh'],
  ])('reads the value of %s', (_case, text, expected) => {
    expect(nameOf(text)).toBe(expected);
  });

  it('should not read the form title "PHIẾU THÔNG TIN ỨNG VIÊN" as a label', () => {
    expect(nameOf('PHIẾU THÔNG TIN ỨNG VIÊN\nỨng viên tự điền các mục dưới đây')).toBeNull();
  });

  it('should read a new candidate form CV', () => {
    // Arrange
    const text = [
      'PHIẾU ĐĂNG KÝ DỰ TUYỂN',
      'A. THÔNG TIN CÁ NHÂN',
      'Ứng viên :   TRIỆU THỊ KIM OANH',
      'Số điện thoại:   0389 112 457',
      'Email:   kimoanh.trieu@gmail.com',
      'B. HỌC VẤN',
      'Cao đẳng Kinh tế Đối ngoại',
    ].join('\n');

    // Act
    const contact = parseCvContact(text);

    // Assert
    expect(contact).toEqual({ fullName: 'Triệu Thị Kim Oanh', phone: '0389112457', email: 'kimoanh.trieu@gmail.com' });
  });
});

describe('parseCvContact – middle initials', () => {
  it.each([
    ['ALL CAPS', 'TRẦN V. HÙNG\nKế toán tổng hợp', 'Trần V. Hùng'],
    ['title case', 'Nguyễn T. Mai Phương', 'Nguyễn T. Mai Phương'],
  ])('keeps a middle initial written in %s', (_case, text, expected) => {
    expect(nameOf(text)).toBe(expected);
  });

  it('should not accept an initial as the last word', () => {
    expect(nameOf('Trần Văn H.')).toBeNull();
  });

  it('should read a new CV whose header uses a middle initial', () => {
    const text = [
      'PHẠM Q. TRUNG',
      'Kỹ sư cầu đường',
      'SĐT: 0912 707 318   |   Email: phamqtrung.civil@gmail.com',
      'KINH NGHIỆM LÀM VIỆC',
    ].join('\n');

    expect(parseCvContact(text)).toEqual({
      fullName: 'Phạm Q. Trung',
      phone: '0912707318',
      email: 'phamqtrung.civil@gmail.com',
    });
  });
});

describe('parseCvContact – Ông / Bà as a family name', () => {
  it.each([
    ['Ông followed by Thị', 'ÔNG THỊ DIỆU HIỀN\nGiáo viên Tiếng Anh', 'Ông Thị Diệu Hiền'],
    ['Ông followed by Văn', 'Ông Văn Tài\nKỹ thuật viên', 'Ông Văn Tài'],
    ['Bà followed by a middle name', 'BÀ NGỌC TRÂM', 'Bà Ngọc Trâm'],
    ['Ông followed by two given names', 'Ông Khải Hưng', 'Ông Khải Hưng'],
  ])('reads %s as a surname', (_case, text, expected) => {
    expect(nameOf(text)).toBe(expected);
  });

  it.each([
    ['Mr. with a surname and a role', 'Ông Nguyễn Văn An – Giám đốc'],
    ['Mrs. with a surname', 'Bà Trần Thị Lan'],
  ])('should still reject an honorific line: %s', (_case, text) => {
    expect(nameOf(text)).toBeNull();
  });

  it('should read a new CV for a candidate whose family name is Ông', () => {
    const text = [
      'ÔNG VĂN PHÚC',
      'Nhân viên kho vận',
      'Điện thoại: 0868 330 914   |   Email: ONG.VANPHUC@GMAIL.COM',
      'NGƯỜI THAM CHIẾU',
      'Ông Lê Văn Bình – Trưởng kho – 0903 222 111',
    ].join('\n');

    expect(parseCvContact(text)).toEqual({
      fullName: 'Ông Văn Phúc',
      phone: '0868330914',
      email: 'ong.vanphuc@gmail.com',
    });
  });
});
