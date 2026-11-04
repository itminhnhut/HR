import { describe, expect, it } from 'vitest';
import { ageOf, readPersonalFacts } from './personal.js';

const TODAY = '2026-11-04';
const read = (text: string) => readPersonalFacts(text, TODAY);

describe('what a CV says of gender and birth date', () => {
  it('should read both from labelled lines', () => {
    expect(read('Ngày sinh:   14/12/2002\nGiới tính:   NỮ\nSố điện thoại: 0900000000')).toEqual({
      gender: 'female',
      birth: '2002-12-14',
    });
  });

  it('should read an English CV', () => {
    expect(read('Date of birth: 3.5.1999\nGender: Male')).toEqual({ gender: 'male', birth: '1999-05-03' });
  });

  it('should read a value the design put on the next line', () => {
    expect(read('Giới tính\nNam\nNgày sinh\n01-04-2002')).toEqual({ gender: 'male', birth: '2002-04-01' });
  });

  it('should take a date on a line of its own in the contact block', () => {
    expect(read('Email: a@example.com\n01/04/2002\nTP. Hồ Chí Minh').birth).toBe('2002-04-01');
  });

  it('should keep a year given alone', () => {
    expect(read('Năm sinh: 2001').birth).toBe('2001');
  });

  it('should not guess the gender from a name', () => {
    expect(read('Nguyễn Thị Mai\nNhân viên kho').gender).toBeNull();
    expect(read('Trần Văn Nam\nNhân viên kho').gender).toBeNull();
  });

  it('should not read an unfilled form "Giới tính: Nam/Nữ"', () => {
    expect(read('Giới tính: Nam/Nữ').gender).toBeNull();
  });

  it('should not take a recent date on a line of its own for a birth date', () => {
    expect(read('Cập nhật\n26/07/2025').birth).toBeNull();
  });

  it('should not take a job or a study period for a birth date', () => {
    expect(read('07/2024 - 07/2026\n2020 - 2024\nCông ty ABC').birth).toBeNull();
  });

  it('should say nothing when the CV says nothing', () => {
    expect(read('Nhân viên kho\nKiểm kê hằng tháng')).toEqual({ gender: null, birth: null });
  });
});

describe('ageOf', () => {
  it('should count a birthday not yet reached this year', () => {
    expect(ageOf('2002-12-14', TODAY)).toBe(23);
    expect(ageOf('2002-04-01', TODAY)).toBe(24);
  });

  it('should go by the year when no day is known', () => {
    expect(ageOf('2001', TODAY)).toBe(25);
  });
});
