import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewDialog } from './dialogs';
import type { TimesheetProblem } from './timesheetModel';

/** Papers missing are a reminder in Rà soát, never a block on closing (spec-giay-to-nghi.md). */

const missing: TimesheetProblem = { id: 'ga1', group: 'Cần xem', kind: 'paper', employeeId: 'e1', columnId: 'd1', text: 'Người A: Ốm có giấy BHXH 03/11–04/11', absence: { absenceId: 'a1', year: 2026 } };

afterEach(cleanup);

function open(onJump = vi.fn(), onLock = vi.fn()) {
  render(<ReviewDialog open problems={[missing]} onJump={onJump} onLock={onLock} onClose={() => undefined} isBusy={false} error={null} closableFrom={null} />);
  return { onJump, onLock };
}

describe('papers in the period review', () => {
  it('TC-GT-64: should list the absence missing papers and jump to it', async () => {
    // Arrange
    const { onJump } = open();
    const group = screen.getByRole('region', { name: 'Thiếu giấy tờ kèm đơn nghỉ' });

    // Act
    await userEvent.click(group.querySelector('button') as HTMLButtonElement);

    // Assert
    expect(group.textContent).toContain('Người A: Ốm có giấy BHXH 03/11–04/11');
    expect(onJump).toHaveBeenCalledWith(missing);
  });

  it('TC-GT-65: should still let HR close the period with papers missing', async () => {
    // Arrange
    const { onLock } = open();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Chốt kỳ' }));

    // Assert
    expect(onLock).toHaveBeenCalledOnce();
  });
});
