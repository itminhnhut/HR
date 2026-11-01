import type { JobSection } from '@careers/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CheckList, TaskList } from './GroupedLists';

afterEach(cleanup);

const GROUPED: JobSection[] = [
  { title: '1. Quản lý đơn hàng & vận chuyển nhập khẩu', items: ['Theo dõi lịch tàu.', 'Liên hệ hãng tàu.'] },
  { title: '2. Thủ tục hải quan', items: ['Chuẩn bị bộ chứng từ.'] },
  { title: 'THỜI GIAN LÀM VIỆC', items: ['Thứ 2 – Thứ 6, 08:00 – 17:00.'] },
];

/** The two-digit badges of every duty, in page order. */
const badges = (container: HTMLElement) =>
  [...container.querySelectorAll('li > span[aria-hidden="true"]')].map((el) => el.textContent);

describe('grouped job lists', () => {
  it('should show every group heading and number its duties from 01 again', () => {
    // Act
    const { container } = render(<TaskList sections={GROUPED} />);

    // Assert
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '1Quản lý đơn hàng & vận chuyển nhập khẩu',
      '2Thủ tục hải quan',
      'THỜI GIAN LÀM VIỆC',
    ]);
    expect(badges(container)).toEqual(['01', '02', '01', '01']);
  });

  it('should show a numbered heading once, its number apart from the title', () => {
    // Act
    render(<TaskList sections={GROUPED} />);

    // Assert
    const heading = screen.getByRole('heading', { level: 3, name: /Thủ tục hải quan/ });
    expect(heading.textContent).not.toContain('2.');
    expect(within(heading).getByText('Thủ tục hải quan')).toBeTruthy();
  });

  it('should show a field without headings as one list, as before', () => {
    // Arrange
    const plain: JobSection[] = [{ title: null, items: ['Tìm khách hàng mới.', 'Gửi báo giá.'] }];

    // Act
    const { container } = render(<TaskList sections={plain} />);

    // Assert
    expect(screen.queryByRole('heading')).toBeNull();
    expect(container.querySelectorAll('ol')).toHaveLength(1);
    expect(badges(container)).toEqual(['01', '02']);
  });

  it('should show the same line twice when HR typed it in two groups', () => {
    // Arrange
    const repeated: JobSection[] = [
      { title: 'Kiến thức', items: ['Đọc hiểu tiếng Anh.'] },
      { title: 'Kỹ năng', items: ['Đọc hiểu tiếng Anh.', 'Đọc hiểu tiếng Anh.'] },
    ];

    // Act
    render(<CheckList sections={repeated} variant="required" />);

    // Assert
    expect(screen.getAllByText('Đọc hiểu tiếng Anh.')).toHaveLength(3);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Kiến thức', 'Kỹ năng']);
  });

  it('should keep the nice-to-haves under their headings too', () => {
    // Arrange
    const preferred: JobSection[] = [{ title: 'Phần mềm', items: ['Đã dùng ECUS.'] }];

    // Act
    render(<CheckList sections={preferred} variant="preferred" />);

    // Assert
    const heading = screen.getByRole('heading', { level: 3, name: 'Phần mềm' });
    expect(within(heading.parentElement ?? document.body).getByRole('listitem').textContent).toBe('Đã dùng ECUS.');
  });
});
