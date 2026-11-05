import type { DashboardDto } from '@careers/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
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
  phone: '0912345678',
  matchPercent: 43 as number | null,
  cvGender: 'female' as 'male' | 'female' | null,
  cvBirth: '2002-04-01' as string | null,
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

function Address() {
  const { pathname, search } = useLocation();
  return <output data-testid="address">{pathname + search}</output>;
}

describe('opening someone from the interview calendar', () => {
  it('should land on the interview tab when their event is pressed', () => {
    // Arrange
    const interviews = [item('a', '2026-11-06T02:00:00.000Z')];
    const data = { interviews, interviewCounts: { total: 1, noTime: 0 } } as DashboardDto;
    const { container } = render(
      <MemoryRouter initialEntries={['/hr']}>
        <InterviewCalendar data={data} now={NOW} />
        <Address />
      </MemoryRouter>,
    );
    const event = container.querySelector('[data-interview="a"]');
    if (!event) throw new Error('the event is not on the calendar');

    // Act
    fireEvent.click(event);

    // Assert
    expect(screen.getByTestId('address').textContent).toBe('/hr/ho-so?trang-thai=interview&id=a');
  });

  it('should land on the waiting-for-result tab when the interview is over', () => {
    // Arrange
    window.innerWidth = 390;

    // Act
    show([item('a', '2026-11-02T02:00:00.000Z')]);

    // Assert
    expect(screen.getByRole('link', { name: /Ứng viên a/ }).getAttribute('href')).toBe('/hr/ho-so?trang-thai=awaiting&id=a');
  });

  it('should land on the interview tab from the phone list', () => {
    // Arrange
    window.innerWidth = 390;

    // Act
    show([item('a', '2026-11-06T02:00:00.000Z')]);

    // Assert
    expect(screen.getByRole('link', { name: /Ứng viên a/ }).getAttribute('href')).toBe('/hr/ho-so?trang-thai=interview&id=a');
  });
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
    expect(list.getByRole('link', { name: 'Ứng viên b' }).getAttribute('href')).toBe('/hr/ho-so?trang-thai=interview&id=b');
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

  it('should show the job, day and time, application date and note when the mouse is on a person', async () => {
    // Arrange
    show([{ ...item('a', '2026-11-05T02:00:00.000Z'), noteLine: 'Mang bản gốc bằng cấp' }]);
    const person = await screen.findByText('Ứng viên a');
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Act
    fireEvent.mouseOver(person);

    // Assert
    const card = within(screen.getByRole('tooltip'));
    expect(card.getByText('Kế toán')).toBeTruthy();
    expect(card.getByText(/Thứ Năm, 05\/11\/2026, 09:00/)).toBeTruthy();
    expect(card.getByText('30/10/2026')).toBeTruthy();
    expect(card.getByText('Mang bản gốc bằng cấp')).toBeTruthy();
    expect(card.getByText('Nữ')).toBeTruthy();
    expect(card.getByText(/\d+ tuổi/)).toBeTruthy();
    expect(card.getByText('43%')).toBeTruthy();
    expect(card.getByText('0912 345 678')).toBeTruthy();
  });

  it('should say so when the CV gives no gender or age, and not guess from the name', async () => {
    // Arrange
    show([{ ...item('a', '2026-11-05T02:00:00.000Z'), cvGender: null, cvBirth: null }]);

    // Act
    fireEvent.mouseOver(await screen.findByText('Ứng viên a'));

    // Assert
    expect(within(screen.getByRole('tooltip')).getByText('Không ghi giới tính, tuổi')).toBeTruthy();
  });

  it('should say an interview is over on its card', async () => {
    // Arrange
    show([item('a', '2026-11-03T02:00:00.000Z')]);

    // Act
    fireEvent.mouseOver(await screen.findByText('Ứng viên a'));

    // Assert
    expect(within(screen.getByRole('tooltip')).getByText(/đã qua/)).toBeTruthy();
  });

  it('should hide the card when the mouse leaves the person', async () => {
    // Arrange
    show([item('a', '2026-11-05T02:00:00.000Z')]);
    const person = await screen.findByText('Ứng viên a');
    fireEvent.mouseOver(person);

    // Act
    fireEvent.mouseOut(person);

    // Assert
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('should keep the card open while the page scrolls, for a person reached with the keyboard', async () => {
    // Arrange
    show([item('a', '2026-11-05T02:00:00.000Z')]);
    fireEvent.mouseOver(await screen.findByText('Ứng viên a'));

    // Act
    fireEvent.scroll(window);

    // Assert
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('should close the card with Esc', async () => {
    // Arrange
    show([item('a', '2026-11-05T02:00:00.000Z')]);
    fireEvent.mouseOver(await screen.findByText('Ứng viên a'));

    // Act
    fireEvent.keyDown(window, { key: 'Escape' });

    // Assert
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('should not leave the card behind when the month is changed under a resting mouse', async () => {
    // Arrange
    show([item('a', '2026-11-05T02:00:00.000Z')]);
    fireEvent.mouseOver(await screen.findByText('Ứng viên a'));

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));

    // Assert
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('should tell a screen reader what the card shows when a person gets the focus', async () => {
    // Act
    show([{ ...item('a', '2026-11-05T02:00:00.000Z'), noteLine: 'Mang bản gốc bằng cấp' }]);

    // Assert
    await screen.findByText('Ứng viên a');
    const name = document.querySelector('[data-interview="a"]')?.getAttribute('aria-label') ?? '';
    expect(name).toContain('Kế toán');
    expect(name).toContain('09:00');
    expect(name).toContain('Mang bản gốc bằng cấp');
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
