import type { DashboardDto } from '@careers/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_PICKED_JOBS, togglePick } from './JobMultiSelect';
import { PerDayChart } from './PerDayChart';

afterEach(cleanup);

const DAYS = ['2026-11-02', '2026-11-03', '2026-11-04'];
const job = (id: string, counts: number[]) => ({ jobId: id, jobTitle: `Tin ${id} ( Yêu Cầu 1 Năm )`, counts });

function show(perJobPerDay = [job('a', [1, 0, 2]), job('b', [0, 4, 0])]) {
  const perDay = DAYS.map((day, i) => ({ day, count: perJobPerDay.reduce((n, j) => n + (j.counts[i] ?? 0), 0) }));
  render(<PerDayChart data={{ perDay, perJobPerDay } as unknown as DashboardDto} />);
}

const field = () => screen.getByRole('combobox', { name: 'Chọn tin để so sánh' });
const openList = () => userEvent.click(field());
const pick = (name: string) => userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name }));
const bars = (key: string) => document.querySelectorAll(`[data-bar="${key}"]`);

describe('Comparing jobs on the chart', () => {
  it('should show one column a day for all jobs together until a job is picked', () => {
    show();

    expect(bars('all')).toHaveLength(3);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Tất cả tin7']);
  });

  it('should show one column per picked job on every day, each with its total', async () => {
    // Arrange
    show();

    // Act
    await openList();
    await pick('Tin a');
    await pick('Tin b');

    // Assert
    expect(bars('a')).toHaveLength(3);
    expect(bars('b')).toHaveLength(3);
    expect(bars('all')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Bỏ Tin a' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bỏ Tin b' })).toBeTruthy();
    const legend = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(legend).toContain('Tin a3');
    expect(legend).toContain('Tin b4');
  });

  it('should give each picked job its own colour', async () => {
    // Arrange
    show();

    // Act
    await openList();
    await pick('Tin a');
    await pick('Tin b');

    // Assert
    const colorOf = (key: string, at: number) => (bars(key)[at] as HTMLElement).style.background;
    expect(colorOf('a', 0)).not.toBe('');
    expect(colorOf('a', 0)).not.toBe(colorOf('b', 1));
  });

  it('should show the numbers of a day only under the mouse, those with something, and no line of text', async () => {
    // Arrange
    show();
    await openList();
    await pick('Tin a');
    await pick('Tin b');
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Act
    await userEvent.hover(screen.getByRole('button', { name: /^Ngày 03\/11/ }));

    // Assert
    const card = within(screen.getByRole('tooltip'));
    expect(card.getByText('Ngày 03/11')).toBeTruthy();
    expect(card.getByText('4 hồ sơ')).toBeTruthy();
    expect(card.getByText('Tin b')).toBeTruthy();
    expect(card.queryByText('Tin a')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('should hide the numbers when the mouse leaves the chart', async () => {
    // Arrange
    show();
    await userEvent.hover(screen.getByRole('button', { name: /^Ngày 03\/11/ }));

    // Act
    await userEvent.unhover(screen.getByRole('group', { name: /Hồ sơ theo thời gian/ }));

    // Assert
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('should tell a screen reader every job of the day', async () => {
    // Arrange
    show();

    // Act
    await openList();
    await pick('Tin a');
    await pick('Tin b');

    // Assert
    expect(screen.getByRole('button', { name: 'Ngày 03/11: Tin a: 0, Tin b: 4' })).toBeTruthy();
  });

  it('should find a job by typing, without tones', async () => {
    // Arrange
    show([job('Kế toán', [1, 0, 0]), job('Kho', [0, 1, 0])]);

    // Act
    await userEvent.type(field(), 'ke toan');

    // Assert
    const list = within(screen.getByRole('listbox'));
    expect(list.getByRole('option', { name: 'Tin Kế toán' })).toBeTruthy();
    expect(list.queryByRole('option', { name: 'Tin Kho' })).toBeNull();
  });

  it('should say so when no job matches', async () => {
    show();

    await userEvent.type(field(), 'không có');

    expect(screen.getByText('Không tìm thấy tin nào.')).toBeTruthy();
  });

  it('should work from the keyboard: arrows move, Enter picks, Backspace drops the last', async () => {
    // Arrange
    show();
    await openList();

    // Act
    await userEvent.keyboard('{ArrowDown}{Enter}');
    const afterEnter = bars('b').length;
    await userEvent.keyboard('{Backspace}');

    // Assert
    expect(afterEnter).toBe(3);
    expect(bars('b')).toHaveLength(0);
    expect(bars('all')).toHaveLength(3);
  });

  it('should keep the list open to pick another, and close it on Esc', async () => {
    // Arrange
    show();
    await openList();

    // Act
    await pick('Tin a');
    const stayedOpen = screen.queryByRole('listbox') !== null;
    await userEvent.keyboard('{Escape}');

    // Assert
    expect(stayedOpen).toBe(true);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('should mark a picked job selected', async () => {
    // Arrange
    show();
    await openList();

    // Act
    await pick('Tin a');

    // Assert
    expect(screen.getByRole('option', { name: 'Tin a', selected: true })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Tin b', selected: false })).toBeTruthy();
  });

  it('should drop a job with the cross on its label', async () => {
    // Arrange
    show();
    await openList();
    await pick('Tin a');
    await pick('Tin b');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ Tin a' }));

    // Assert
    expect(bars('a')).toHaveLength(0);
    expect(bars('b')).toHaveLength(3);
  });

  it('should go back to all jobs together when the last chip is dropped', async () => {
    // Arrange
    show();
    await openList();
    await pick('Tin a');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ Tin a' }));

    // Assert
    expect(bars('all')).toHaveLength(3);
  });

  it('should keep the colours of the others when one is dropped', () => {
    // Arrange
    const a = { jobId: 'a', jobTitle: 'A' };
    const b = { jobId: 'b', jobTitle: 'B' };
    const c = { jobId: 'c', jobTitle: 'C' };
    const both = togglePick(togglePick([], a), b);

    // Act
    const withoutA = togglePick(both, a);
    const again = togglePick(withoutA, c);

    // Assert
    expect(withoutA[0]?.color).toBe(both[1]?.color);
    expect(again[1]?.color).toBe(both[0]?.color);
  });

  it('should stop at the number of colours there are, and say so', async () => {
    // Arrange
    show(Array.from({ length: MAX_PICKED_JOBS + 1 }, (_, i) => job(String(i), [1, 1, 1])));
    await openList();

    // Act
    for (let i = 0; i < MAX_PICKED_JOBS; i += 1) await pick(`Tin ${i}`);
    await pick(`Tin ${MAX_PICKED_JOBS}`);

    // Assert
    expect(screen.getByText(`Chọn tối đa ${MAX_PICKED_JOBS} tin`)).toBeTruthy();
    expect(bars(String(MAX_PICKED_JOBS))).toHaveLength(0);
  });
});
