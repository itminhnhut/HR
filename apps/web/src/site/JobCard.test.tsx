import type { JobCardDto } from '@careers/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { JobCard } from './JobCard';

const job: JobCardDto = {
  id: 'j1',
  slug: 'nhan-vien-kinh-doanh-b2b',
  title: 'Nhân viên Kinh doanh B2B',
  department: 'Kinh doanh',
  employmentType: 'full_time',
  place: 'Gò Vấp, TP. Hồ Chí Minh',
  deadline: '2099-12-31',
  status: 'open',
  publishedAt: null,
  perks: 'Lương cứng 12 – 18 triệu, xét tăng 2 lần/năm, Hoa hồng theo doanh số, không giới hạn',
  salaryMin: 12_000_000,
  salaryMax: 18_000_000,
};

function show(card: JobCardDto = job) {
  const router = createMemoryRouter([{ path: '/', element: <JobCard job={card} /> }]);
  return render(<RouterProvider router={router} />);
}

afterEach(cleanup);

describe('job card', () => {
  it('should name its link by the job title only', () => {
    // Act
    show();

    // Assert
    expect(screen.getByRole('link', { name: 'Nhân viên Kinh doanh B2B' }).getAttribute('href')).toBe(
      '/viec-lam/nhan-vien-kinh-doanh-b2b',
    );
  });

  it('should list its facts as term and value pairs inside the description list', () => {
    // Act
    const { container } = show();

    // Assert
    const list = container.querySelector('dl');
    const groups = [...(list?.children ?? [])];
    expect(groups.length).toBe(3);
    for (const group of groups) {
      expect(group.tagName).toBe('DIV');
      expect([...group.children].map((child) => child.tagName)).toEqual(['DT', 'DD']);
    }
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Địa điểm', 'Hình thức', 'Hạn nộp']);
  });

  it('should show a short place name', () => {
    show();
    expect(screen.getByText('Gò Vấp, TP.HCM')).toBeTruthy();
  });

  it('should show perks that are not the salary', () => {
    show();
    expect(screen.getByText('Hoa hồng theo doanh số')).toBeTruthy();
    expect(screen.queryByText(/Lương cứng/)).toBeNull();
  });
});
