import type { RealtimeDto } from '@careers/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RealtimeView } from './RealtimePanel';

const OK: Extract<RealtimeDto, { status: 'ok' }> = {
  status: 'ok',
  activeUsers: 7,
  perMinute: [...Array<number>(29).fill(0), 3],
  pages: [{ name: 'Kế toán tổng hợp', users: 5 }],
  cities: [{ name: 'Ho Chi Minh City', users: 4 }],
  devices: [{ name: 'Điện thoại', users: 6 }],
  fetchedAt: '2026-11-04T03:00:00.000Z',
};

afterEach(cleanup);

describe('RealtimeView', () => {
  it('should show how many people, and the pages, cities and devices with their numbers', () => {
    // Act
    render(<RealtimeView data={OK} />);

    // Assert
    expect(screen.getByText('7')).toBeTruthy();
    const pages = screen.getByRole('region', { name: 'Trang đang xem' });
    expect(within(pages).getByText('Kế toán tổng hợp')).toBeTruthy();
    expect(within(pages).getByText('5')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Thành phố' })).getByText('Ho Chi Minh City')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Thiết bị' })).getByText('Điện thoại')).toBeTruthy();
  });

  it('should show a zero, not an empty panel, when nobody is on the site', () => {
    // Act
    render(<RealtimeView data={{ ...OK, activeUsers: 0, pages: [], cities: [], devices: [] }} />);

    // Assert
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getAllByText('Chưa có dữ liệu.')).toHaveLength(3);
  });

  it('should describe the minutes in words for those who cannot see the bars', () => {
    render(<RealtimeView data={OK} />);

    expect(screen.getByRole('img', { name: /30 phút gần nhất, cao nhất 3 người/ })).toBeTruthy();
  });

  it('should say at what time in Vietnam the numbers were last read', () => {
    render(<RealtimeView data={OK} />);

    expect(screen.getByText('Cập nhật 10:00')).toBeTruthy();
  });

  it('should say on one short line where the numbers come from and how often they change, for phones too', () => {
    render(<RealtimeView data={OK} />);

    expect(screen.getByText('Từ Google Analytics, cập nhật mỗi phút, không tính trang admin')).toBeTruthy();
  });

  const pageBars = () =>
    [...screen.getByRole('region', { name: 'Trang đang xem' }).querySelectorAll<HTMLElement>('[data-share]')].map(
      (bar) => bar.style.width,
    );

  it('should draw two equal pages as halves when one person saw both', () => {
    // Arrange
    const pages = [
      { name: 'Trang A', users: 1 },
      { name: 'Trang B', users: 1 },
    ];

    // Act
    render(<RealtimeView data={{ ...OK, activeUsers: 1, pages }} />);

    // Assert
    expect(pageBars()).toEqual(['50%', '50%']);
  });

  it('should measure a page against everyone on the site, not only the five pages listed', () => {
    // Arrange: 20 people on 20 pages, of which the server sends the top five.
    const pages = ['A', 'B', 'C', 'D', 'E'].map((name) => ({ name, users: 1 }));

    // Act
    render(<RealtimeView data={{ ...OK, activeUsers: 20, pages }} />);

    // Assert
    expect(pageBars()).toEqual(['5%', '5%', '5%', '5%', '5%']);
  });

  it('should draw no bar for a page with nobody on it', () => {
    render(<RealtimeView data={{ ...OK, activeUsers: 0, pages: [{ name: 'Trang A', users: 0 }] }} />);

    expect(pageBars()).toEqual(['0%']);
  });

  it('should keep a minute with one person visible beside a much busier minute', () => {
    // Arrange
    const perMinute = [...Array<number>(28).fill(0), 100, 1];

    // Act
    render(<RealtimeView data={{ ...OK, perMinute }} />);

    // Assert
    const bar = screen.getByTitle('Phút này: 1 người').firstElementChild as HTMLElement;
    expect(Number.parseFloat(bar.style.height)).toBeGreaterThanOrEqual(8);
  });

  it('should say plainly when it is not connected yet, and show no numbers', () => {
    render(<RealtimeView data={{ status: 'off' }} />);

    expect(screen.getByText(/chưa kết nối Google Analytics/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('should say so when Google does not answer', () => {
    render(<RealtimeView data={{ status: 'error' }} />);

    expect(screen.getByText(/chưa lấy được số liệu/)).toBeTruthy();
  });
});
