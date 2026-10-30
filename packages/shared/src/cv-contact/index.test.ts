import { describe, expect, it } from 'vitest';
import { parseCvContact } from './index.js';

describe('parseCvContact – whole CVs', () => {
  it('should read a classic single-column Vietnamese CV', () => {
    // Arrange
    const text = [
      'CURRICULUM VITAE',
      'NGUYỄN THỊ THU HÀ',
      'Kế toán tổng hợp',
      'THÔNG TIN CÁ NHÂN',
      'Ngày sinh: 15/08/1996',
      'Số điện thoại: 0912.345.678',
      'Email: thuha.nguyen96@gmail.com',
      'Địa chỉ: 25 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      'CCCD: 001196012345',
      'KINH NGHIỆM LÀM VIỆC',
      '03/2019 - nay: Công ty CP Thương mại Minh Phát',
      'Lương: 12.000.000 VNĐ',
      'NGƯỜI THAM CHIẾU',
      'Bà Trần Thị Lan - Kế toán trưởng - 0903 111 222 - lan.tran@minhphat.vn',
    ].join('\n');

    // Act
    const contact = parseCvContact(text);

    // Assert
    expect(contact).toEqual({ fullName: 'Nguyễn Thị Thu Hà', phone: '0912345678', email: 'thuha.nguyen96@gmail.com' });
  });

  it('should read a two-column CV whose sidebar text comes before the main column', () => {
    const text = [
      'LIÊN HỆ',
      '📞 0987 654 321',
      '✉ quang.huy.le@gmail.com',
      '📍 Quận 7, TP. Hồ Chí Minh',
      'KỸ NĂNG',
      'Microsoft Excel',
      'Tiếng Anh giao tiếp',
      'Làm việc nhóm',
      'NGƯỜI THAM CHIẾU',
      'Ông Phạm Văn Đức',
      'Trưởng phòng Kinh doanh',
      '0909 111 222',
      'LÊ QUANG HUY',
      'Nhân viên kinh doanh',
      'MỤC TIÊU NGHỀ NGHIỆP',
      'Trở thành trưởng nhóm kinh doanh trong 3 năm.',
    ].join('\n');

    expect(parseCvContact(text)).toEqual({
      fullName: 'Lê Quang Huy',
      phone: '0987654321',
      email: 'quang.huy.le@gmail.com',
    });
  });

  it('should read a pdf.js extraction with joined lines and broken words', () => {
    const text = [
      'T R Ầ N  M I N H  T U Ấ N   Frontend Developer',
      'Phone: +84 98 765 4321 Email: tuan.tran @ gmail . com Address: 12 Lê Lợi, Q.1, TP.HCM',
      'EXPERIENCE 01/2020 - 12/2022 FPT Software - Frontend Developer',
    ].join('\n');

    expect(parseCvContact(text)).toEqual({
      fullName: 'Trần Minh Tuấn',
      phone: '0987654321',
      email: 'tuan.tran@gmail.com',
    });
  });

  it('should read an English CV with a foreign-style header', () => {
    const text = [
      'Hung Tran Van',
      'Sales Executive',
      'Mobile: (+84) 903-222-111 | Email: HungTV@Outlook.com',
      'PROFILE',
      'Five years in B2B sales.',
      'REFERENCES',
      'Mr. David Nguyen - Sales Director - david.nguyen@acme.com - 0904 333 444',
    ].join('\n');

    expect(parseCvContact(text)).toEqual({
      fullName: 'Hung Tran Van',
      phone: '0903222111',
      email: 'hungtv@outlook.com',
    });
  });

  it('should read a CV whose header name is split over two lines in NFD', () => {
    const text = ['HOÀNG THỊ', 'BẢO NGỌC', 'Chuyên viên tuyển dụng', 'Zalo: 0356 789 012', 'ngoc.hoang@gmail.com']
      .join('\n')
      .normalize('NFD');

    expect(parseCvContact(text)).toEqual({
      fullName: 'Hoàng Thị Bảo Ngọc',
      phone: '0356789012',
      email: 'ngoc.hoang@gmail.com',
    });
  });

  it('should return nulls for text without contact details', () => {
    const text = 'KINH NGHIỆM LÀM VIỆC\n2018 - 2020: Công ty ABC\nKỸ NĂNG\nExcel, Word';
    expect(parseCvContact(text)).toEqual({ fullName: null, phone: null, email: null });
  });

  it('should return nulls for empty text', () => {
    expect(parseCvContact('')).toEqual({ fullName: null, phone: null, email: null });
  });
});
