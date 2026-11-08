import type { AbsenceRowDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { AbsenceTable } from './AbsenceTable';

/** The leave list opened from the leave calendar or the yearly report: already filtered as the link asks. */

const line = (id: string, over: Partial<AbsenceRowDto>): AbsenceRowDto => ({
  id, source: 'absence', reason: 'annual', code: 'P', from: '2026-11-10', to: '2026-11-10', days: 1, note: '', label: 'Nghỉ phép năm',
  approvedBy: 'HR', handover: '', createdBy: 'Lan', files: [], needsPaper: false, employeeId: 'e1', employeeCode: 'A', fullName: 'Người A', ...over,
});
const ROWS = [line('a1', {}), line('a2', { employeeId: 'e2', fullName: 'Người B', from: '2026-03-03', to: '2026-03-03', code: 'KL', label: 'Nghỉ không lương' }), line('a3', { employeeId: 'e2', fullName: 'Người B', from: '2026-11-11', to: '2026-11-11' })];

function open(link: string) {
  vi.spyOn(api, 'hrAllAbsences').mockResolvedValue(ROWS);
  vi.spyOn(api, 'hrEmployees').mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[link]}><TooltipProvider><AbsenceTable editingId={null} isRemoving={false} removeError={null} onEdit={() => undefined} onRemove={() => undefined} onPapers={() => undefined} /></TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the leave list opened from a link', () => {
  it('should show who is away on the day the calendar asked for', async () => {
    // Act
    open('/hr/cham-cong/nghi?ngay=2026-11-10');

    // Assert
    expect(await screen.findByRole('button', { name: 'Huỷ Người A 10/11' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Người B/ })).toBeNull();
  });

  it('should show one person’s year and one kind, as a number of the report asked', async () => {
    // Act
    open('/hr/cham-cong/nghi?nguoi=e2&nam=2025&loai=KL');

    // Assert
    expect(await screen.findByRole('button', { name: 'Huỷ Người B 03/03' })).toBeTruthy();
    expect(api.hrAllAbsences).toHaveBeenCalledWith(2025);
    expect(screen.queryByRole('button', { name: 'Huỷ Người B 11/11' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Người A/ })).toBeNull();
  });
});
