import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Bullets } from './JobSections';

afterEach(cleanup);

describe('closed job duties', () => {
  it('should show each group heading above its duties', () => {
    // Act
    render(
      <Bullets
        sections={[
          { title: '1. Quản lý đơn hàng', items: ['Theo dõi lịch tàu.'] },
          { title: 'THỜI GIAN LÀM VIỆC', items: ['Thứ 2 – Thứ 6.'] },
        ]}
      />,
    );

    // Assert
    expect(screen.getByText('1. Quản lý đơn hàng')).toBeTruthy();
    expect(screen.getByText('THỜI GIAN LÀM VIỆC')).toBeTruthy();
    expect(screen.getAllByRole('list')).toHaveLength(2);
  });

  it('should show duties without headings as one plain list', () => {
    // Act
    render(<Bullets sections={[{ title: null, items: ['Tìm khách hàng.', 'Tìm khách hàng.'] }]} small />);

    // Assert
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Tìm khách hàng.', 'Tìm khách hàng.']);
  });
});
