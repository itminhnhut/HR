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
