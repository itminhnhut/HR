import type { TimesheetDto } from '@careers/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeriodBanners } from './GridTab';

/** Fix 9: a month not started is only looked at, until HR opens it to type ahead. Cases TC-KY-04..06. */

const sheet = (over: Partial<TimesheetDto>) => ({ periodId: null, status: 'open', year: 2027, month: 3, from: '2027-02-26', to: '2027-03-25', today: '2026-11-06', canReopen: false, ...over }) as TimesheetDto;

afterEach(cleanup);

describe('a month that has not started', () => {
  it('TC-KY-04: should say the month has not started and offer to open it', () => {
    // Arrange
    const onOpen = vi.fn();
    render(<PeriodBanners dto={sheet({})} onOpenAhead={onOpen} isOpening={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Mở kỳ để nhập trước/ }));

    // Assert
    expect(screen.getByText(/Kỳ T3\/2027 chưa bắt đầu/)).toBeTruthy();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('TC-KY-05: should keep the free range banner, without the open button, for a range that is not a period', () => {
    // Act
    render(<PeriodBanners dto={sheet({ from: '2026-10-01', to: '2026-10-25', year: 2026, month: 10 })} onOpenAhead={() => undefined} isOpening={false} />);

    // Assert
    expect(screen.getByText(/Khoảng tự chọn/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mở kỳ để nhập trước/ })).toBeNull();
  });

  it('TC-KY-06: should not offer to open a stored period', () => {
    // Act
    render(<PeriodBanners dto={sheet({ periodId: 'p3' })} onOpenAhead={() => undefined} isOpening={false} />);

    // Assert
    expect(screen.queryByRole('button', { name: /Mở kỳ để nhập trước/ })).toBeNull();
  });
});
