import { chooseOption } from '../../../test/choose';
import { addDays, todayInVietnam } from '@careers/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lastDaysPeriod, PeriodPicker, periodLabel, quickPeriods, yearsPeriod } from './PeriodPicker';

afterEach(cleanup);

const today = todayInVietnam();
const PICKED = { from: '2026-10-01', to: '2026-10-15' };

async function open(value = lastDaysPeriod(30), onChange = vi.fn()) {
  render(<PeriodPicker value={value} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: /Chọn khoảng thời gian/ }));
  return { dialog: within(screen.getByRole('dialog')), onChange };
}

const day = (iso: string) => document.querySelector<HTMLElement>(`[data-day="${iso}"] button`);

async function press(iso: string) {
  const button = day(iso);
  if (button) await userEvent.click(button);
}

describe('PeriodPicker', () => {
  it('should show the days in use and stay closed until pressed', () => {
    render(<PeriodPicker value={PICKED} onChange={vi.fn()} />);

    expect(screen.getByText('01/10/2026 – 15/10/2026')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should apply a ready-made choice at once and close', async () => {
    // Arrange
    const { dialog, onChange } = await open();

    // Act
    await userEvent.click(dialog.getByRole('button', { name: '3 ngày qua' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({ from: addDays(today, -2), to: today });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should mark the choice in use', async () => {
    const { dialog } = await open(lastDaysPeriod(7));

    expect(dialog.getByRole('button', { name: '7 ngày qua', pressed: true })).toBeTruthy();
  });

  it('should change nothing on the calendar before "Áp dụng", whichever day is pressed first', async () => {
    // Arrange
    const { dialog, onChange } = await open(PICKED);

    // Act
    await press('2026-10-10');
    const isWaitingForEnd = (dialog.getByRole('button', { name: 'Áp dụng' }) as HTMLButtonElement).disabled;
    await press('2026-10-03');
    const changedBeforeApply = onChange.mock.calls.length;
    await userEvent.click(dialog.getByRole('button', { name: 'Áp dụng' }));

    // Assert
    expect(isWaitingForEnd).toBe(true);
    expect(changedBeforeApply).toBe(0);
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-03', to: '2026-10-10' });
  });

  it('should jump to another year from the calendar', async () => {
    // Arrange
    const { dialog } = await open(PICKED);
    const [yearList] = dialog.getAllByRole('combobox', { name: /năm/i });

    // Act
    if (yearList) await chooseOption(yearList, '2025');

    // Assert
    expect(dialog.getAllByRole('combobox', { name: /năm/i })[0]).toHaveProperty('value', '2025');
  });

  it('should choose whole years with no month, "2020" to "2022"', async () => {
    // Arrange
    const { dialog, onChange } = await open();

    // Act
    await chooseOption(dialog.getByRole('combobox', { name: 'Từ năm' }), '2020');
    await chooseOption(dialog.getByRole('combobox', { name: 'Đến năm' }), '2022');
    await userEvent.click(dialog.getByRole('button', { name: 'Xem theo năm' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({ from: '2020-01-01', to: '2022-12-31' });
  });

  it('should drop what was pressed on "Huỷ"', async () => {
    // Arrange
    const { dialog, onChange } = await open(PICKED);
    await press('2026-10-10');

    // Act
    await userEvent.click(dialog.getByRole('button', { name: 'Huỷ' }));

    // Assert
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should close on Esc and on a press outside', async () => {
    // Arrange
    await open();

    // Act
    fireEvent.keyDown(window, { key: 'Escape' });
    const closedByEsc = screen.queryByRole('dialog') === null;
    await userEvent.click(screen.getByRole('button', { name: /Chọn khoảng thời gian/ }));
    fireEvent.pointerDown(document.body);

    // Assert
    expect(closedByEsc).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('quickPeriods', () => {
  const find = (label: string) => quickPeriods('2026-11-04').find((q) => q.label === label)?.period;

  it('should count this month and last month by the calendar', () => {
    expect(find('Tháng này')).toEqual({ from: '2026-11-01', to: '2026-11-04' });
    expect(find('Tháng trước')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('should cover this year up to today and the whole of last year', () => {
    expect(find('Năm nay')).toEqual({ from: '2026-01-01', to: '2026-11-04' });
    expect(find('Năm trước')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });

  it('should go back one day for yesterday', () => {
    expect(find('Hôm qua')).toEqual({ from: '2026-11-03', to: '2026-11-03' });
  });
});

describe('yearsPeriod', () => {
  it('should stop the current year at today', () => {
    expect(yearsPeriod(2025, 2026, '2026-11-04')).toEqual({ from: '2025-01-01', to: '2026-11-04' });
  });

  it('should put years chosen the wrong way round in order', () => {
    expect(yearsPeriod(2022, 2020, '2026-11-04')).toEqual({ from: '2020-01-01', to: '2022-12-31' });
  });
});

describe('periodLabel', () => {
  it('should name one day once', () => {
    expect(periodLabel({ from: '2026-11-04', to: '2026-11-04' })).toBe('04/11/2026');
  });
});
