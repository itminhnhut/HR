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
});
