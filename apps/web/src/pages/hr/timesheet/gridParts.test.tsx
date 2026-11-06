import type { TimesheetDto } from '@careers/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { ReviewDialog } from './dialogs';
import { PageActions } from './gridParts';

const dto = (status: 'open' | 'closed') => ({ periodId: 'p10', status, from: '2026-09-26', to: '2026-10-25', today: '2026-11-06', canReopen: true }) as TimesheetDto;
const actions = (status: 'open' | 'closed') => render(<TooltipProvider><PageActions dto={dto(status)} problems={2} entered={3} hasPeople onReview={() => undefined} onReopen={() => undefined} /></TooltipProvider>);

afterEach(cleanup);

describe('reviewing a closed period', () => {
  it('should offer the review on a closed period too, with what it found', () => {
    // Act
    actions('closed');

    // Assert
    expect(screen.getByRole('button', { name: /Rà soát/ }).textContent).toContain('2');
  });

  it('should show a closed period\'s review without a way to close it again', () => {
    // Act
    render(<ReviewDialog open isClosed onClose={() => undefined} closableFrom={null} problems={[]} onJump={() => undefined} onLock={() => undefined} isBusy={false} error={null} />);

    // Assert
    expect(screen.queryByRole('button', { name: /Chốt kỳ/ })).toBeNull();
    expect(screen.getByText(/Kỳ đã chốt, chỉ xem/)).toBeTruthy();
  });
});
