import { describe, expect, it } from 'vitest';
import { jobLocation } from './job-location.js';

describe('jobLocation', () => {
  it('should place a job without its own address at the office', () => {
    // Arrange / Act
    const place = jobLocation(null);

    // Assert
    expect(place).toEqual({ street: null, district: 'Gò Vấp', city: 'TP. Hồ Chí Minh' });
  });

  it('should read the district and city of a Đà Nẵng address', () => {
    expect(jobLocation('Hải Châu, Đà Nẵng')).toEqual({ street: null, district: 'Hải Châu', city: 'Đà Nẵng' });
  });

  it('should read the district and city of a Hồ Chí Minh address', () => {
    expect(jobLocation('Gò Vấp, TP. Hồ Chí Minh')).toEqual({
      street: null,
      district: 'Gò Vấp',
      city: 'TP. Hồ Chí Minh',
    });
  });

  it('should keep the street only when the address has one before the district', () => {
    expect(jobLocation('12 Bạch Đằng, Hải Châu, TP. Đà Nẵng')).toEqual({
      street: '12 Bạch Đằng',
      district: 'Hải Châu',
      city: 'Đà Nẵng',
    });
  });

  it.each([
    ['Quận 1, TP.HCM', 'TP. Hồ Chí Minh'],
    ['Cầu Giấy, Hà Nội', 'Hà Nội'],
    ['Ngô Quyền, Hải Phòng', 'Hải Phòng'],
    ['Ninh Kiều, Cần Thơ', 'Cần Thơ'],
    ['Thủ Dầu Một, Bình Dương', 'Bình Dương'],
    ['Biên Hòa, Đồng Nai', 'Đồng Nai'],
    ['Bình Thạnh, Sài Gòn', 'TP. Hồ Chí Minh'],
  ])('should recognise the city in "%s"', (address, city) => {
    expect(jobLocation(address).city).toBe(city);
  });

  it('should ignore a trailing country name', () => {
    expect(jobLocation('Hải Châu, Đà Nẵng, Việt Nam')).toEqual({ street: null, district: 'Hải Châu', city: 'Đà Nẵng' });
  });

  it('should give a one-part address naming a city no district', () => {
    expect(jobLocation('Kho Bình Dương')).toEqual({ street: null, district: null, city: 'Bình Dương' });
  });

  it('should read an address in a city outside the table from small to large', () => {
    expect(jobLocation('Phường 5, Đà Lạt')).toEqual({ street: null, district: 'Phường 5', city: 'Đà Lạt' });
    expect(jobLocation('Huế')).toEqual({ street: null, district: null, city: 'Huế' });
  });

  it('should read a TopCV address "City: street, ward (note naming the old district)"', () => {
    // Arrange
    const address = 'Hồ Chí Minh: 110/20/2 Đường Số 30, Phường An Nhơn (Phường An Nhơn thuộc quận Gò Vấp cũ)';

    // Act
    const place = jobLocation(address);

    // Assert
    expect(place).toEqual({
      street: '110/20/2 Đường Số 30, Phường An Nhơn',
      district: 'Gò Vấp',
      city: 'TP. Hồ Chí Minh',
    });
  });

  it.each([
    ['12 Lê Lợi, Phường Sài Gòn (thuộc quận 1 cũ), TP. Hồ Chí Minh', '12 Lê Lợi, Phường Sài Gòn', 'Quận 1'],
    [
      'Bình Dương: 5 Đại lộ Bình Dương, Phường Phú Lợi (huyện Thuận An cũ)',
      '5 Đại lộ Bình Dương, Phường Phú Lợi',
      'Thuận An',
    ],
    [
      'Bình Dương: 8 Yersin, Phường Chánh Nghĩa (thành phố Thủ Dầu Một cũ)',
      '8 Yersin, Phường Chánh Nghĩa',
      'Thủ Dầu Một',
    ],
  ])('should take the district from a note about the old district in "%s"', (address, street, district) => {
    expect(jobLocation(address)).toMatchObject({ street, district });
  });

  it('should read the city before a colon and the rest from small to large', () => {
    expect(jobLocation('Hà Nội: 12 Trần Duy Hưng, Cầu Giấy')).toEqual({
      street: '12 Trần Duy Hưng',
      district: 'Cầu Giấy',
      city: 'Hà Nội',
    });
  });

  it('should keep a lone street after the city prefix as the street, not the district', () => {
    expect(jobLocation('Hồ Chí Minh: 110/20/2 Đường Số 30')).toEqual({
      street: '110/20/2 Đường Số 30',
      district: null,
      city: 'TP. Hồ Chí Minh',
    });
  });

  it('should leave notes in brackets out of the street', () => {
    expect(jobLocation('12 Bạch Đằng (tầng 3), Hải Châu, Đà Nẵng')).toEqual({
      street: '12 Bạch Đằng',
      district: 'Hải Châu',
      city: 'Đà Nẵng',
    });
  });
});
