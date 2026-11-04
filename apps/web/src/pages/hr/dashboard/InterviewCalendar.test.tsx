import type { DashboardDto } from '@careers/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { calendarEvents, InterviewCalendar } from './InterviewCalendar';

const NOW = new Date('2026-11-04T03:00:00.000Z');

const item = (id: string, interviewAt: string | null) => ({
  id,
  fullName: `Ứng viên ${id}`,
  jobTitle: 'Kế toán',
  appliedAt: '2026-10-30T04:00:00.000Z',
  interviewAt,
  noteLine: null as string | null,
});

function show(interviews: DashboardDto['interviews']) {
  const noTime = interviews.filter((i) => !i.interviewAt).length;
  const data = { interviews, interviewCounts: { total: interviews.length, noTime } } as DashboardDto;
  render(
    <MemoryRouter>
      <InterviewCalendar data={data} now={NOW} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  window.innerWidth = 1024;
});

describe('calendarEvents', () => {
  it('should leave out those without a time, since they have no place on a calendar', () => {
    const events = calendarEvents([item('a', '2026-11-06T02:00:00.000Z'), item('b', null)], NOW);

    expect(events.map((e) => e.id)).toEqual(['a']);
  });

  it('should tell an interview still to come from one already over', () => {
    const [coming, over] = calendarEvents(
      [item('a', '2026-11-06T02:00:00.000Z'), item('b', '2026-11-03T02:00:00.000Z')],
      NOW,
    );

    expect(coming?.color).not.toBe(over?.color);
  });
});

describe('InterviewCalendar', () => {
  it('should say so when nobody has an interview', () => {
    show([]);

    expect(screen.getByText('Chưa có ai đang hẹn phỏng vấn.')).toBeTruthy();
  });

  it('should name everyone without a time, each opening their profile', () => {
    // Act
    show([item('a', '2026-11-06T02:00:00.000Z'), item('b', null), item('c', null)]);

    // Assert
    const list = within(screen.getByRole('region', { name: 'Chưa chọn giờ phỏng vấn' }));
    expect(list.getByRole('heading', { name: 'Chưa chọn giờ phỏng vấn (2)' })).toBeTruthy();
    expect(list.getByRole('link', { name: 'Ứng viên b' }).getAttribute('href')).toBe('/hr/ho-so?id=b');
    expect(list.getByRole('link', { name: 'Ứng viên c' })).toBeTruthy();
    expect(list.queryByText('Ứng viên a')).toBeNull();
  });

  it('should tell a person without a time apart on hover: job, that no time is set, when they applied, the note', () => {
    // Act
    show([{ ...item('b', null), noteLine: 'Hẹn thứ 5, 9h' }]);

    // Assert
    const card = screen.getByRole('tooltip', { hidden: true });
    expect(screen.getByRole('link', { name: 'Ứng viên b', description: /Chưa chọn/ })).toBeTruthy();
    expect(within(card).getByText('Kế toán')).toBeTruthy();
    expect(within(card).getByText('Chưa chọn')).toBeTruthy();
    expect(within(card).getByText('30/10/2026')).toBeTruthy();
    expect(within(card).getByText('Hẹn thứ 5, 9h')).toBeTruthy();
  });

  it('should leave the note line out when there is no note', () => {
    show([item('b', null)]);

    expect(within(screen.getByRole('tooltip', { hidden: true })).queryByText('Ghi chú')).toBeNull();
  });

  it('should say how everyone is accounted for', () => {
    show([item('a', '2026-11-06T02:00:00.000Z'), item('b', null), item('c', null)]);

    expect(screen.getByText(/người đang hẹn phỏng vấn: 1 có giờ, 2 chưa chọn giờ\./)).toBeTruthy();
  });

  it('should open on this month and point to interviews in earlier months', async () => {
    // Act
    show([item('old', '2026-09-16T02:00:00.000Z')]);

    // Assert
    expect(await screen.findByText('Tháng 11, 2026')).toBeTruthy();
    expect(screen.queryByText('Ứng viên old')).toBeNull();
    expect(screen.getByText(/1 lịch đã qua ở các tháng trước/)).toBeTruthy();
  });

  it('should show the person on the month that opens', async () => {
    show([item('a', '2026-11-06T02:00:00.000Z')]);

    expect(await screen.findByText('Ứng viên a')).toBeTruthy();
  });

  it('should list people with their day and time on a phone, and say how many more there are', () => {
    // Arrange
    window.innerWidth = 390;
    const dated = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => item(id, '2026-11-06T02:00:00.000Z'));

    // Act
    show(dated);

    // Assert
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByRole('link', { name: /Ứng viên a/ }).textContent).toContain('09:00');
    expect(screen.getByText('và 1 lịch hẹn khác')).toBeTruthy();
  });
});
